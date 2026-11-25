
import { useCallback, useEffect, useRef, useState } from 'react'
import WorkspaceIcon from '../components/WorkspaceIcon'
import './Staff.css'

const roleLabels = {
  DOCTOR: '한의사',
  DESK: '안내데스크',
}

const statusLabels = {
  ACTIVE: '활성',
  PENDING: '승인대기',
  SUSPENDED: '이용중지',
  DELETED: '삭제',
  EXPIRED: '만료',
}

export default function Staff() {
  const [staff, setStaff] = useState([])
  const [invitations, setInvitations] = useState([])
  const [filter, setFilter] = useState('ALL')
  const [email, setEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('DOCTOR')
  const [inviteResult, setInviteResult] = useState(null)
  const [inviteError, setInviteError] = useState('')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [roleChange, setRoleChange] = useState(null)
  const inviteDialog = useRef(null)
  const roleDialog = useRef(null)

  const request = async (url, options = {}) => {
    const response = await fetch(url, {
      credentials: 'include',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      const message = data.error?.message ?? data.detail
      throw new Error(typeof message === 'string' ? message : '요청 처리에 실패했습니다.')
    }

    return data
  }

  const loadStaff = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const data = await request('/api/staff')
      setStaff(data.staff || [])
      setInvitations(data.invitations || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStaff()
  }, [loadStaff])

  const inviteStaff = async (event) => {
    event.preventDefault()

    if (!email.trim()) {
      setInviteError('이메일을 입력해 주세요.')
      return
    }

    setWorking(true)
    setInviteError('')
    setInviteResult(null)

    try {
      const data = await request('/api/staff/invitations', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          role: inviteRole,
        }),
      })

      setInviteResult(data)
      setEmail('')
      await loadStaff()
    } catch (err) {
      setInviteError(err.message)
    } finally {
      setWorking(false)
    }
  }

  const changeStaff = async (id, action, body, message, confirmed = false) => {
    if (!confirmed && !window.confirm(`${message} 진행할까요?`)) return

    setWorking(true)

    try {
      await request(`/api/staff/${id}/${action}`, {
        method: 'PATCH',
        ...(body ? { body: JSON.stringify(body) } : {}),
      })

      await loadStaff()
      alert(`${message} 완료되었습니다.`)
      return true
    } catch (err) {
      alert(err.message)
    } finally {
      setWorking(false)
    }
  }

  const deleteStaff = async (id) => {
    if (!window.confirm('직원을 삭제 처리할까요?')) return

    setWorking(true)

    try {
      await request(`/api/staff/${id}`, {
        method: 'DELETE',
      })

      await loadStaff()
      alert('직원이 삭제 처리되었습니다.')
    } catch (err) {
      alert(err.message)
    } finally {
      setWorking(false)
    }
  }

  const openRoleChange = (person) => {
    setRoleChange({ person, nextRole: person.role })
    roleDialog.current.showModal()
  }

  const changeRole = async (event) => {
    event.preventDefault()
    if (!roleChange || roleChange.nextRole === roleChange.person.role) return
    const { person, nextRole } = roleChange
    const changed = await changeStaff(
      person.id,
      'role',
      { role: nextRole },
      `직무를 ${roleLabels[nextRole]}(으)로 변경`,
      true
    )
    if (changed) roleDialog.current.close()
  }

  const visibleStaff = staff.filter((person) => {
    if (filter === 'ALL') return true
    return person.status === filter
  })

  const visibleInvitations =
    filter === 'ALL' || filter === 'INVITED'
      ? invitations
      : []

  const invitationLink = inviteResult?.token
    ? inviteResult.registrationUrl || `${window.location.origin}/staff/register?token=${encodeURIComponent(inviteResult.token)}`
    : ''

  const copyInvitationLink = async () => {
    try {
      await navigator.clipboard.writeText(invitationLink)
      alert('초대 링크가 복사되었습니다.')
    } catch {
      window.prompt('초대 링크를 복사해 주세요.', invitationLink)
    }
  }

  const cellStyle = {
    padding: '12px',
    borderBottom: '1px solid #ddd',
    textAlign: 'left',
    whiteSpace: 'nowrap',
  }

  const buttonStyle = {
    padding: '7px 10px',
    margin: '3px',
    cursor: 'pointer',
  }

  return (
    <div className="workspace-page">
      <div className="workspace-heading-row">
        <h2 className="workspace-title"><WorkspaceIcon name="person" />직원 관리</h2>
        <button type="button" className="workspace-primary" onClick={() => inviteDialog.current.showModal()}>직원 초대</button>
      </div>
      <div className="workspace-stats" aria-label="직원 현황">
        <div><WorkspaceIcon name="person" /><span>전체 직원</span><strong>{staff.length}명</strong></div>
        <div><WorkspaceIcon name="chat" tone="blue" /><span>초대 대기</span><strong>{invitations.filter(invitation => invitation.status === 'PENDING').length}명</strong></div>
        {[['PENDING', 'clock', 'amber'], ['ACTIVE', 'check', 'green'], ['SUSPENDED', 'minus', 'rose']].map(([status, icon, tone]) => (
          <div key={status}><WorkspaceIcon name={icon} tone={tone} /><span>{statusLabels[status]}</span><strong>{staff.filter(person => person.status === status).length}명</strong></div>
        ))}
      </div>

      <dialog ref={inviteDialog} className="workspace-dialog staff-invite-dialog" aria-labelledby="staff-invite-title">
        <header className="staff-invite-header">
          <WorkspaceIcon name="chat" />
          <div>
            <h3 id="staff-invite-title">직원 초대</h3>
            <p>초대할 직원의 이메일과 직무를 입력하세요.</p>
          </div>
          <button type="button" className="staff-invite-close" aria-label="직원 초대 닫기"
            onClick={() => inviteDialog.current.close()}>×</button>
        </header>

        <form className="staff-invite-form" onSubmit={inviteStaff}>
          <label className="workspace-dialog-field">
            <strong>이메일 <span className="staff-invite-required" aria-hidden="true">*</span></strong>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="초대할 직원의 이메일을 입력하세요."
              required
            />
          </label>

          <fieldset className="staff-invite-roles">
            <legend>직무 <span className="staff-invite-required" aria-hidden="true">*</span></legend>
            <div className="staff-invite-role-grid">
              {[
                ['DOCTOR', 'document', '진료·상담 및 처방 업무'],
                ['DESK', 'person', '환자 접수 및 처방전 확인'],
              ].map(([role, icon, description]) => (
                <label key={role} className="staff-invite-role">
                  <WorkspaceIcon name={icon} />
                  <span><strong>{roleLabels[role]}</strong><small>{description}</small></span>
                  <input type="radio" name="invite-role" value={role} checked={inviteRole === role}
                    onChange={() => setInviteRole(role)} />
                </label>
              ))}
            </div>
          </fieldset>

          <aside className="staff-invite-guide">
            <strong>초대 안내</strong>
            <ul>
              <li>메일 발송이 설정되어 있으면 입력한 이메일로 가입 링크를 보냅니다.</li>
              <li>초대 링크는 생성일로부터 7일간 유효합니다.</li>
              <li>직원의 가입 신청 후 원장이 승인하면 계정이 활성화됩니다.</li>
            </ul>
          </aside>

          {inviteError && <p className="staff-invite-error" role="alert">{inviteError}</p>}
          {invitationLink && (
            <div className="staff-invite-result" role="status">
              <p>{inviteResult.emailDelivery === 'sent'
                ? '직원 이메일로 초대 링크를 보냈습니다.'
                : inviteResult.emailDelivery === 'failed'
                  ? '메일을 보내지 못했습니다. 아래 링크를 복사해 전달해 주세요.'
                  : '메일 발송 설정이 필요합니다. 아래 링크를 복사해 전달할 수 있습니다.'}</p>
              <strong>초대 링크</strong>
              <p>{invitationLink}</p>
              <button type="button" onClick={copyInvitationLink}>링크 복사</button>
            </div>
          )}

          <div className="workspace-dialog-actions">
            <button type="button" onClick={() => inviteDialog.current.close()}>{invitationLink ? '닫기' : '취소'}</button>
            <button type="submit" disabled={working}>{working ? '처리 중…' : '초대 링크 만들기'}</button>
          </div>
        </form>
      </dialog>
      <dialog ref={roleDialog} className="workspace-dialog" aria-labelledby="staff-role-title"
        onClose={() => setRoleChange(null)}>
        <h3 id="staff-role-title">직무 변경</h3>
        {roleChange && <form onSubmit={changeRole}>
          <p>{roleChange.person.name || roleChange.person.email} · 현재 직무 {roleLabels[roleChange.person.role]}</p>
          <fieldset>
            <legend>변경할 직무</legend>
            {Object.entries(roleLabels).map(([role, label]) => (
              <label key={role} className="workspace-radio-option">
                <input type="radio" name="staff-role" checked={roleChange.nextRole === role}
                  onChange={() => setRoleChange({ ...roleChange, nextRole: role })} />
                {label}
              </label>
            ))}
          </fieldset>
          <div className="workspace-dialog-actions">
            <button type="button" onClick={() => roleDialog.current.close()}>취소</button>
            <button type="submit" disabled={working || roleChange.nextRole === roleChange.person.role}>변경 저장</button>
          </div>
        </form>}
      </dialog>

      <section className="workspace-panel">
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h3>직원 목록</h3>
          <button onClick={loadStaff}>새로고침</button>
        </div>

        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
        }}>
          {[
            ['ALL', '전체'],
            ['INVITED', '초대대기'],
            ['PENDING', '승인대기'],
            ['ACTIVE', '활성'],
            ['SUSPENDED', '이용중지'],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              style={{
                padding: '8px 14px',
                backgroundColor:
                  filter === value ? '#dcefe2' : 'white',
                border: '1px solid #ccc',
                borderRadius: '5px',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <p style={{ color: 'red' }}>{error}</p>
        )}

        {loading ? (
          <p>직원 목록을 불러오는 중입니다...</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginTop: '16px',
            }}>
              <thead>
                <tr>
                  {['직원명', '이메일', '직책', '권한', '상태', '작업'].map(
                    (heading) => (
                      <th key={heading} style={cellStyle}>
                        {heading}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {visibleStaff.map((person) => (
                  <tr key={person.id}>
                    <td style={cellStyle}>
                      {person.name || '-'}
                    </td>
                    <td style={cellStyle}>{person.email}</td>
                    <td style={cellStyle}>
                      {person.isOwner
                        ? '원장'
                        : roleLabels[person.role]}
                    </td>
                    <td style={cellStyle}>
                      {person.isOwner
                        ? '전체 관리'
                        : person.role === 'DOCTOR'
                          ? '진료·처방'
                          : '접수·수납'}
                    </td>
                    <td style={cellStyle}>
                      {statusLabels[person.status] || person.status}
                    </td>
                    <td style={cellStyle}>
                      {!person.isOwner && (
                        <>
                          {person.status === 'PENDING' && (
                            <button
                              style={buttonStyle}
                              disabled={working}
                              onClick={() => changeStaff(
                                person.id,
                                'approve',
                                null,
                                '직원 승인'
                              )}
                            >
                              승인
                            </button>
                          )}

                          <button
                            style={buttonStyle}
                            disabled={working}
                            onClick={() => openRoleChange(person)}
                          >
                            직무 변경
                          </button>

                          {person.status === 'ACTIVE' && (
                            <button
                              style={buttonStyle}
                              disabled={working}
                              onClick={() => changeStaff(
                                person.id,
                                'suspend',
                                null,
                                '직원 이용중지'
                              )}
                            >
                              이용중지
                            </button>
                          )}
                            {person.status === 'SUSPENDED' && (
                              <button
                                style={buttonStyle}
                                disabled={working}
                                onClick={() => changeStaff(
                                  person.id,
                                  'resume',
                                  null,
                                  '직원 이용재개'
                                )}
                              >
                                이용재개
                              </button>
                            )}


                          <button
                            style={buttonStyle}
                            disabled={working}
                            onClick={() => deleteStaff(person.id)}
                          >
                            삭제
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}

                {visibleInvitations.map((invitation) => (
                  <tr key={`invite-${invitation.id}`}>
                    <td style={cellStyle}>-</td>
                    <td style={cellStyle}>{invitation.email}</td>
                    <td style={cellStyle}>
                      {roleLabels[invitation.role]}
                    </td>
                    <td style={cellStyle}>
                      {invitation.role === 'DOCTOR'
                        ? '진료·처방'
                        : '접수·수납'}
                    </td>
                    <td style={cellStyle}>
                      {invitation.status === 'PENDING' ? '초대대기' : statusLabels[invitation.status] || invitation.status}
                    </td>
                    <td style={cellStyle}>-</td>
                  </tr>
                ))}

                {visibleStaff.length === 0 &&
                  visibleInvitations.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        style={{
                          ...cellStyle,
                          textAlign: 'center',
                        }}
                      >
                        표시할 직원이 없습니다.
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
