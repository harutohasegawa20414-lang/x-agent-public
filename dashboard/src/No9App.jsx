import React, { useState, useEffect, useRef } from 'react'
import {
  LayoutDashboard, Tags, Users, MessageSquare,
  BarChart2, Reply, Settings, ChevronDown, Check, Plus, Edit2
} from 'lucide-react'
import { api } from './hooks/useApi.js'
import AccountModal from './components/AccountModal.jsx'
import DashboardPage from './pages/no9/DashboardPage.jsx'
import CategoriesPage from './pages/no9/CategoriesPage.jsx'
import TargetsPage from './pages/no9/TargetsPage.jsx'
import DMManagerPage from './pages/no9/DMManagerPage.jsx'
import RepliesPage from './pages/no9/RepliesPage.jsx'
import AnalyticsPage from './pages/no9/AnalyticsPage.jsx'
import SettingsPage from './pages/no9/SettingsPage.jsx'

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

function AccountSwitcher({ onEditRequest, onAddRequest }) {
  const [accounts, setAccounts] = useState([])
  const [current, setCurrent] = useState(null)
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const load = async () => {
    try {
      const [accs, cur] = await Promise.all([api.getAccounts(), api.getCurrentAccount()])
      setAccounts(accs)
      setCurrent(cur)
    } catch (e) { /* account_manager unavailable */ }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSwitch = async (id) => {
    setOpen(false)
    try {
      const res = await api.switchAccount(id)
      setCurrent(res.current)
    } catch (e) { console.error(e) }
  }

  // 外部からリロードできるよう公開
  AccountSwitcher._reload = load

  if (!current) return null

  return (
    <div ref={ref} style={{ position: 'relative', padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.04)', cursor: 'pointer', color: '#aab4cc',
          fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
        }}
      >
        <div style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
          background: 'linear-gradient(135deg, #4f8ef7, #6366f1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 800, color: 'white',
        }}>
          {current.name.slice(0, 1).toUpperCase()}
        </div>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
          {current.name}
        </span>
        <ChevronDown size={12} style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 12, right: 12, marginTop: 4,
          background: '#131929', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          zIndex: 200, overflow: 'hidden',
        }}>
          <div style={{ padding: '6px 10px 4px', fontSize: 10, color: '#4f6080', fontWeight: 600, letterSpacing: '0.06em' }}>
            アカウント切り替え
          </div>
          {accounts.map(acc => (
            <div
              key={acc.id}
              style={{ display: 'flex', alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <button
                onClick={() => handleSwitch(acc.id)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', border: 'none',
                  background: 'transparent',
                  cursor: 'pointer', color: acc.is_current ? '#7db3fc' : '#aab4cc',
                  fontSize: 12, fontFamily: 'inherit', textAlign: 'left',
                }}
              >
                <div style={{
                  width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                  background: acc.is_current ? 'linear-gradient(135deg, #4f8ef7, #6366f1)' : 'rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 800, color: 'white',
                }}>
                  {acc.name.slice(0, 1).toUpperCase()}
                </div>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.name}</span>
                {acc.is_current && <Check size={11} style={{ color: '#4f8ef7', flexShrink: 0 }} />}
              </button>
              <button
                onClick={() => { onEditRequest(acc); setOpen(false) }}
                style={{
                  padding: '8px 10px 8px 0', border: 'none',
                  background: 'transparent', cursor: 'pointer',
                  color: '#4f6080', fontFamily: 'inherit', display: 'flex', alignItems: 'center',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#7db3fc'}
                onMouseLeave={e => e.currentTarget.style.color = '#4f6080'}
                title="アカウントを編集"
              >
                <Edit2 size={12} />
              </button>
            </div>
          ))}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
          <button
            onClick={() => { onAddRequest(); setOpen(false) }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', border: 'none',
              background: 'transparent', cursor: 'pointer',
              color: '#4f8ef7', fontSize: 12, fontFamily: 'inherit', textAlign: 'left',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(79,142,247,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Plus size={13} />
            アカウントを追加
          </button>
        </div>
      )}
    </div>
  )
}

export default function No9App() {
  const [page, setPage] = useState('dashboard')
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false)
  const [accountToEdit, setAccountToEdit] = useState(null)
  const switcherRef = useRef(null)
  const PageComponent = PAGES[page] || DashboardPage

  const handleAddOrEditAccount = async (config, isEdit) => {
    try {
      if (isEdit) {
        await api.editAccount(config.id, config)
        alert('アカウント情報を更新しました')
      } else {
        await api.addAccount(config)
        alert('アカウントを追加しました')
      }
      setIsAccountModalOpen(false)
      setAccountToEdit(null)
      // AccountSwitcher の表示を更新
      if (AccountSwitcher._reload) AccountSwitcher._reload()
    } catch (err) {
      alert(`アカウント${isEdit ? '更新' : '追加'}に失敗しました: ${err.message}`)
    }
  }

  return (
    <div className="no9-app" style={{ display: 'flex', height: '100%', overflow: 'hidden', background: '#0e1120' }} ref={switcherRef}>

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

        {/* Account Switcher */}
        <AccountSwitcher
          onEditRequest={(acc) => { setAccountToEdit(acc); setIsAccountModalOpen(true) }}
          onAddRequest={() => { setAccountToEdit(null); setIsAccountModalOpen(true) }}
        />

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

      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => { setIsAccountModalOpen(false); setAccountToEdit(null) }}
        onSubmit={handleAddOrEditAccount}
        initialData={accountToEdit}
      />

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
