import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { TabBar } from 'antd-mobile'
import { MessageOutline, CalendarOutline, PayCircleOutline, HeartOutline, EditSOutline, UserOutline, StarOutline } from 'antd-mobile-icons'
import Chat from './pages/Chat'
import Schedule from './pages/Schedule'
import Finance from './pages/Finance'
import Health from './pages/Health'
import Diary from './pages/Diary'
import Review from './pages/Review'
import Profile from './pages/Profile'

const tabs = [
  { key: '/', title: '聊天', icon: MessageOutline },
  { key: '/schedule', title: '日程', icon: CalendarOutline },
  { key: '/finance', title: '记账', icon: PayCircleOutline },
  { key: '/health', title: '健康', icon: HeartOutline },
  { key: '/diary', title: '日记', icon: EditSOutline },
  { key: '/review', title: '复盘', icon: StarOutline },
  { key: '/profile', title: '我的', icon: UserOutline },
]

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const { pathname } = location

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f6f1' }}>
      <Routes>
        <Route path="/" element={<Chat />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/health" element={<Health />} />
        <Route path="/diary" element={<Diary />} />
        <Route path="/review" element={<Review />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
      <TabBar
        activeKey={pathname}
        onChange={(value) => navigate(value)}
        style={{ 
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e8e4dd',
          boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.05)'
        }}
      >
        {tabs.map((tab) => (
          <TabBar.Item key={tab.key} icon={(active: boolean) => <tab.icon style={{ color: active ? '#c9a997' : '#b5b5b5' }} />} title={tab.title} />
        ))}
      </TabBar>
    </div>
  )
}

export default App