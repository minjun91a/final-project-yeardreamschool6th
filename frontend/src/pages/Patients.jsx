
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import WorkspaceIcon from '../components/WorkspaceIcon'
import { formatOriginalDose, formatPrescribedDose } from '../prescriptionUtils'
export default function Patients({ currentRole }) {
  const { key, state } = useLocation()

  return <PatientManagement key={key} currentRole={currentRole} navigationState={state} />
}

function PatientManagement({ currentRole, navigationState }) {
  const [selectedMenu, setSelectedMenu] = useState(
    ['search', 'register', 'history'].includes(navigationState?.view) ? navigationState.view : null
  )
  const [searchKeyword, setSearchKeyword] = useState('')
  const [patientPage, setPatientPage] = useState(1)
  const [patients, setPatients] = useState([])
  const [patientLoadError, setPatientLoadError] = useState('')
  const [editPatient, setEditPatient] = useState(null)
  const [detailPatient, setDetailPatient] = useState(null)
  const [pendingWaitingPatientId, setPendingWaitingPatientId] = useState(null)

useEffect(() => {
  let active = true
  const loadPatients = async () => {
    try {
      const response = await fetch('/api/patients', {
        credentials: 'include',
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error?.message || '환자 목록을 불러오지 못했습니다.')
      }
      if (active) setPatients(data.patients || [])
    } catch (error) {
      if (active) setPatientLoadError(error.message)
    }
  }

  loadPatients()
  return () => { active = false }
}, [])


  const [consultationRecords, setConsultationRecords] = useState([])
  const [prescriptionRecords, setPrescriptionRecords] = useState([])
  const [historyDate, setHistoryDate] = useState(
    () => navigationState?.date || new Date().toLocaleDateString('en-CA')
  )
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [selectedPrescription, setSelectedPrescription] = useState(null)
  const [prescriptionDetail, setPrescriptionDetail] = useState(null)
  const [prescriptionDetailError, setPrescriptionDetailError] = useState('')
  const [historyError, setHistoryError] = useState('')
  const [detailTab, setDetailTab] = useState('consultation')


  const createReception = async (patientId) => {
    const response = await fetch('/api/visits', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId }),
    })
    const data = await response.json()
    if (!response.ok) {
      const error = new Error(data.error?.message || '접수에 실패했습니다.')
      error.status = response.status
      throw error
    }
    return data.record.id
  }

  const registerWaitingVisit = async (visitId) => {
    const response = await fetch(`/api/visits/${visitId}/status`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'REGISTER_WAITING', reason: null, consultation: null }),
    })
    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error?.message || '대기 등록에 실패했습니다.')
    }
  }

  const registerExistingPatientForWaiting = async (patientId) => {
    setPendingWaitingPatientId(patientId)
    try {
      let visitId
      try {
        visitId = await createReception(patientId)
      } catch (error) {
        if (error.status !== 409) throw error
        const response = await fetch('/api/visits?scope=all', { credentials: 'include' })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error?.message || '접수 현황을 불러오지 못했습니다.')
        }
        const reception = data.records.find(
          (record) => record.patientId === patientId && record.status === 'REGISTERED'
        )
        if (!reception) throw error
        visitId = reception.id
      }
      await registerWaitingVisit(visitId)
      alert('상담 대기 등록이 완료되었습니다.')
    } catch (error) {
      alert(error.message)
    } finally {
      setPendingWaitingPatientId(null)
    }
  }

  const registerReception = async () => {
    if (!detailPatient) return

    try {
      await createReception(detailPatient.id)
      alert('접수가 완료되었습니다. 오늘의 업무에서 대기 등록을 진행할 수 있습니다.')
      setDetailPatient(null)
    } catch (error) {
      alert(error.message)
    }
  }

  const [patientForm, setPatientForm] = useState({
  name: '',
  birthDate: '',
  phone: '',
  address: '',
  guardianName: '',
  guardianRelation: '',
  guardianPhone: '',
})
const handleEditChange = (e) => {
  const { name, value } = e.target

  setEditPatient((prev) => ({
    ...prev,
    [name]: value,
  }))
}


const saveEditedPatient = async () => {
  if (!editPatient.name.trim()) {
    alert('성명을 입력해 주세요.')
    return
  }

  if (!editPatient.birthDate) {
    alert('생년월일을 입력해 주세요.')
    return
  }

  if (!editPatient.phone.trim()) {
    alert('연락처를 입력해 주세요.')
    return
  }

  if (!editPatient.address.trim()) {
    alert('주소를 입력해 주세요.')
    return
  }

  try {
    const response = await fetch(
      `/api/patients/${editPatient.id}`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editPatient.name,
          birthDate: editPatient.birthDate,
          phone: editPatient.phone,
          address: editPatient.address,
          guardianName: editPatient.guardianName || '',
          guardianRelation: editPatient.guardianRelation || '',
          guardianPhone: editPatient.guardianPhone || '',
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      alert(data.detail || '환자 정보 수정에 실패했습니다.')
      return
    }

    setPatients((prev) =>
      prev.map((patient) =>
        patient.id === editPatient.id ? data.patient : patient
      )
    )

    setEditPatient(null)
    alert('환자 정보가 수정되었습니다.')
  } catch (error) {
    console.error('환자 정보 수정 오류:', error)
    alert('서버 연결에 실패했습니다.')
  }
}

const handleInputChange = (e) => {
  const { name, value } = e.target

  setPatientForm((prev) => ({
    ...prev,
    [name]: value,
  }))
}

const validatePatient = async (registerWaiting = false) => {
  if (!patientForm.name.trim()) {
    alert('성명을 입력해 주세요.')
    return
  }

  if (!patientForm.birthDate) {
    alert('생년월일을 입력해 주세요.')
    return
  }

  if (!patientForm.phone.trim()) {
    alert('연락처를 입력해 주세요.')
    return
  }

  if (!patientForm.address.trim()) {
    alert('주소를 입력해 주세요.')
    return
  }

  try {
    const response = await fetch('/api/patients', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patientForm),
    })

    const data = await response.json()

    if (!response.ok) {
      alert(data.error?.message || '환자 등록에 실패했습니다.')
      return
    }

    setPatients((prev) => [...prev, data.patient])

    if (registerWaiting) {
      let visitId
      try {
        visitId = await createReception(data.patient.id)
        await registerWaitingVisit(visitId)
      } catch (error) {
        alert(`${visitId ? '환자 정보와 접수는 저장됐습니다.' : '환자 정보는 저장됐습니다.'}\n${error.message}`)
        setSelectedMenu('search')
        return
      }
    }


    setPatientForm({
      name: '',
      birthDate: '',
      phone: '',
      address: '',
      guardianName: '',
      guardianRelation: '',
      guardianPhone: '',
    })

    alert(registerWaiting ? '환자 등록 및 상담대기등록이 완료되었습니다.' : '환자 등록이 완료되었습니다.')
    setSelectedMenu('search')
  } catch (error) {
    console.error('환자 등록 오류:', error)
    alert('서버 연결에 실패했습니다.')
  }
}


  useEffect(() => {
    if (selectedMenu !== 'history') return
    let active = true
    const loadHistory = async () => {
      setHistoryError('')
      setConsultationRecords([])
      setPrescriptionRecords([])
      try {
        if (currentRole === 'desk') {
          // 안내데스크는 전달된 버전만 조회 가능하다.
          const response = await fetch('/api/prescription-deliveries', { credentials: 'include' })
          if (!response.ok) throw new Error('전달된 처방전 조회에 실패했습니다.')
          const data = await response.json()
          if (active) setPrescriptionRecords(data.records || [])
          return
        }
        const [consultationResponse, prescriptionResponse] = await Promise.all([
          fetch('/api/consultations', { credentials: 'include' }),
          fetch('/api/prescriptions', { credentials: 'include' }),
        ])
        if (!consultationResponse.ok || !prescriptionResponse.ok) {
          throw new Error('상담 또는 처방 기록 조회에 실패했습니다.')
        }
        const [consultationData, prescriptionData] = await Promise.all([
          consultationResponse.json(), prescriptionResponse.json(),
        ])
        if (!active) return
        setPrescriptionRecords(prescriptionData.records || [])
        // ConsultationSummary에는 symptoms가 없다. 상세 API로 실제 증상을 조회한다.
        const details = await Promise.all((consultationData.records || []).map(async (record) => {
          try {
            const response = await fetch(`/api/consultations/${record.id}`, { credentials: 'include' })
            if (!response.ok) return record
            const data = await response.json()
            return data.record || record
          } catch {
            return record
          }
        }))
        if (active) setConsultationRecords(details)
      } catch (error) {
        console.error('과거상담 기록 조회 오류:', error)
        if (active) setHistoryError(error.message || '기록을 불러오지 못했습니다.')
      }
    }
    loadHistory()
    return () => { active = false }
  }, [selectedMenu, currentRole])

  const openConsultationDetail = async (record) => {
    try {
      const response = await fetch(`/api/consultations/${record.id}`, { credentials: 'include' })
      if (!response.ok) throw new Error('상담 상세정보를 불러오지 못했습니다.')
      const data = await response.json()
      setSelectedRecord(data.record)
      setDetailTab('consultation')
    } catch (error) {
      console.error(error)
      alert(error.message)
    }
  }

  const openPrescriptionDetail = async (record) => {
    setSelectedPrescription(record)
    setPrescriptionDetail(null)
    setPrescriptionDetailError('')
    try {
      const url = currentRole === 'desk'
        ? `/api/prescription-deliveries/${record.id}`
        : `/api/prescriptions/${record.id}/versions/${record.currentVersionId}`
      const response = await fetch(url, { credentials: 'include' })
      if (!response.ok) throw new Error('처방전 상세정보를 불러오지 못했습니다.')
      const data = await response.json()
      setPrescriptionDetail(currentRole === 'desk' ? data.record?.version : data.record)
    } catch (error) {
      console.error(error)
      setPrescriptionDetailError(error.message)
    }
  }

  const filteredConsultations = consultationRecords.filter(
    (record) => record.createdAt?.slice(0, 10) === historyDate
  )

  const filteredPrescriptions = prescriptionRecords.filter(
    (record) => (record.sentAt || record.createdAt)?.slice(0, 10) === historyDate
  )
  const keyword = searchKeyword.trim()
  const matchingPatients = patients.filter((patient) =>
    patient.name.includes(keyword) || patient.phone?.includes(keyword)
  )
  const pageSize = 10
  const pageCount = Math.max(1, Math.ceil(matchingPatients.length / pageSize))
  const currentPage = Math.min(patientPage, pageCount)
  const shownPatients = matchingPatients.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="workspace-page">
      {!selectedMenu && <h2 className="workspace-title"><WorkspaceIcon name="person" />환자 관리</h2>}

      {!selectedMenu && (
        <div className="patient-menu-grid">
          <button
            type="button"
            className="patient-menu-card patient-menu-card-featured"
            onClick={() => setSelectedMenu('search')}
          >
            <WorkspaceIcon name="search" />
            <strong>환자 검색 및 정보 조회·수정</strong>
            <span>기존 환자의 기본 정보와 보호자 정보를 확인합니다.</span>
          </button>

          <button
            type="button"
            className="patient-menu-card"
            onClick={() => setSelectedMenu('register')}
          >
            <WorkspaceIcon name="plus" />
            <strong>신규 환자 등록</strong>
            <span>처음 방문한 환자의 정보를 등록합니다.</span>
          </button>

          <button
            type="button"
            className="patient-menu-card"
            onClick={() => setSelectedMenu('history')}
          >
            <WorkspaceIcon name="calendar" tone="amber" />
            <strong>{currentRole === 'desk' ? '과거 처방전 기록확인' : '과거상담 기록확인'}</strong>
            <span>날짜를 선택해 저장된 기록을 조회합니다.</span>
          </button>
        </div>
      )}

      {selectedMenu && (
        <div>
          <button
            type="button"
            className="workspace-back"
            onClick={() => setSelectedMenu(null)}
          >
            환자 관리로 돌아가기
          </button>

          {selectedMenu === 'search' && (
            <div className="workspace-panel">
              <h2 className="workspace-title"><WorkspaceIcon name="search" />환자 검색 및 정보 조회·수정</h2>
              {patientLoadError && <p role="alert">{patientLoadError}</p>}

              <div className="patient-search">
                <label htmlFor="patient-search">환자 검색</label>
                <input
                  id="patient-search"
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => { setSearchKeyword(e.target.value); setPatientPage(1) }}
                  placeholder="환자 이름 또는 연락처"
                />
              </div>
              <p>전체 환자 <strong>{matchingPatients.length}명</strong></p>
              <div className="workspace-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>성명</th>
                    <th>생년월일</th>
                    <th>연락처</th>
                    <th>주소</th>
                    <th>작업</th>
                  </tr>
                </thead>

                <tbody>
                  {shownPatients.map((patient) => (
                      <tr key={patient.id}>
                        <td>{patient.name}</td>
                        <td>{patient.birthDate}</td>
                        <td>{patient.phone}</td>
                        <td>{patient.address}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => setDetailPatient(patient)}
                          >
                            상세보기
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditPatient({ ...patient })}
                          >
                            수정
                          </button>
                          {currentRole === 'desk' && (
                            <button
                              type="button"
                              disabled={pendingWaitingPatientId !== null}
                              onClick={() => registerExistingPatientForWaiting(patient.id)}
                            >
                              {pendingWaitingPatientId === patient.id ? '등록 중…' : '상담 대기'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              </div>
              {matchingPatients.length === 0 && !patientLoadError && <p>검색 결과가 없습니다.</p>}
              {pageCount > 1 && (
                <nav className="workspace-pagination" aria-label="환자 목록 페이지">
                  <button type="button" disabled={currentPage === 1} onClick={() => setPatientPage(currentPage - 1)}>이전</button>
                  <span aria-live="polite">{currentPage} / {pageCount}</span>
                  <button type="button" disabled={currentPage === pageCount} onClick={() => setPatientPage(currentPage + 1)}>다음</button>
                </nav>
              )}
            </div>
          )}

          {selectedMenu === 'register' && (
            <div className="workspace-panel">
              <h2 className="workspace-title"><WorkspaceIcon name="plus" />신규 환자 등록</h2>

              <div className="workspace-form-grid">
              <h4>기본 정보</h4>
              <label>
                성명 (필수)
                <input
                  type="text"
                  name="name"
                  value={patientForm.name}
                  onChange={handleInputChange}
                  placeholder="환자 성명"
                />
              </label>

              <label>
                생년월일 (필수)
                <input
                  type="date"
                  name="birthDate"
                  value={patientForm.birthDate}
                  onChange={handleInputChange}
                />
              </label>

              <label>
                연락처 (필수)
                <input
                  type="tel"
                  name="phone"
                  value={patientForm.phone}
                  onChange={handleInputChange}
                  placeholder="010-0000-0000"
                />
              </label>

              <label>
                주소 (필수)
                <input
                  type="text"
                  name="address"
                  value={patientForm.address}
                  onChange={handleInputChange}
                  placeholder="주소 입력"
                />
              </label>

              <h4>보호자 정보 (선택)</h4>

              <label>
                보호자 이름
                <input
                  type="text"
                  name="guardianName"
                  value={patientForm.guardianName}
                  onChange={handleInputChange}
                  placeholder="보호자 이름"
                />
              </label>

              <label>
                관계
                <input
                  type="text"
                  name="guardianRelation"
                  value={patientForm.guardianRelation}
                  onChange={handleInputChange}
                  placeholder="환자와의 관계"
                />
              </label>

              <label>
                보호자 연락처
                <input
                  type="tel"
                  name="guardianPhone"
                  value={patientForm.guardianPhone}
                  onChange={handleInputChange}
                  placeholder="010-0000-0000"
                />
              </label>
            </div>

              <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => validatePatient(false)}>
                  저장
                </button>

                {currentRole === 'desk' && <button type="button" onClick={() => validatePatient(true)}>
                  저장 및 상담대기등록
                </button>}
              </div>
            </div>
          )}


          {selectedMenu === 'history' && (
            <div className="workspace-panel">
              <h3>
                {currentRole === 'desk' ? '과거 처방전 기록확인' : '과거상담 기록확인'}
              </h3>

              <label>
                조회 날짜:{' '}
                <input
                  type="date"
                  value={historyDate}
                  onChange={(e) => setHistoryDate(e.target.value)}
                />
              </label>
              {currentRole === 'desk' && (
                <div style={{ marginTop: '20px' }}>
                  <h4>처방전 목록</h4>

                  <table style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>작성 날짜</th>
                        <th>환자명</th>
                        <th>처방명</th>
                        <th>상태</th>
                        <th>작업</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredPrescriptions.map((record) => (
                        <tr key={record.id}>
                          <td>{(record.sentAt || record.createdAt)?.slice(0, 10)}</td>
                          <td>{record.patientName}</td>
                          <td>{record.prescriptionName}</td>
                          <td>전달 완료</td>
                          <td>
                            <button
                              type="button"
                              onClick={() => openPrescriptionDetail(record)}
                            >
                              상세보기
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {filteredPrescriptions.length === 0 && (
                    <p>선택한 날짜의 처방전이 없습니다.</p>
                  )}
                </div>
              )}

              {historyError && (
                <p style={{ color: 'red' }}>{historyError}</p>
              )}

              {currentRole !== 'desk' && (
              <table style={{ width: '100%', marginTop: '20px' }}>
                <thead>
                  <tr>
                    <th>상담 날짜</th>
                    <th>환자명</th>
                    <th>증상</th>
                    <th>작업</th>
                  </tr>
                </thead>

                <tbody>
                  {currentRole !== 'desk' && filteredConsultations.map((record) => (
                    <tr key={record.id}>
                      <td>{record.createdAt?.slice(0, 10)}</td>
                      <td>{record.patientName}</td>
                      <td>{record.symptoms}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => openConsultationDetail(record)}
                        >
                          상세보기
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                  )}

              {currentRole !== 'desk' &&
                filteredConsultations.length === 0 &&
                !historyError && (
                  <p>선택한 날짜의 상담 기록이 없습니다.</p>
                )}

              {currentRole === 'desk' && selectedPrescription && (
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                  }}
                >
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="처방전 상세보기"
                    style={{
                      backgroundColor: 'white',
                      padding: '24px',
                      borderRadius: '10px',
                      width: '500px',
                      maxWidth: '90%',
                      maxHeight: '85vh',
                      overflowY: 'auto',
                    }}
                  >
                    <h3>처방전 상세보기</h3>

                    <p>환자명: {selectedPrescription.patientName}</p>
                    <p>처방명: {selectedPrescription.prescriptionName}</p>
                    <p>전달 날짜: {selectedPrescription.sentAt?.slice(0, 10)}</p>
                    <p>상태: 전달 완료</p>
                    {prescriptionDetailError && <p role="alert">{prescriptionDetailError}</p>}
                    {prescriptionDetail && <p>처방 내용: {prescriptionDetail.prescriptionText || '-'}</p>}

                    <h4>약재 구성</h4>

                    <table style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>약재명</th>
                          <th>원본 참고량</th>
                          <th>실제 처방량</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(prescriptionDetail?.ingredients || []).map((herb, index) => (
                          <tr key={index}>
                            <td>{herb.name || herb.ingredientName || '-'}</td>
                            <td>{formatOriginalDose(herb)}</td>
                            <td>{formatPrescribedDose(herb)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <button
                      type="button"
                      onClick={() => setSelectedPrescription(null)}
                      style={{ marginTop: '20px' }}
                    >
                      닫기
                    </button>
                  </div>
                </div>
              )}

              {selectedRecord && currentRole !== 'desk' && (
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                  }}
                >
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="상담일지 상세보기"
                    style={{
                      backgroundColor: 'white',
                      padding: '24px',
                      borderRadius: '10px',
                      width: '500px',
                      maxWidth: '90%',
                      maxHeight: '85vh',
                      overflowY: 'auto',
                    }}
                  >

                    <h3>상담 기록 상세보기</h3>

                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                      <button
                        type="button"
                        onClick={() => setDetailTab('consultation')}
                        style={{
                          backgroundColor: detailTab === 'consultation' ? '#2563eb' : '#e5e7eb',
                          color: detailTab === 'consultation' ? 'white' : 'black',
                          padding: '10px 20px',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        상담일지
                      </button>

                      <button
                        type="button"
                        onClick={() => setDetailTab('prescription')}
                        style={{
                          backgroundColor: detailTab === 'prescription' ? '#2563eb' : '#e5e7eb',
                          color: detailTab === 'prescription' ? 'white' : 'black',
                          padding: '10px 20px',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        처방전
                      </button>
                    </div>

                    {detailTab === 'consultation' && (
                      <div>
                        <p>환자명: {selectedRecord.patientName}</p>
                        <p>상담 날짜: {selectedRecord.createdAt?.slice(0, 10)}</p>
                        <p>증상: {selectedRecord.symptoms || '-'}</p>
                        <h4>상담 내용</h4>
                        <p>{selectedRecord.consultationText || '-'}</p>

                        <h4>선택한 병증</h4>
                        <p>{selectedRecord.diagnosis?.selectedDiseaseName || selectedRecord.diagnosis?.manualDiseaseText || (selectedRecord.diagnosis?.selectedDiseaseId ? `병증 ID: ${selectedRecord.diagnosis.selectedDiseaseId}` : '선택한 병증이 없습니다.')}</p>

                        <h4>추가 기록</h4>
                        <p>{selectedRecord.additionalNotes || '-'}</p>
                      </div>
                    )}


                    {detailTab === 'prescription' && (
                      <div>
                        <h4>연결된 처방전</h4>
                        {prescriptionRecords
                          .filter((prescription) => Number(prescription.caseId) === Number(selectedRecord.id))
                          .map((prescription) => (
                            <div key={prescription.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12, marginBottom: 12 }}>
                              <p>처방명: {prescription.prescriptionName || '-'}</p>
                              <p>작성 날짜: {prescription.createdAt?.slice(0, 10)}</p>
                              <p>전달 여부: {prescription.lastDeliveredAt ? '전달 이력 있음' : '미전달'}</p>
                              <button type="button" onClick={() => openPrescriptionDetail(prescription)}>처방 상세보기</button>
                              {selectedPrescription?.id === prescription.id && (
                                <div>
                                  {prescriptionDetailError && <p role="alert">{prescriptionDetailError}</p>}
                                  {prescriptionDetail ? (
                                    <div>
                                      <p>처방 내용: {prescriptionDetail.prescriptionText || '-'}</p>
                                      <h5>약재 구성</h5>
                                      {(prescriptionDetail.ingredients || []).length === 0 ? <p>등록된 약재가 없습니다.</p> : (
                                        <ul>{prescriptionDetail.ingredients.map((herb, index) => (
                                          <li key={index}>{herb.name || herb.ingredientName || '-'}: 원본 참고량 {formatOriginalDose(herb)} / 실제 처방량 {formatPrescribedDose(herb)}</li>
                                        ))}</ul>
                                      )}
                                    </div>
                                  ) : !prescriptionDetailError && <p>상세정보 불러오는 중...</p>}
                                </div>
                              )}
                            </div>
                          ))}
                        {!prescriptionRecords.some((prescription) => Number(prescription.caseId) === Number(selectedRecord.id)) && (
                          <p>아직 작성된 처방전이 없습니다.</p>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRecord(null)
                        setDetailTab('consultation')
                      }}
                      style={{ marginTop: '20px' }}
                    >
                      닫기
                    </button>

                  </div>
                </div>
              )}
            </div>
          )}


          {detailPatient && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="환자 상세정보"
                style={{
                  backgroundColor: 'white',
                  padding: '24px',
                  borderRadius: '10px',
                  width: '420px',
                  maxWidth: '90%',
                }}
              >
                <h3>환자 상세정보</h3>
                <h4 className="workspace-detail-heading">기본 정보</h4>
                <dl className="workspace-detail-grid">
                  <dt>성명</dt><dd>{detailPatient.name}</dd>
                  <dt>생년월일</dt><dd>{detailPatient.birthDate || '—'}</dd>
                  <dt>연락처</dt><dd>{detailPatient.phone || '—'}</dd>
                  <dt>주소</dt><dd>{detailPatient.address || '—'}</dd>
                </dl>

                <h4 className="workspace-detail-heading">보호자 정보</h4>
                {detailPatient.guardianName || detailPatient.guardianRelation || detailPatient.guardianPhone ? (
                  <dl className="workspace-detail-grid">
                    <dt>이름</dt><dd>{detailPatient.guardianName || '—'}</dd>
                    <dt>관계</dt><dd>{detailPatient.guardianRelation || '—'}</dd>
                    <dt>연락처</dt><dd>{detailPatient.guardianPhone || '—'}</dd>
                  </dl>
                ) : <p>등록된 보호자 정보가 없습니다.</p>}

                <div className="workspace-dialog-actions">
                {currentRole === 'desk' && <button type="button" className="workspace-primary" onClick={registerReception}>
                  접수
                </button>}
                  <button type="button" onClick={() => setDetailPatient(null)}>
                    닫기
                  </button>
                </div>
              </div>
            </div>
          )}

          {editPatient && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="환자 정보 수정"
                style={{
                  backgroundColor: 'white',
                  padding: '24px',
                  borderRadius: '10px',
                  width: '420px',
                  maxWidth: '90%',
                  maxHeight: '85vh',
                  overflowY: 'auto',
                }}
              >
                <h3>환자 정보 수정</h3>

                <div className="workspace-form-grid">
                  {[
                    ['name', '성명 (필수)', 'text'],
                    ['birthDate', '생년월일 (필수)', 'date'],
                    ['phone', '연락처 (필수)', 'tel'],
                    ['address', '주소 (필수)', 'text'],
                    ['guardianName', '보호자 이름', 'text'],
                    ['guardianRelation', '관계', 'text'],
                    ['guardianPhone', '보호자 연락처', 'tel'],
                  ].map(([name, label, type]) => (
                    <label key={name}>
                      {label}
                      <input
                        type={type}
                        name={name}
                        value={editPatient[name] || ''}
                        onChange={handleEditChange}
                      />
                    </label>
                  ))}
                </div>

                <div className="workspace-dialog-actions">
                  <button type="button" onClick={() => setEditPatient(null)}>
                    취소
                  </button>
                  <button type="button" className="workspace-primary" onClick={saveEditedPatient}>
                    저장
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
