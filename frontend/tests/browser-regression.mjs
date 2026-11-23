// Local browser tests with synthetic API fixtures; no production database calls.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const browserPath = process.env.HANUI_TEST_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const profile = await mkdtemp(join(tmpdir(), 'hanui-browser-test-'))
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5181', '--strictPort'], { stdio: 'pipe', windowsHide: true })
const browser = spawn(browserPath, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'pipe', windowsHide: true })
let socket, evaluate
const pending = new Map(); let counter = 0
const errors = []
const until = async (fn, label) => {
  const end = Date.now() + 15000
  while (Date.now() < end) { try { const value = await fn(); if (value) return value } catch {} await delay(80) }
  throw new Error('Timed out: ' + label)
}
try {
  await until(async () => (await fetch('http://127.0.0.1:5181/tests/browser-fixture.html')).ok, 'test server')
  const port = await until(async () => (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0], 'headless browser')
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data)
    if (message.id) { const promise = pending.get(message.id); pending.delete(message.id)
      if (message.error) promise?.reject(message.error); else promise?.resolve(message.result) }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text)
  }
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++counter; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }))
  })
  evaluate = async (expression) => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  const wait = (expression) => until(() => evaluate(expression), expression)
  const click = (label) => evaluate(`(() => { const el = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(label)}); if (!el) throw Error('Missing button'); el.click(); return true })()`)
  const fill = (selector, value) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw Error('Missing input'); Object.getOwnPropertyDescriptor(el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); return true })()`)
  const open = async (mode) => {
    await call('Page.navigate', { url: `http://127.0.0.1:5181/tests/browser-fixture.html?mode=${mode}` })
    await wait('document.querySelector("h2") !== null && window.apiCalls !== undefined')
  }
  await call('Runtime.enable')
  await open('consultation')
  await wait('window.apiCalls.some(x => x.url === "/api/ai/prescriptions" && x.method === "POST")')
  await wait('document.body.innerText.includes("미평가 가상 처방")')
  await click('이 처방으로 작성')
  await wait(`document.querySelector('[aria-label="원본 용량"]')?.value.includes('다른 약재와 같은 분량')`)
  console.log('PASS: restored consultation requests linked prescriptions; unscored candidate opens composer')

  await open('composer')
  await wait(`document.querySelector('select option[value="1"]') !== null`)
  await fill('select', '1')
  await wait('document.body.innerText.includes("미평가 가상 처방")')
  await click('선택')
  await wait(`document.querySelector('[aria-label="실제 처방량"]') !== null`)
  await fill('[aria-label="실제 처방량"]', '1.25')
  await fill('[aria-label="실제 처방 단위"]', 'g')
  await click('기업 자료 검색')
  await fill('input[placeholder="검색어를 입력해 주세요."]', '가상')
  await click('검색')
  await wait('document.body.innerText.includes("검색 결과 (1건)")')
  await click('상세보기')
  await wait('window.apiCalls.some(x => x.url.includes("/api/catalog/prescription/10?selectedDiseaseId=84"))')
  await wait('document.body.innerText.includes("선택한 병증과 기업 원본에 연결됨")')
  await click('닫기')
  await click('처방전 저장')
  await wait('window.submitted.length === 1')
  assert.deepEqual(await evaluate('window.submitted[0].ingredients[0]'), {
    compositionId: 1, id: 2, name: '가상 약재', amount: null, unit: null, preparation: null,
    originalDoseInfo: '다른 약재와 같은 분량', prescribedAmount: '1.25', prescribedUnit: 'g',
  })
  console.log('PASS: saved recommendation restores disease link; entered dose reaches POST separately from reference')

  await open('list')
  await wait('document.body.innerText.includes("가상 저장 처방")')
  await click('보기')
  await wait('document.body.innerText.includes("9.0 L") && document.body.innerText.includes("1.25 mL")')
  assert.equal(await evaluate('document.body.innerText.includes("용량(g)")'), false)
  await click('닫기')
  await click('수정')
  await wait(`document.querySelector('[aria-label="실제 처방량"]')?.value === '1.25'`)
  await fill('[aria-label="실제 처방량"]', '2.5')
  await evaluate(`(() => { const input = [...document.querySelectorAll('label')].find(el => el.textContent.includes('정정 사유')).querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '용량 정정 검사'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`)
  await click('수정 저장')
  await wait('window.submitted.length === 1')
  assert.equal(await evaluate('window.submitted[0].ingredients[0].prescribedAmount'), '2.5')
  assert.equal(await evaluate('window.submitted[0].ingredients[0].amount'), '9.0')
  console.log('PASS: saved detail preserves L/mL; correction keeps reference and submits new actual dose')

  await open('desk')
  await wait('document.body.innerText.includes("가상 저장 처방")')
  await click('보기')
  await wait('[...document.querySelectorAll("button")].some(b => b.textContent.trim() === "인쇄" && !b.disabled)')
  await click('인쇄')
  await wait('window.printed === 1')
  assert.ok(await evaluate('document.body.innerText.includes("1.25 mL") && document.body.innerText.includes("9.0 L")'))
  assert.deepEqual(errors, [])
  console.log('PASS: desk print uses saved version with both dose fields; no browser runtime exceptions')
} catch (error) {
  if (evaluate) console.error(await evaluate('JSON.stringify({body:document.body.innerText,calls:window.apiCalls,alerts:window.alerts})').catch(() => 'Unable to inspect browser'))
  console.error('Browser exceptions:', errors)
  throw error
} finally {
  socket?.close(); server.kill(); browser.kill()
  await delay(300)
  // Only the dedicated temporary test profile created above is removed.
  if (resolve(profile).startsWith(resolve(tmpdir()) + sep) && profile.includes('hanui-browser-test-')) {
    await rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 }).catch(() => {})
  }
}
