
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import WorkspaceIcon from '../components/WorkspaceIcon'

export default function Account({ currentRole, onOpenChat }) {
  const location = useLocation()

  return <AccountWorkspace key={location.key} currentRole={currentRole} onOpenChat={onOpenChat}
    initialView={location.state?.view} />
}

function AccountWorkspace({ currentRole, onOpenChat, initialView }) {
  const [selectedMenu, setSelectedMenu] = useState(
    initialView === 'chat' ? 'chat' : 'profile'
  )

  const [profile, setProfile] = useState(null)
  const [profileError, setProfileError] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)


  useEffect(() => {
    if (selectedMenu !== 'profile') return

    const loadProfile = async () => {
      setProfileLoading(true)
      setProfileError('')

      try {
        const response = await fetch('/api/profile', {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('프로필 정보를 불러오지 못했습니다.')
        }

        const data = await response.json()
        setProfile(data)
      } catch (error) {
        setProfileError(error.message)
      } finally {
        setProfileLoading(false)
      }
    }

    loadProfile()
  }, [selectedMenu])

const openEditProfile = () => {
  if (!profile) return

  setEditName(profile.name)
  setEditPhone(profile.phone || '')
  setSaveError('')
  setSelectedMenu('editProfile')
}

const saveProfile = async () => {
  if (!editName.trim()) {
    setSaveError('이름을 입력해 주세요.')
    return
  }

  setSavingProfile(true)
  setSaveError('')

  try {
    const response = await fetch('/api/profile', {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: editName.trim(),
        phone: editPhone.trim(),
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.detail || '계정 정보 수정에 실패했습니다.')
    }

    setProfile(data.profile)
    setSelectedMenu('profile')
    alert('계정 정보가 수정되었습니다.')
  } catch (error) {
    setSaveError(error.message)
  } finally {
    setSavingProfile(false)
  }
}
const changePassword = async () => {
  if (!currentPassword || !newPassword || !confirmPassword) {
    setPasswordError('모든 비밀번호 항목을 입력해 주세요.')
    return
  }

  if (newPassword.length < 8) {
    setPasswordError('새 비밀번호는 8자 이상이어야 합니다.')
    return
  }

  if (newPassword !== confirmPassword) {
    setPasswordError('새 비밀번호가 일치하지 않습니다.')
    return
  }

  setChangingPassword(true)
  setPasswordError('')

  try {
    const response = await fetch('/api/profile/password', {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword,
        newPassword,
        confirmPassword,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.detail || '비밀번호 변경에 실패했습니다.')
    }

    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setSelectedMenu('profile')

    alert('비밀번호가 변경되었습니다.')
  } catch (error) {
    setPasswordError(error.message)
  } finally {
    setChangingPassword(false)
  }
}

  return (
    <div className="workspace-page">
      <h2 className="workspace-title"><WorkspaceIcon name="chat" />소통·계정</h2>

      {selectedMenu === 'profile' && (
        <div className="account-overview account-home">
        <section className="workspace-panel">
          <h3 className="workspace-section-title"><WorkspaceIcon name="chat" />업무 채팅방</h3>
          <p>한의원 직원과 업무 메시지를 주고받습니다.</p>
          <button type="button" className="workspace-primary" onClick={onOpenChat}>채팅방 열기</button>
        </section>
        <div className="workspace-panel">
          <h3 className="workspace-section-title"><WorkspaceIcon name="person" tone="blue" />내 프로필</h3>

          {profileLoading && <p>프로필 정보를 불러오는 중입니다.</p>}

          {profileError && (
            <p style={{ color: 'red' }}>{profileError}</p>
          )}

          {!profileLoading && profile && (
            <div>
              <p><strong>이름:</strong> {profile.name}</p>
              <p><strong>이메일:</strong> {profile.email}</p>
              <p><strong>연락처:</strong> {profile.phone || '미등록'}</p>
              <p><strong>직책:</strong> {profile.role}</p>

              <div style={{ marginTop: '20px' }}>
                <button
                  onClick={openEditProfile}
                >
                  내 계정 정보 수정
                </button>{' '}
                <button
                  onClick={() => setSelectedMenu('changePassword')}
                >
                  비밀번호 변경
                </button>
              </div>
            </div>
          )}
        </div>
        {currentRole === 'director' && (
          <section className="workspace-panel">
            <h3 className="workspace-section-title"><WorkspaceIcon name="person" tone="blue" />직원 관리</h3>
            <p>직원 목록과 초대·승인 상태를 확인합니다.</p>
            <Link to="/staff">직원 목록 보기</Link>
          </section>
        )}
        </div>
      )}
      {selectedMenu === 'editProfile' && (
        <div className="workspace-panel">
          <button onClick={() => setSelectedMenu('profile')}>
            내 프로필로 돌아가기
          </button>

          <h3>내 계정 정보 수정</h3>

          <div>
            <label>이름</label>
            <br />
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>

          <div style={{ marginTop: '12px' }}>
            <label>이메일</label>
            <br />
            <input value={profile?.email || ''} disabled />
          </div>

          <div style={{ marginTop: '12px' }}>
            <label>연락처</label>
            <br />
            <input
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              placeholder="연락처를 입력해 주세요."
            />
          </div>

          <div style={{ marginTop: '12px' }}>
            <label>직책</label>
            <br />
            <input value={profile?.role || ''} disabled />
          </div>

          {saveError && (
            <p style={{ color: 'red' }}>{saveError}</p>
          )}

          <div style={{ marginTop: '20px' }}>
            <button
              onClick={saveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {selectedMenu === 'changePassword' && (
  <div className="workspace-panel">
    <button onClick={() => setSelectedMenu('profile')}>
      내 프로필로 돌아가기
    </button>

    <h3>비밀번호 변경</h3>

    <div>
      <p>현재 비밀번호</p>
      <input
        type="password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        autoComplete="current-password"
      />
    </div>

    <div>
      <p>새 비밀번호</p>
      <input
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        autoComplete="new-password"
      />
    </div>

    <div>
      <p>새 비밀번호 확인</p>
      <input
        type="password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        autoComplete="new-password"
      />
    </div>

    {passwordError && (
      <p style={{ color: 'red' }}>{passwordError}</p>
    )}

    <div style={{ marginTop: '20px' }}>
      <button
        onClick={changePassword}
        disabled={changingPassword}
      >
        {changingPassword ? '변경 중...' : '비밀번호 변경'}
      </button>
    </div>
  </div>
)}
            {selectedMenu === 'chat' && (
        <div className="workspace-panel">
          <h3>채팅방 보기</h3>
          <button type="button" onClick={onOpenChat}>채팅방 열기</button>
          <button type="button" onClick={() => setSelectedMenu('profile')}>내 프로필</button>
        </div>
      )}
    </div>
  )
}
