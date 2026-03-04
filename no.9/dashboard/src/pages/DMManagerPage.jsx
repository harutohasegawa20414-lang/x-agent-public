import React, { useEffect, useState } from 'react'
import { Send, RefreshCw } from 'lucide-react'
import { api } from '../hooks/useApi.js'

const STATUS_STYLE = {
  sent:   { label: '送信済', color: '#4ade80', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.2)' },
  mock:   { label: 'モック', color: '#7db3fc', bg: 'rgba(79,142,247,0.1)',  border: 'rgba(79,142,247,0.2)' },
  failed: { label: '失敗',   color: '#f87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.2)' },
}

export default function DMManagerPage() {
  const [history, setHistory] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState({ category_id: '', status: '' })

  const load = async () => {
    setLoading(true)
    try {
      const [hist, cats] = await Promise.all([
        api.getDMHistory({ category_id: filter.category_id || undefined, status: filter.status || undefined, limit: 100 }),
        api.getCategories(),
      ])
      setHistory(hist)
      setCategories(cats)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div style={{ padding: '32px 36px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'white' }}>送信履歴</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#7481a0' }}>送信したDMの履歴一覧</p>
        </div>
        <button onClick={load} className="btn-ghost" style={{ padding: '8px 10px' }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <select value={filter.category_id} onChange={e => setFilter(f => ({ ...f, category_id: e.target.value }))}
          style={{ padding: '7px 12px', fontSize: 12 }}>
          <option value="">全カテゴリ</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
          style={{ padding: '7px 12px', fontSize: 12 }}>
          <option value="">全ステータス</option>
          {Object.entries(STATUS_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={load} className="btn-ghost" style={{ padding: '7px 14px', fontSize: 12 }}>絞り込み</button>
      </div>

      {/* History List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0', color: '#4a5568' }}>
            <Send size={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 12px' }} />
            <p style={{ fontSize: 13 }}>送信履歴がありません</p>
          </div>
        ) : history.map(h => {
          const st = STATUS_STYLE[h.status] || STATUS_STYLE.mock
          const catName = categories.find(c => c.id === h.category_id)?.name || ''
          return (
            <div key={h.id} className="card" style={{ padding: '14px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: 'white', fontSize: 13 }}>@{h.username}</span>
                    <span style={{
                      padding: '1px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                      background: st.bg, color: st.color, border: `1px solid ${st.border}`,
                    }}>{st.label}</span>
                    {catName && (
                      <span style={{
                        padding: '1px 8px', borderRadius: 20, fontSize: 11,
                        background: 'rgba(99,102,241,0.1)', color: '#818cf8',
                        border: '1px solid rgba(99,102,241,0.15)',
                      }}>{catName}</span>
                    )}
                    <span style={{ fontSize: 11, color: '#4a5568', marginLeft: 'auto' }}>
                      {h.sent_at?.slice(0, 16).replace('T', ' ')}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: '#7481a0', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                    {h.dm_text?.slice(0, 120)}{h.dm_text?.length > 120 ? '...' : ''}
                  </p>
                  {h.error_msg && (
                    <p style={{ margin: '6px 0 0', fontSize: 11, color: '#f87171' }}>エラー: {h.error_msg}</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
