import React, { useEffect, useState } from 'react'
import { Reply, CheckCircle, Calendar, AlertTriangle, RefreshCw, X, Radio } from 'lucide-react'
import { api } from '../../hooks/useApi.js'

const SENTIMENT_CONFIG = {
  positive: { label: '前向き', color: '#4ade80', bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.2)' },
  neutral:  { label: '中立',   color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.15)' },
  negative: { label: '拒否',   color: '#f87171', bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' },
}

const PURPOSE_LABELS = {
  business: '商談', partnership: '提携', consultation: '相談', other: 'その他', rejection: '拒否',
}

export default function RepliesPage() {
  const [replies, setReplies] = useState([])
  const [stats, setStats] = useState(null)
  const [pollStatus, setPollStatus] = useState(null)
  const [filter, setFilter] = useState({ status: '', sentiment: '' })
  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(false)
  const [selected, setSelected] = useState(null)
  const [showMeeting, setShowMeeting] = useState(false)
  const [meetingForm, setMeetingForm] = useState({ meeting_datetime: '', notes: '' })
  const [msg, setMsg] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [rs, st, ps] = await Promise.all([api.getReplies(filter), api.getReplyStats(), api.getPollStatus()])
      setReplies(rs); setStats(st); setPollStatus(ps)
    } catch (e) { console.error(e) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const handlePoll = async () => {
    setPolling(true)
    try {
      const result = await api.pollReplies()
      setMsg(result.mock
        ? `ポーリング完了（モック）`
        : `ポーリング完了 - 新着返信: ${result.new_replies}件`)
      await load()
    } catch (e) { setMsg('ポーリングエラー: ' + e.message) }
    setPolling(false)
    setTimeout(() => setMsg(null), 3000)
  }

  const handleHandle = async (reply) => {
    await api.updateReply(reply.id, { status: 'handled' }); load()
  }

  const handleRegisterMeeting = async () => {
    if (!selected || !meetingForm.meeting_datetime) return
    try {
      await api.registerMeeting({ reply_id: selected.id, ...meetingForm })
      await api.updateReply(selected.id, { status: 'handled', conversation_summary: `商談登録: ${meetingForm.meeting_datetime}` })
      setMsg('商談をカレンダーに登録しました')
      setShowMeeting(false); setSelected(null); load()
    } catch (e) { setMsg('エラー: ' + e.message) }
    setTimeout(() => setMsg(null), 3000)
  }

  return (
    <div style={{ padding: '32px 36px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'white' }}>返信管理</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#7481a0' }}>DM返信の感情分類・人間引き継ぎ・商談登録</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {pollStatus && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 20, fontSize: 11,
              background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: '#818cf8',
            }}>
              <Radio size={10} />
              {pollStatus.last_polled_at
                ? `最終取得: ${pollStatus.last_polled_at.slice(11, 16)}`
                : '未取得'}
            </div>
          )}
          <button onClick={handlePoll} className="btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', fontSize: 12 }}
            disabled={polling}>
            <Radio size={12} style={{ animation: polling ? 'spin 1s linear infinite' : 'none' }} />
            {polling ? '取得中...' : '返信取得'}
          </button>
          <button onClick={load} className="btn-ghost" style={{ padding: '8px 10px' }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {msg && (
        <div style={{
          marginBottom: 20, padding: '10px 16px', borderRadius: 10, fontSize: 13,
          background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80',
        }}>{msg}</div>
      )}

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: '総返信数', val: stats.total, color: '#94a3b8' },
            { label: '前向き', val: stats.by_sentiment?.positive ?? 0, color: '#4ade80' },
            { label: '対応待ち', val: stats.pending_human, color: '#f59e0b' },
            { label: '前向き率', val: `${stats.positive_rate ?? 0}%`, color: '#818cf8' },
          ].map(({ label, val, color }) => (
            <div key={label} className="card" style={{ padding: '16px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 700, color, marginBottom: 3 }}>{val}</div>
              <div style={{ fontSize: 11, color: '#7481a0' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
          style={{ padding: '7px 12px', fontSize: 12 }}>
          <option value="">全ステータス</option>
          <option value="pending_human">対応待ち</option>
          <option value="auto_classified">自動分類済</option>
          <option value="handled">対応済</option>
        </select>
        <select value={filter.sentiment} onChange={e => setFilter(f => ({ ...f, sentiment: e.target.value }))}
          style={{ padding: '7px 12px', fontSize: 12 }}>
          <option value="">全感情</option>
          {Object.entries(SENTIMENT_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={load} className="btn-ghost" style={{ padding: '7px 14px', fontSize: 12 }}>絞り込み</button>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {replies.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#4a5568' }}>
            <Reply size={28} style={{ opacity: 0.3, display: 'block', margin: '0 auto 10px' }} />
            <p style={{ fontSize: 13 }}>返信がありません</p>
          </div>
        ) : replies.map(r => {
          const sentiment = SENTIMENT_CONFIG[r.classification?.sentiment] || SENTIMENT_CONFIG.neutral
          const isPending = r.status === 'pending_human'
          return (
            <div key={r.id} className="card" style={{
              padding: '16px 20px',
              borderColor: isPending ? 'rgba(245,158,11,0.3)' : undefined,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 7, marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, color: 'white', fontSize: 13 }}>@{r.username}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                      background: sentiment.bg, color: sentiment.color, border: `1px solid ${sentiment.border}`,
                    }}>{sentiment.label}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 20, fontSize: 11,
                      background: 'rgba(255,255,255,0.04)', color: '#94a3b8',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}>{PURPOSE_LABELS[r.classification?.purpose] || 'その他'}</span>
                    {isPending && (
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                        background: 'rgba(245,158,11,0.1)', color: '#fbbf24',
                        border: '1px solid rgba(245,158,11,0.25)',
                      }}>
                        <AlertTriangle size={9} />対応待ち
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: '#4a5568', marginLeft: 'auto' }}>
                      {r.received_at?.slice(0, 16)}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 4px', fontSize: 13, color: '#cbd5e1', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                    {r.reply_text?.slice(0, 200)}
                  </p>
                  {r.classification?.summary && (
                    <p style={{ margin: '0 0 4px', fontSize: 11, color: '#7481a0' }}>AI分類要約: {r.classification.summary}</p>
                  )}
                  {r.conversation_summary && (
                    <div style={{
                      marginTop: 6, padding: '8px 12px', borderRadius: 8, fontSize: 12,
                      background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.18)',
                      color: '#a5b4fc', lineHeight: 1.6,
                    }}>
                      <span style={{ fontSize: 10, color: '#7481a0', display: 'block', marginBottom: 2 }}>会話要約</span>
                      {r.conversation_summary}
                    </div>
                  )}
                </div>
                {r.status !== 'handled' && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {r.classification?.purpose === 'business' && (
                      <button onClick={() => { setSelected(r); setShowMeeting(true) }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                          background: 'rgba(34,197,94,0.1)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)',
                        }}>
                        <Calendar size={11} />商談登録
                      </button>
                    )}
                    <button onClick={() => handleHandle(r)} className="btn-ghost"
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', fontSize: 12 }}>
                      <CheckCircle size={11} />対応済
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Meeting Modal */}
      {showMeeting && selected && (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 440, padding: '28px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'white' }}>商談 / カレンダー登録</h2>
              <button onClick={() => setShowMeeting(false)} className="btn-ghost" style={{ padding: 6, borderRadius: 7 }}>
                <X size={15} />
              </button>
            </div>
            <p style={{ margin: '0 0 18px', fontSize: 13, color: '#7481a0' }}>@{selected.username} との商談を登録します</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#7481a0', marginBottom: 5, fontWeight: 500 }}>日時</label>
                <input type="datetime-local" value={meetingForm.meeting_datetime}
                  onChange={e => setMeetingForm(f => ({ ...f, meeting_datetime: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', fontSize: 13 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: '#7481a0', marginBottom: 5, fontWeight: 500 }}>メモ</label>
                <textarea value={meetingForm.notes} onChange={e => setMeetingForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3} style={{ width: '100%', padding: '9px 12px', fontSize: 13, resize: 'none' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button onClick={() => setShowMeeting(false)} className="btn-ghost" style={{ padding: '9px 18px', fontSize: 13 }}>キャンセル</button>
                <button onClick={handleRegisterMeeting} disabled={!meetingForm.meeting_datetime}
                  className="btn-primary" style={{ padding: '9px 20px', fontSize: 13 }}>登録</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
