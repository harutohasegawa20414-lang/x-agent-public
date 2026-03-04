import React, { useState } from 'react'
import {
  LayoutDashboard, Tags, Users, MessageSquare,
  BarChart2, Reply, Settings
} from 'lucide-react'
import DashboardPage from './pages/DashboardPage.jsx'
import CategoriesPage from './pages/CategoriesPage.jsx'
import TargetsPage from './pages/TargetsPage.jsx'
import DMManagerPage from './pages/DMManagerPage.jsx'
import RepliesPage from './pages/RepliesPage.jsx'
import AnalyticsPage from './pages/AnalyticsPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'

const NAV = [
  { id: 'dashboard', label: 'ダッシュボード', icon: LayoutDashboard },
  { id: 'categories', label: 'カテゴリ管理', icon: Tags },
  { id: 'targets', label: 'ターゲット', icon: Users },
  { id: 'dm', label: '送信履歴', icon: MessageSquare },
  { id: 'replies', label: '返信管理', icon: Reply },
  { id: 'analytics', label: 'アナリティクス', icon: BarChart2 },
  { id: 'settings', label: '設定', icon: Settings },
]

const PAGES = {
  dashboard: DashboardPage,
  categories: CategoriesPage,
  targets: TargetsPage,
  dm: DMManagerPage,
  replies: RepliesPage,
  analytics: AnalyticsPage,
  settings: SettingsPage,
}

export default function App() {
  const [page, setPage] = useState('dashboard')
  const PageComponent = PAGES[page] || DashboardPage

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0e1120' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 220,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#0b0e1a',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}>

        {/* Logo */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg, #4f8ef7, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
            }}>
              <span style={{ color: 'white', fontWeight: 800, fontSize: 14 }}>9</span>
            </div>
            <div>
              <div style={{ color: 'white', fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>X営業最適化</div>
              <div style={{ color: '#4f8ef7', fontSize: 11, fontWeight: 500 }}>No.9 System</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = page === id
            return (
              <button key={id} onClick={() => setPage(id)} style={{
                width: '100%',
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px',
                borderRadius: 9,
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                background: active ? 'rgba(79,142,247,0.12)' : 'transparent',
                color: active ? '#7db3fc' : '#7481a0',
                transition: 'all 0.15s',
              }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#aab4cc' }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#7481a0' } }}
              >
                <Icon size={15} style={{ flexShrink: 0 }} />
                {label}
                {active && (
                  <div style={{
                    marginLeft: 'auto', width: 3, height: 16, borderRadius: 2,
                    background: 'linear-gradient(180deg, #4f8ef7, #6366f1)',
                  }} />
                )}
              </button>
            )
          })}
        </nav>

        {/* Online status */}
        <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ position: 'relative', width: 8, height: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
              <div style={{
                position: 'absolute', inset: -2, borderRadius: '50%',
                background: 'rgba(34,197,94,0.3)', animation: 'pulse 2s infinite',
              }} />
            </div>
            <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 500 }}>System Online</span>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <PageComponent />
      </main>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
