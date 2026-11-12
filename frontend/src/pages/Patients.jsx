
import { useState } from 'react'
const testPatients = [
  {
    id: 1,
    name: '김민수',
    birthDate: '1990-03-15',
    phone: '010-1234-5678',
    address: '서울특별시 마포구',
  },
  {
    id: 2,
    name: '이서연',
    birthDate: '1985-07-22',
    phone: '010-2345-6789',
    address: '서울특별시 강남구',
  },
  {
    id: 3,
    name: '박지훈',
    birthDate: '1978-11-08',
    phone: '010-3456-7890',
    address: '경기도 고양시',
  },
]

export default function Patients() {
  const [selectedMenu, setSelectedMenu] = useState(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [patients, setPatients] = useState(testPatients)
  const [editPatient, setEditPatient] = useState(null)
  const [detailPatient, setDetailPatient] = useState(null)
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

const saveEditedPatient = () => {
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

  setPatients((prev) =>
    prev.map((patient) =>
      patient.id === editPatient.id ? { ...editPatient } : patient
    )
  )

  setEditPatient(null)
  alert('환자 정보가 수정되었습니다. 현재는 테스트 데이터에만 반영됩니다.')
}
const handleInputChange = (e) => {
  const { name, value } = e.target

  setPatientForm((prev) => ({
    ...prev,
    [name]: value,
  }))
}

const validatePatient = () => {
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

  console.log('신규 환자 등록 준비 데이터:', patientForm)

  alert('필수 입력 확인이 완료되었습니다. 실제 저장 기능은 아직 연결되지 않았습니다.')
}

  return (
    <div>
      <h2>환자 관리</h2>

      {!selectedMenu && (
        <div>
          <button
            type="button"
            onClick={() => setSelectedMenu('search')}
          >
            환자 검색 및 정보 조회·수정
          </button>

          <button
            type="button"
            onClick={() => setSelectedMenu('register')}
          >
            신규 환자 등록
          </button>

          <button
            type="button"
            onClick={() => setSelectedMenu('history')}
          >
            과거상담 기록확인
          </button>
        </div>
      )}

      {selectedMenu && (
        <div>
          <button
            type="button"
            onClick={() => setSelectedMenu(null)}
          >
            환자 관리로 돌아가기
          </button>

          {selectedMenu === 'search' && (
            <div>
              <h3>환자 검색 및 정보 조회·수정</h3>

              <div style={{ marginBottom: '20px' }}>
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="환자 이름을 입력해 주세요."
                  style={{
                    width: '300px',
                    padding: '10px',
                    marginRight: '8px',
                  }}
                />
              </div>

              <table
                style={{
                  borderCollapse: 'collapse',
                  width: '100%',
                  maxWidth: '900px',
                }}
              >
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
                  {patients
                    .filter((patient) =>
                      patient.name.includes(searchKeyword.trim())
                    )
                    .map((patient) => (
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
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedMenu === 'register' && (
            <div>
              <h3>신규 환자 등록</h3>

              <div style={{ display: 'grid', gap: '12px', maxWidth: '500px' }}>
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
                <button type="button" onClick={validatePatient}>
                  저장
                </button>

                <button type="button" onClick={validatePatient}>
                  저장 및 상담대기등록
                </button>
              </div>
            </div>
          )}

          {selectedMenu === 'history' && (
            <h3>과거상담 기록확인</h3>
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
                <p>성명: {detailPatient.name}</p>
                <p>생년월일: {detailPatient.birthDate}</p>
                <p>연락처: {detailPatient.phone}</p>
                <p>주소: {detailPatient.address}</p>

                <h4>보호자 정보 (선택)</h4>
                <p>보호자 이름: {detailPatient.guardianName || '-'}</p>
                <p>관계: {detailPatient.guardianRelation || '-'}</p>
                <p>보호자 연락처: {detailPatient.guardianPhone || '-'}</p>

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button type="button" disabled>
                    상담대기등록
                  </button>
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

                <div style={{ display: 'grid', gap: '12px' }}>
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

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button type="button" onClick={saveEditedPatient}>
                    저장
                  </button>
                  <button type="button" onClick={() => setEditPatient(null)}>
                    취소
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
