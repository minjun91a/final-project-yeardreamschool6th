
import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function Account() {
  const [selectedMenu, setSelectedMenu] = useState(null)

  return (
    <div>
      <h2>소통·계정</h2>

      <div>
        <h3>메뉴</h3>

        <ul>
          <li>
            <button onClick={() => setSelectedMenu('chat')}>
              채팅창 보기
            </button>
          </li>
          <li>
            <button onClick={() => setSelectedMenu('profile')}>
              내 프로필
            </button>
          </li>
          <li>
            <Link to="/staff">직원 관리</Link>
          </li>
        </ul>
      </div>

      {selectedMenu === 'chat' && (
        <div>
          <h3>채팅창 보기</h3>
        </div>
      )}

      {selectedMenu === 'profile' && (
        <div>
          <h3>내 프로필</h3>
        </div>
      )}
    </div>
  )
}
