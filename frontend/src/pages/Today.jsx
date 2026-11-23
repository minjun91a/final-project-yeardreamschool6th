
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import WorkspaceIcon from '../components/WorkspaceIcon'
import './Today.css'


const statusLabels = {
  REGISTERED: '접수', WAITING: '대기', IN_PROGRESS: '진료 중',
  COMPLETED: '완료', CANCELLED: '접수 취소', INTERRUPTED: '중단',
}

export default function Today({ currentRole, onOpenChat }) {
  const navigate = useNavigate()
  const [patients, setPatients] = useState([])
  const [pendingCancellation, setPendingCancellation] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const cancelDialog = useRef(null)

  const loadVisits = async ({ signal, quiet = false } = {}) => {
    try {
      const response = await fetch('/api/visits?scope=all', { credentials: 'include', signal })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error?.message || '접수 현황을 불러오지 못했습니다.')
      if (!signal?.aborted) setPatients(data.records || [])
    } catch (error) {
      if (signal?.aborted || quiet) return
      console.error('접수 현황 조회 오류:', error)
      alert(error.message)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    loadVisits({ signal: controller.signal })
    const timer = setInterval(() => {
      loadVisits({ signal: controller.signal, quiet: true })
    }, 5000)
    return () => {
      clearInterval(timer)
      controller.abort()
    }
  }, [])

  const waiting = patients.filter(p => p.status === 'WAITING').length
  const consulting = patients.filter(p => p.status === 'IN_PROGRESS').length
  const completed = patients.filter(p => p.status === 'COMPLETED').length

  const changeVisitStatus = async (visitId, action, reason = null) => {
    try {
      const response = await fetch(`/api/visits/${visitId}/status`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason, consultation: null }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error?.message || '상태 변경에 실패했습니다.')
      await loadVisits()
    } catch (error) {
      console.error('방문 상태 변경 오류:', error)
      alert(error.message)
    }
  }

  const startConsultation = id => changeVisitStatus(id, 'START')
  const cancelConsultation = id => {
    const reason = window.prompt('상담 시작 오처리 정정 사유를 입력하세요. 실제 상담 내용이 저장된 경우에는 정정할 수 없습니다.')
    if (reason?.trim()) changeVisitStatus(id, 'CORRECT_START', reason.trim())
  }
  const cancelReception = patient => {
    setPendingCancellation(patient)
    setCancelReason('')
    cancelDialog.current.showModal()
  }
  const confirmCancellation = event => {
    event.preventDefault()
    const reason = cancelReason.trim()
    if (!pendingCancellation || !reason) return
    changeVisitStatus(pendingCancellation.id, 'CANCEL', reason)
    cancelDialog.current.close()
  }
  const resumeConsultation = id => {
    const reason = window.prompt('진료 재개 사유를 입력해 주세요.')
    if (reason?.trim()) changeVisitStatus(id, 'RESUME', reason.trim())
  }


  return (
    <div className="today-page workspace-page">
      <div className="today-dashboard">
      <div className="today-primary">
      <div className="today-heading">
        <h2 className="workspace-title"><WorkspaceIcon name="calendar" />오늘의 업무</h2>


      </div>

      <div className="today-summary">
        <div className="summary-card">
          <span>전체 접수</span>
          <strong>{patients.length}명</strong>
        </div>
        <div className="summary-card">
          <span>상담 대기</span>
          <strong>{waiting}명</strong>
        </div>
        <div className="summary-card">
          <span>진료 중</span>
          <strong>{consulting}명</strong>
        </div>
        <div className="summary-card">
          <span>완료</span>
          <strong>{completed}명</strong>
        </div>
      </div>

      <section className="today-section">
        <h3 className="workspace-section-title"><WorkspaceIcon name="person" />상담 대기·진행 환자 목록</h3>

        <table className="patient-table">
          <thead>
            <tr>
              <th>접수 시간</th>
              <th>환자명</th>
              <th>상태</th>
              <th>담당자</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {patients
              .filter((patient) => !['COMPLETED', 'CANCELLED'].includes(patient.status))
              .map((patient) => (
              <tr key={patient.id} className={patient.status === 'IN_PROGRESS' ? 'visit-in-progress' : undefined}>
                <td>{patient.registeredAt ? new Date(patient.registeredAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td>{patient.patientName}</td>
                <td>
                  <span className={
                    patient.status === 'WAITING'
                      ? 'status waiting'
                      : patient.status === 'IN_PROGRESS'
                        ? 'status consulting'
                        : 'status completed'
                  }>
                    {statusLabels[patient.status] || patient.status}
                  </span>
                </td>
                <td>{patient.doctorName || '-'}</td>
                <td>
                  <div className="patient-actions">
                    {patient.status === 'WAITING' && currentRole !== 'desk' && (
                      <button onClick={() => startConsultation(patient.id)}>
                        상담 시작
                      </button>
                    )}

                    {patient.status === 'REGISTERED' && currentRole === 'desk' && (
                      <button onClick={() => changeVisitStatus(patient.id, 'REGISTER_WAITING')}>대기 등록</button>
                    )}

                    {patient.status === 'INTERRUPTED' && currentRole !== 'desk' && (
                      <button onClick={() => resumeConsultation(patient.id)}>진료 재개</button>
                    )}

                    {['REGISTERED', 'WAITING'].includes(patient.status) && currentRole === 'desk' && (
                      <button
                        className="danger-button"
                        onClick={() => cancelReception(patient)}
                      >
                        접수 취소
                      </button>
                    )}

                    {patient.status === 'IN_PROGRESS' &&
                      currentRole !== 'desk' && (
                        <>

                          <button
                            onClick={() =>
                              navigate('/consultation', {
                                state: {
                                  patient: { ...patient, visitId: patient.id, id: patient.patientId, name: patient.patientName },
                                  source: 'today',
                                },
                              })
                            }
                          >
                            일지 작성
                          </button>

                          <button
                            className="danger-button"
                            onClick={() => cancelConsultation(patient.id)}
                          >
                            상담 취소
                          </button>
                        </>
                      )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="today-section">
        <h3 className="workspace-section-title"><WorkspaceIcon name="document" tone="amber" />이어서 처리할 업무</h3>
        <button onClick={() => navigate('/prescriptions')}>
          처방전 보기
        </button>
      </section>
      </div>

  <aside className="today-quick-menu" aria-label="빠른 메뉴">
    <div className="quick-menu-card">
      <h4 className="workspace-section-title"><WorkspaceIcon name="person" />내 프로필</h4>
      <p>내 계정 정보를 확인합니다.</p>
      <button onClick={() => navigate('/account')}>
        프로필 보기
      </button>
    </div>

    <div className="quick-menu-card">
      <h4 className="workspace-section-title"><WorkspaceIcon name="calendar" tone="blue" />조회 날짜</h4>
      <p>과거 상담 기록을 조회합니다.</p>
      <input
        type="date"
        onChange={(e) => {
          if (e.target.value) {
            navigate('/patients', {
              state: {
                view: 'history',
                date: e.target.value,
              },
            })
          }
        }}
      />
    </div>

    <div className="quick-menu-card">
      <h4 className="workspace-section-title"><WorkspaceIcon name="chat" />업무 채팅</h4>
      <p>직원 간 채팅방을 확인합니다.</p>
      <button onClick={onOpenChat}>
        채팅방 보기
      </button>
    </div>
  </aside>
      </div>
      <dialog ref={cancelDialog} className="workspace-dialog" aria-labelledby="cancel-visit-title"
        onClose={() => setPendingCancellation(null)}>
        <h3 id="cancel-visit-title">접수를 취소하시겠습니까?</h3>
        {pendingCancellation && <p>{pendingCancellation.patientName} 환자의 접수가 취소되며 대기 목록에서 제외됩니다.</p>}
        <form onSubmit={confirmCancellation}>
          <label className="workspace-dialog-field">
            접수 취소 사유
            <textarea required rows={3} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
          </label>
          <div className="workspace-dialog-actions">
            <button type="button" onClick={() => cancelDialog.current.close()}>돌아가기</button>
            <button type="submit" className="workspace-danger" disabled={!cancelReason.trim()}>접수 취소</button>
          </div>
        </form>
      </dialog>
    </div>
  )
}
