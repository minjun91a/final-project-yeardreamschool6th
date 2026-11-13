import Staff from './pages/Staff'
import { useEffect, useState } from 'react'
import {
  BrowserRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
} from 'react-router-dom'

import Today from './pages/Today'
import Patients from './pages/Patients'
import Consultation from './pages/Consultation'
import Prescriptions from './pages/Prescriptions'
import Account from './pages/Account'

import './App.css'

const menus = [
  { name: '오늘의 업무', path: '/today' },
  { name: '환자 관리', path: '/patients' },
  { name: '진료·상담', path: '/consultation' },
  { name: '처방 관리', path: '/prescriptions' },
  { name: '소통·계정', path: '/account' },
]

const roleMenus = {
  director: ['/today', '/patients', '/consultation', '/prescriptions', '/account'],
  doctor: ['/today', '/patients', '/consultation', '/prescriptions', '/account'],
  desk: ['/today', '/patients', '/prescriptions', '/account'],
}


function App() {
  const [serverStatus, setServerStatus] = useState('확인 중')

  useEffect(() => {
    fetch('/api/health')
      .then((response) => {
        if (!response.ok) {
          throw new Error('서버 응답 오류')
        }
        return response.json()
      })
      .then((data) => {
        setServerStatus(
          data.status === 'ok' ? '연결 성공' : '확인 필요'
        )
      })
      .catch(() => {
        setServerStatus('연결 실패')
      })
  }, [])

const currentRole = 'director'

const visibleMenus = menus.filter((menu) =>
  roleMenus[currentRole].includes(menu.path)
)

  return (
    <BrowserRouter>
      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <h1>한의결</h1>
            <p>한의사 처방 검토 지원 서비스</p>
          </div>

          <nav className="sidebar-menu">
            {visibleMenus.map((menu) => (
              <NavLink
                key={menu.path}
                to={menu.path}
                className={({ isActive }) =>
                  isActive ? 'menu-item active' : 'menu-item'
                }
              >
                {menu.name}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="main-layout">
          <header className="topbar">
            <span>한의결 관리 시스템</span>
            <span className="server-status">
              FastAPI: {serverStatus}
            </span>
          </header>

          <main className="main-content">
            <Routes>
              <Route path="/" element={<Navigate to="/today" replace />} />
              <Route path="/today" element={<Today />} />
              <Route path="/patients" element={<Patients />} />
              <Route path="/consultation" element={<Consultation />} />
              <Route path="/prescriptions" element={<Prescriptions />} />
              <Route path="/prescription/new" element={<Prescriptions />} />
              <Route path="/account" element={<Account />} />
              <Route path="*" element={<Navigate to="/today" replace />} />
              <Route path="/staff" element={<Staff />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App
