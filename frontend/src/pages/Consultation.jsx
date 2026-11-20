

import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'


export default function Consultation() {
  const location = useLocation()
  const navigate = useNavigate()

  const patient = location.state?.patient
  const fromToday = location.state?.source === 'today'
  const [symptoms, setSymptoms] = useState('')
  const [consultationText, setConsultationText] = useState('')
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [savedConsultation, setSavedConsultation] = useState(false)
  const [savedConsultationId, setSavedConsultationId] = useState(null)
  const [isWritingConsultation, setIsWritingConsultation] = useState(false)
  const [activeCaseId, setActiveCaseId] = useState(patient?.caseId ?? null)
  const [draftError, setDraftError] = useState('')
  const [draftReady, setDraftReady] = useState(false)
  const restoredInput = useRef(null)

  const [patients, setPatients] = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const response = await fetch('/api/visits?scope=all', {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('진료 중인 환자 목록 조회 실패')
        }

        const data = await response.json()

        const consultingPatients = (data.records || []).filter(
            (visit) => visit.status === 'IN_PROGRESS'
        ).map(visit => ({ ...visit, id: visit.patientId, name: visit.patientName }))

        setPatients(consultingPatients)
      } catch (error) {
        console.error('환자 목록 조회 오류:', error)
      }
    }

    fetchPatients()
  }, [])

  // v1.3: START에서 상담기록이 생성된다. 화면에서는 해당 방문의 caseId만 조회한다.
  useEffect(() => {
    const visitId = patient?.visitId
    let caseId = patient?.caseId
    if (!caseId && !visitId) {
      if (!patient) return
      setDraftError('진료 시작으로 생성된 방문 ID가 없습니다. 오늘의 업무에서 상담을 시작해주세요.')
      return
    }
    let cancelled = false
    setDraftReady(false)
    setDraftError('')
    const loadStartedCase = async () => {
      try {
        const read = async (url) => {
          const response = await fetch(url, { credentials: 'include' })
          const data = await response.json()
          if (!response.ok) throw new Error(data.error?.message || '상담기록 조회 실패')
          return data
        }
        if (!caseId) {
          const data = await read(`/api/consultations?visitId=${encodeURIComponent(visitId)}`)
          caseId = data.records.find(item => item.visitId === Number(visitId) && item.status === 'IN_PROGRESS')?.id
        }
        if (!caseId) throw new Error('진료 중인 상담기록을 찾지 못했습니다.')
        const { record } = await read(`/api/consultations/${caseId}`)
        const diagnosis = record.diagnosis ?? {}
        const search = diagnosis.diseaseSearchId
          ? await read(`/api/ai/searches/${encodeURIComponent(diagnosis.diseaseSearchId)}`) : null
        if (cancelled) return
        const restoredSymptoms = record.symptoms ?? ''
        restoredInput.current = { caseId, symptoms: restoredSymptoms }
        setActiveCaseId(caseId)
        setSymptoms(restoredSymptoms)
        setConsultationText(record.consultationText ?? '')
        setAdditionalNotes(record.additionalNotes ?? '')
        setDiseaseSearchId(search?.searchId ?? null)
        setSearchedSymptoms(search?.symptoms ?? '')
        activeSearchIdRef.current = search?.searchId ?? null
        setAiCandidates(search?.candidates ?? [])
        setHasPendingExplanations(search?.hasPendingExplanations === true)
        setSelectedDiseaseId(diagnosis.selectedDiseaseId ?? null)
        setManualDiseaseText(diagnosis.manualDiseaseText ?? null)
        const name = search?.candidates.find(candidate => candidate.id === diagnosis.selectedDiseaseId)?.name
          ?? diagnosis.manualDiseaseText
        setSelectedCandidates(name ? [name] : [])
        setSavedConsultationId(record.id)
        setSavedConsultation(Boolean(restoredSymptoms.trim()))
        setDraftReady(true)
      } catch (error) {
        if (!cancelled) setDraftError(error.message)
      }
    }
    loadStartedCase()
    return () => { cancelled = true }
  }, [patient?.visitId, patient?.caseId])

  const [analysisMessage, setAnalysisMessage] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState('')


  const [aiCandidates, setAiCandidates] = useState([])
  const [diseaseSearchId, setDiseaseSearchId] = useState(null)
  const [searchedSymptoms, setSearchedSymptoms] = useState('')
  const [hasPendingExplanations, setHasPendingExplanations] = useState(false)
  const [selectedDiseaseId, setSelectedDiseaseId] = useState(null)
  const [prescriptionSearch, setPrescriptionSearch] = useState(null)
  const [showAllPrescriptions, setShowAllPrescriptions] = useState(false)
  const [manualDiseaseText, setManualDiseaseText] = useState(null)
  const requestSequence = useRef(0)
  const activeSearchIdRef = useRef(null)

  // v1.3 §8.3: 입력 변경·이탈 시 이전 검색의 설명 작업을 중단 요청한다.
  const cancelSearch = (searchId) => {
    if (!searchId) return
    fetch(`/api/ai/searches/${encodeURIComponent(searchId)}/cancel`, {
      method: 'POST', credentials: 'include',
    }).catch((error) => console.error('이전 AI 검색 중단 요청 실패:', error))
  }

  useEffect(() => {
    if (restoredInput.current?.caseId === activeCaseId && restoredInput.current.symptoms === symptoms) return
    if (!activeCaseId || selectedDiseaseId === null || !diseaseSearchId || searchedSymptoms !== symptoms.trim()) return
    let obsolete = false
    let prescriptionSearchId
    const request = {
      caseId: activeCaseId, diseaseSearchId, symptoms: symptoms.trim(),
      selectedDiseases: [selectedDiseaseId],
    }
    setShowAllPrescriptions(false)
    setPrescriptionSearch({ request, loading: true })
    const search = async () => {
      try {
        const response = await fetch('/api/ai/prescriptions', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error?.message || '연결 처방 검색에 실패했습니다.')
        prescriptionSearchId = result.searchId
        if (obsolete) {
          cancelSearch(prescriptionSearchId)
          return
        }
        setPrescriptionSearch({ request, result })
      } catch (error) {
        if (!obsolete) setPrescriptionSearch({ request, error: error.message })
      }
    }
    search()
    return () => {
      obsolete = true
      cancelSearch(prescriptionSearchId)
    }
  }, [activeCaseId, diseaseSearchId, selectedDiseaseId, symptoms, searchedSymptoms])

  const currentPrescriptionSearch =
    prescriptionSearch?.request.caseId === activeCaseId &&
    prescriptionSearch?.request.diseaseSearchId === diseaseSearchId &&
    prescriptionSearch?.request.selectedDiseases[0] === selectedDiseaseId &&
    prescriptionSearch?.request.symptoms === symptoms.trim()
      ? prescriptionSearch : null
  const prescriptionResult = currentPrescriptionSearch?.result

  const togglePrescriptions = async () => {
    setShowAllPrescriptions(!showAllPrescriptions)
    if (showAllPrescriptions || !prescriptionResult) return
    const searchId = prescriptionResult.searchId
    const candidateIds = prescriptionResult.candidates.slice(3)
      .filter((candidate) => candidate.evidence?.length).map((candidate) => candidate.id)
    if (!candidateIds.length) return
    try {
      const response = await fetch(`/api/ai/searches/${encodeURIComponent(searchId)}/explanations`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateIds }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error?.message || '추가 처방 설명 요청에 실패했습니다.')
      if (data.acceptedCandidateIds.length) setPrescriptionSearch((previous) => previous?.result?.searchId === searchId
        ? { ...previous, result: { ...previous.result, hasPendingExplanations: true } } : previous)
    } catch (error) {
      setPrescriptionSearch((previous) => previous?.result?.searchId === searchId
        ? { ...previous, explanationError: error.message } : previous)
    }
  }

  useEffect(() => {
    const searchId = prescriptionResult?.searchId
    if (!searchId || !prescriptionResult.hasPendingExplanations) return
    let disposed = false
    let timer
    const poll = async () => {
      try {
        const response = await fetch(`/api/ai/searches/${encodeURIComponent(searchId)}`, { credentials: 'include' })
        const result = await response.json()
        if (!response.ok || result.kind !== 'PRESCRIPTION' || result.searchId !== searchId) {
          throw new Error(result.error?.message || '처방 설명 진행 상태를 조회하지 못했습니다.')
        }
        if (disposed) return
        setPrescriptionSearch((previous) => previous?.result?.searchId === searchId ? { ...previous, result } : previous)
        if (result.hasPendingExplanations) timer = setTimeout(poll, 2000)
      } catch (error) {
        if (!disposed) setPrescriptionSearch((previous) => previous?.result?.searchId === searchId
          ? { ...previous, explanationError: error.message } : previous)
      }
    }
    timer = setTimeout(poll, 2000)
    return () => { disposed = true; clearTimeout(timer) }
  }, [prescriptionResult?.searchId, prescriptionResult?.hasPendingExplanations])


  const [evidenceCandidate, setEvidenceCandidate] = useState(null)
  const [sourceDetail, setSourceDetail] = useState(null)
  const sourceSequence = useRef(0)

  const openSource = async (sourceUrl) => {
    const sequence = ++sourceSequence.current
    setSourceDetail({ loading: true })
    try {
      const response = await fetch(sourceUrl, { credentials: 'include' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error?.message || '원문을 불러오지 못했습니다.')
      if (sequence === sourceSequence.current) setSourceDetail({ record: data.record })
    } catch (error) {
      if (sequence === sourceSequence.current) setSourceDetail({ error: error.message })
    }
  }
  const [showAllCandidates, setShowAllCandidates] = useState(false)
  const [selectedCandidates, setSelectedCandidates] = useState([])
  const [customCandidate, setCustomCandidate] = useState('')

  const visibleCandidates = showAllCandidates
      ? aiCandidates
      : aiCandidates.slice(0, 3)

  const toggleAiCandidate = (candidate) => {
    restoredInput.current = null
    setSavedConsultation(false)
    const deselect = selectedDiseaseId === candidate.id
    setSelectedDiseaseId(deselect ? null : candidate.id)
    setManualDiseaseText(null)
    setSelectedCandidates(deselect ? [] : [candidate.name])
  }

  const addCustomCandidate = () => {
    const name = customCandidate.trim()

    if (!name) {
      alert('병증명을 입력해 주세요.')
      return
    }

    if (selectedCandidates.includes(name)) {
      alert('이미 추가된 병증입니다.')
      return
    }

    // v1.3: 기업 후보 선택과 직접 기록은 상호 배타적이다.
    setSelectedDiseaseId(null)
    setManualDiseaseText(name)
    setSavedConsultation(false)
    setSelectedCandidates([name])
    setCustomCandidate('')
  }

  const removeCandidate = (name) => {
    setSavedConsultation(false)
    setSelectedCandidates((prev) => prev.filter((candidate) => candidate !== name))
    if (aiCandidates.some((candidate) => candidate.id === selectedDiseaseId && candidate.name === name)) setSelectedDiseaseId(null)
    if (manualDiseaseText === name) setManualDiseaseText(null)
  }

  const analyzeSymptoms = async () => {
    const caseId = activeCaseId
    if (!caseId) {
      setAnalysisError('진료 중인 상담 ID가 필요합니다. 오늘의 업무에서 상담을 시작해 주세요.')
      return
    }
    if (!symptoms.trim()) return
    const sequence = ++requestSequence.current
    if (activeSearchIdRef.current) {
      cancelSearch(activeSearchIdRef.current)
      activeSearchIdRef.current = null
    }
    setIsAnalyzing(true)
    setAnalysisError('')
    setAnalysisMessage('')
    setAiCandidates([])
    setDiseaseSearchId(null)
    setHasPendingExplanations(false)
    setSelectedDiseaseId(null)
    setManualDiseaseText(null)
    setShowAllCandidates(false)
    try {
      const response = await fetch('/api/ai/symptoms', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId, symptoms: symptoms.trim() }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error?.message || 'AI 병증 검색에 실패했습니다.')
      }
      if (sequence !== requestSequence.current) {
        // 늦게 도착한 검색 응답은 화면에 적용하지 않고 설명 작업만 중단한다.
        cancelSearch(data.searchId)
        return
      }
      activeSearchIdRef.current = data.searchId ?? null
      setAiCandidates(Array.isArray(data.candidates) ? data.candidates : [])
      setSelectedCandidates([])
      setManualDiseaseText(null)
      setDiseaseSearchId(data.searchId ?? null)
      setSearchedSymptoms(data.symptoms)
      setHasPendingExplanations(data.hasPendingExplanations === true)
      setAnalysisMessage(data.message || '')
    } catch (error) {
      if (sequence === requestSequence.current && error.name !== 'AbortError') setAnalysisError(error.message || '분석 중 오류가 발생했습니다.')
    } finally {
      if (sequence === requestSequence.current) setIsAnalyzing(false)
    }
  }

  useEffect(() => {
    if (restoredInput.current?.caseId === activeCaseId && restoredInput.current.symptoms === symptoms) return
    restoredInput.current = null
    ++requestSequence.current
    cancelSearch(activeSearchIdRef.current)
    activeSearchIdRef.current = null
    setAiCandidates([])
    setDiseaseSearchId(null)
    setSearchedSymptoms('')
    setAnalysisMessage('')
    setAnalysisError('')
    setEvidenceCandidate(null)
    setHasPendingExplanations(false)
    setSelectedDiseaseId(null)
    setManualDiseaseText(null)
    setSelectedCandidates([])
    setShowAllCandidates(false)
    setIsAnalyzing(false)
  }, [symptoms, activeCaseId])

  useEffect(() => {
    if (!draftReady || !symptoms.trim() || !activeCaseId ||
        (restoredInput.current?.caseId === activeCaseId && restoredInput.current.symptoms === symptoms)) return
    const timer = setTimeout(() => analyzeSymptoms(), 800)
    return () => clearTimeout(timer)
  }, [symptoms, activeCaseId, draftReady])

  useEffect(() => () => {
    ++requestSequence.current
    cancelSearch(activeSearchIdRef.current)
    activeSearchIdRef.current = null
  }, [])

  const requestMoreExplanations = async () => {
    const searchId = activeSearchIdRef.current
    const extraIds = aiCandidates.slice(3).filter((candidate) => candidate.evidence?.length)
      .map((candidate) => candidate.id)
    if (!searchId || extraIds.length === 0) return
    try {
      const response = await fetch(`/api/ai/searches/${encodeURIComponent(searchId)}/explanations`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateIds: extraIds }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error?.message || '추가 병증 근거 요청에 실패했습니다.')
      if (activeSearchIdRef.current === searchId && data.acceptedCandidateIds.length) setHasPendingExplanations(true)
    } catch (error) {
      if (activeSearchIdRef.current === searchId) setAnalysisError(error.message)
    }
  }

  // v1.3 §8.1: 등록된 설명 작업이 남아 있을 때만 저장된 검색 결과를 조회한다.
  // 검색을 다시 실행하지 않으며 입력 변경·화면 이탈 시 폴링을 정리한다.
  useEffect(() => {
    if (!diseaseSearchId || !hasPendingExplanations) return
    let disposed = false
    let timer
    const poll = async () => {
      try {
        const response = await fetch(`/api/ai/searches/${encodeURIComponent(diseaseSearchId)}`, {
          credentials: 'include',
        })
        if (!response.ok) throw new Error('병증 근거 진행 상태를 조회하지 못했습니다.')
        const data = await response.json()
        if (disposed || activeSearchIdRef.current !== diseaseSearchId) return
        if (data.kind !== 'DISEASE' || data.searchId !== diseaseSearchId) {
          throw new Error('현재 병증 검색과 다른 응답입니다.')
        }
        setAiCandidates(Array.isArray(data.candidates) ? data.candidates : [])
        setEvidenceCandidate((current) => current
          ? data.candidates.find((candidate) => candidate.id === current.id) ?? current : null)
        setHasPendingExplanations(data.hasPendingExplanations === true)
        if (data.hasPendingExplanations === true) timer = setTimeout(poll, 2000)
      } catch (error) {
        if (!disposed) {
          setHasPendingExplanations(false)
          setAnalysisError(error.message)
        }
      }
    }
    timer = setTimeout(poll, 2000)
    return () => { disposed = true; clearTimeout(timer) }
  }, [diseaseSearchId, hasPendingExplanations])

  const writeConsultation = async (mode = 'save') => {
    if (isWritingConsultation) return
    const complete = mode === 'complete'
    const pause = mode === 'pause'
    if (!activeCaseId) {
      alert('환자 정보가 없습니다.')
      return
    }

    if (!pause && !symptoms.trim()) {
      alert('증상을 입력해 주세요.')
      return
    }

    if (complete && !consultationText.trim()) {
      alert('상담 내용을 입력해 주세요.')
      return
    }

    if (selectedDiseaseId !== null && manualDiseaseText) {
      alert('기업 병증 후보와 직접 입력 병증은 동시에 저장할 수 없습니다.')
      return
    }
    const reason = pause ? window.prompt('진료 중단 사유를 입력해 주세요.')?.trim() : null
    if (pause && !reason) return
    const consultation = {
      operation: 'SAVE',
      symptoms: symptoms.trim(),
      consultationText: consultationText.trim(),
      additionalNotes: additionalNotes.trim() || null,
      diseaseSearchId: selectedDiseaseId !== null ? diseaseSearchId : null,
      selectedDiseaseId,
      manualDiseaseText,
      reason: null,
    }
    setIsWritingConsultation(true)
    try {
      const response = await fetch(
          pause ? `/api/visits/${patient.visitId}/status`
            : `/api/consultations/${activeCaseId}${complete ? '/complete' : ''}`,
          {
            method: complete ? 'POST' : 'PATCH',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(pause ? { action: 'PAUSE', reason, consultation } : consultation),
          }
      )

      const data = await response.json()

      if (!response.ok) {
        alert(
            data.error?.message || '상담 상태 또는 기록을 저장하지 못했습니다.'
        )
        return
      }

      if (complete || pause) {
        navigate('/today')
        return
      }
      setSavedConsultationId(data.record.id)
      setSavedConsultation(true)
      alert('상담일지가 저장되었습니다.')
    } catch (error) {
      console.error('상담일지 저장 오류:', error)
      alert('서버 연결에 실패했습니다.')
    } finally {
      setIsWritingConsultation(false)
    }
  }

  return (
      <div>
        <h2>상담일지 작성</h2>
        {draftError && <p role="alert">상담기록 연결 오류: {draftError}</p>}
        {patient && !draftReady && !draftError && <p>진료 중 상담기록 연결 중...</p>}

        {fromToday && patient ? draftReady && (
            <div>
              <h3>환자 정보</h3>

              <p>성명: {patient.name}</p>
              <p>생년월일: {patient.birthDate}</p>
              <p>연락처: {patient.phone}</p>
              <p>주소: {patient.address}</p>

              <h4>보호자 정보 (선택)</h4>
              <p>보호자 이름: {patient.guardianName || '-'}</p>
              <p>관계: {patient.guardianRelation || '-'}</p>
              <p>보호자 연락처: {patient.guardianPhone || '-'}</p>

              <h3>증상 입력</h3>

              <textarea
                  value={symptoms}
                  onChange={(e) => { setSymptoms(e.target.value); setSavedConsultation(false) }}
                  placeholder="환자가 설명한 증상을 입력해 주세요."
                  rows={6}
                  style={{
                    width: '100%',
                    maxWidth: '700px',
                    padding: '12px',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
              />

              <h3>AI 병증 후보 추천</h3>

              <p>
                입력한 증상을 분석하여 관련 병증 후보를 표시합니다.
              </p>

              <div
                  style={{
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    padding: '16px',
                    maxWidth: '700px',
                  }}
              >

                {aiCandidates.length === 0 ? (
                    <p>아직 AI 분석 결과가 없습니다.</p>
                ) : (
                    <div>
                      {visibleCandidates.map((candidate) => (
                          <div
                              key={candidate.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                marginBottom: '12px',
                              }}
                          >
                            <label>
                              <input
                                  type="checkbox"
                                  checked={selectedDiseaseId === candidate.id}
                                  onChange={() => toggleAiCandidate(candidate)}
                              />
                              {' '}{candidate.name}
                            </label>

                            <button
                                type="button"
                                onClick={() => {
                                  ++sourceSequence.current
                                  setSourceDetail(null)
                                  setEvidenceCandidate(candidate)
                                }}
                            >
                              근거보기
                            </button>

                          </div>
                      ))}
                    </div>
                )}

                <button
                    type="button"
                    onClick={analyzeSymptoms}
                    disabled={isAnalyzing}
                >
                  {isAnalyzing ? '분석 중...' : 'AI 병증 분석'}
                </button>
                {hasPendingExplanations && <p>AI 근거를 확인하고 있습니다.</p>}
                {analysisMessage && (
                    <p>{analysisMessage}</p>
                )}

                {analysisError && (
                    <p style={{color: 'red'}}>
                      {analysisError}
                    </p>
                )}

                <div style={{marginTop: '16px'}}>
                  {aiCandidates.length > 3 && (
                      <button
                          type="button"
                          onClick={() => {
                            if (!showAllCandidates) requestMoreExplanations()
                            setShowAllCandidates((prev) => !prev)
                          }}
                      >
                        {showAllCandidates ? '접기' : '더보기'}
                      </button>
                  )}
                </div>
              </div>


              {currentPrescriptionSearch && (
                <section>
                  <h3>연결 처방</h3>
                  {currentPrescriptionSearch.loading && <p>기업 자료에서 연결 처방을 조회하고 있습니다.</p>}
                  {currentPrescriptionSearch.error && <p role="alert">{currentPrescriptionSearch.error}</p>}
                  {currentPrescriptionSearch.explanationError && <p role="alert">{currentPrescriptionSearch.explanationError}</p>}
                  {prescriptionResult && (
                    <>
                      {prescriptionResult.message && <p>{prescriptionResult.message}</p>}
                      <p>연결 {prescriptionResult.summary.connectedCount}건 · 평가 {prescriptionResult.summary.scoredCount}건</p>
                      <ol>
                        {(showAllPrescriptions ? prescriptionResult.candidates : prescriptionResult.candidates.slice(0, 3))
                          .map((candidate) => (
                            <li key={candidate.id}>
                              {candidate.name}{' '}
                              {candidate.explanation?.text && <p>{candidate.explanation.text}</p>}
                              {candidate.explanation?.message && <p>{candidate.explanation.message}</p>}
                              {savedConsultation && (
                                <button type="button" onClick={() => navigate('/prescription/new', {
                                  state: { patient, consultationId: savedConsultationId,
                                    aiPrescription: candidate, prescriptionSearchId: prescriptionResult.searchId,
                                    selectedDiseaseId },
                                })}>이 처방으로 작성</button>
                              )}
                            </li>
                          ))}
                      </ol>
                      {prescriptionResult.candidates.length > 3 && (
                        <button type="button" onClick={togglePrescriptions}>
                          {showAllPrescriptions ? '접기' : '전체 보기'}
                        </button>
                      )}
                      {prescriptionResult.unscoredCandidates.length > 0 && (
                        <>
                          <p>미평가 처방 {prescriptionResult.unscoredCandidates.length}건</p>
                          <ul>{prescriptionResult.unscoredCandidates.map((candidate) => (
                            <li key={candidate.id}>{candidate.name} · {candidate.evaluationStatus === 'INSUFFICIENT_DATA'
                              ? '설명 자료 부족' : '평가 정책 미설정'}</li>
                          ))}</ul>
                        </>
                      )}
                    </>
                  )}
                </section>
              )}

              <h3>병증 직접 입력</h3>

              <div style={{display: 'flex', gap: '8px', maxWidth: '700px'}}>
                <input
                    type="text"
                    value={customCandidate}
                    onChange={(e) => setCustomCandidate(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        addCustomCandidate()
                      }
                    }}
                    placeholder="병증명을 직접 입력해 주세요."
                    style={{
                      padding: '10px',
                      flex: 1,
                      minWidth: 0,
                    }}
                />

                <button type="button" onClick={addCustomCandidate}>
                  추가
                </button>
              </div>

              <h3>선택한 병증</h3>

              {selectedCandidates.length === 0 ? (
                  <p>선택한 병증이 없습니다.</p>
              ) : (
                  <div style={{maxWidth: '700px'}}>
                    {selectedCandidates.map((candidate) => (
                        <div
                            key={candidate}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px',
                              border: '1px solid #ddd',
                              borderRadius: '6px',
                              marginBottom: '8px',
                            }}
                        >
                          <span>{candidate}</span>

                          <button
                              type="button"
                              onClick={() => removeCandidate(candidate)}
                          >
                            삭제
                          </button>
                        </div>
                    ))}
                  </div>
              )}

              <h3>상담 내용</h3>
              <textarea
                  value={consultationText}
                  onChange={(e) => { setConsultationText(e.target.value); setSavedConsultation(false) }}
                  placeholder="상담 내용을 입력해 주세요."
                  rows={5}
                  style={{ width: '100%', maxWidth: '700px', padding: '12px', boxSizing: 'border-box' }}
              />

              <h3>추가 기록</h3>

              <textarea
                  value={additionalNotes}
                  onChange={(e) => { setAdditionalNotes(e.target.value); setSavedConsultation(false) }}
                  placeholder="한의사가 추가로 기록할 내용을 입력해 주세요."
                  rows={5}
                  style={{
                    width: '100%',
                    maxWidth: '700px',
                    padding: '12px',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                  }}
              />

              <div style={{marginTop: '20px', marginBottom: '12px'}}>
                <button
                    type="button"
                    onClick={() => writeConsultation()}
                    disabled={savedConsultation || isWritingConsultation}
                >
                  {savedConsultation ? '상담일지 저장 완료' : '상담일지 저장'}
                </button>
                <button type="button" onClick={() => writeConsultation('pause')}
                    disabled={isWritingConsultation || !patient.visitId}>
                  진료 중단
                </button>
                <button type="button" onClick={() => writeConsultation('complete')} disabled={isWritingConsultation}>
                  진료 완료
                </button>
              </div>
              {savedConsultation && (
                  <div style={{marginTop: '12px', marginBottom: '12px'}}>
                    <button
                        type="button"
                        onClick={() =>
                            navigate('/prescription/new', {
                              state: {
                                patient,
                                consultationId: savedConsultationId,
                                selectedDiseaseId,
                              },
                            })
                        }
                    >
                      AI 신규 처방전 작성 및 저장
                    </button>
                  </div>
              )}
              <button onClick={() => navigate('/today')}>
                오늘의 업무로 돌아가기
              </button>

              {evidenceCandidate && (
                  <div
                      style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 1000,
                      }}
                  >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="병증 근거 상세"
                        style={{
                          backgroundColor: 'white',
                          padding: '24px',
                          borderRadius: '10px',
                          width: '90%',
                          maxWidth: '550px',
                          maxHeight: '80vh',
                          overflowY: 'auto',
                        }}
                    >
                      <h3>병증 근거 상세</h3>

                      <p>병증명: {evidenceCandidate.name}</p>

                      <h4>근거 내용</h4>
                      {evidenceCandidate.explanation?.message && <p>{evidenceCandidate.explanation.message}</p>}
                      {evidenceCandidate.explanation?.status === 'READY' && (
                        <>
                          <p>{evidenceCandidate.explanation.text}</p>
                          {evidenceCandidate.explanation.checkedItems.length > 0 &&
                            <p>확인 범위 · {evidenceCandidate.explanation.checkedItems.join(', ')}</p>}
                          {evidenceCandidate.explanation.uncheckedItems.length > 0 &&
                            <p>미확인 범위 · {evidenceCandidate.explanation.uncheckedItems.join(', ')}</p>}
                          {evidenceCandidate.explanation.unexplainedSymptoms.length > 0 &&
                            <p>설명되지 않은 증상 · {evidenceCandidate.explanation.unexplainedSymptoms.join(', ')}</p>}
                        </>
                      )}
                      {(evidenceCandidate.evidence ?? []).map((source) => (
                        <section key={source.sourceId}>
                          <p>{source.sourceTitle} · {source.sourceLocation}</p>
                          <blockquote>{source.excerpt}</blockquote>
                          <button type="button" onClick={() => openSource(source.sourceUrl)}>원문 보기</button>
                        </section>
                      ))}
                      {sourceDetail?.loading && <p>원문을 불러오는 중입니다.</p>}
                      {sourceDetail?.error && <p role="alert">{sourceDetail.error}</p>}
                      {sourceDetail?.record && (
                        <p style={{ whiteSpace: 'pre-wrap' }}>{sourceDetail.record.originalText}</p>
                      )}

                      <button
                          type="button"
                          onClick={() => {
                            ++sourceSequence.current
                            setSourceDetail(null)
                            setEvidenceCandidate(null)
                          }}
                      >
                        닫기
                      </button>
                    </div>
                  </div>
              )}

            </div>
        ) : (
            <div>
              <h3>진료 중인 환자 선택</h3>

              {patients.length === 0 ? (
                  <p>현재 진료 중인 환자가 없습니다.</p>
              ) : (
                  <div>
                    <select
                        value={selectedPatientId}
                        onChange={(e) => setSelectedPatientId(e.target.value)}
                    >
                      <option value="">환자를 선택해 주세요.</option>

                      {patients.map((patient) => (
                          <option key={patient.id} value={patient.id}>
                            {patient.name}
                          </option>
                      ))}
                    </select>

                    <button
                        type="button"
                        disabled={!selectedPatientId}
                        onClick={() => {
                          const selectedPatient = patients.find(
                              (patient) =>
                                  String(patient.id) === String(selectedPatientId)
                          )

                          if (!selectedPatient) return

                          navigate('/consultation', {
                            state: {
                              patient: selectedPatient,
                              source: 'today',
                            },
                          })
                        }}
                    >
                      상담일지 작성
                    </button>
                  </div>
              )}
            </div>
        )}
      </div>
    )
  }



