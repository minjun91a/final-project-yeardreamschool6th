import { useEffect, useState } from 'react'

function App() {
  const [status, setStatus] = useState('연결 확인 중...')

  useEffect(() => {
    fetch('/api/health')
      .then((response) => {
        if (!response.ok) {
          throw new Error('서버 응답 오류')
        }
        return response.json()
      })
      .then((data) => {
        setStatus(data.status === 'ok' ? '연결 성공!' : '응답 확인 필요')
      })
      .catch(() => {
        setStatus('연결 실패')
      })
  }, [])

  return (
    <main style={{ padding: '60px', fontFamily: 'sans-serif' }}>
      <h1>한의결</h1>
      <p>한의사 처방 검토 지원 AI 서비스</p>
      <h2>FastAPI 서버 상태: {status}</h2>
    </main>
  )
}

export default App
