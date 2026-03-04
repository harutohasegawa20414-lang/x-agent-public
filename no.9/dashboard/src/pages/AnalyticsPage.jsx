import React, { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { api } from '../hooks/useApi.js'

function HBarRow({ label, value, max, color = '#4f8ef7', sub }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 3 : 0) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 120, fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ flex: 1, height: 22, borderRadius: 5, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', position: 'relative' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${color}88, ${color})`, borderRadius: 5, transition: 'width 0.5s ease' }} />
      </div>
      <div style={{ width: 52, textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'white' }}>{sub ?? value}</div>
    </div>
  )
}

export default function AnalyticsPage() {
  const [overview, setOverview] = useState(null)
  const [daily, setDaily] = useState([])
  const [catStats, setCatStats] = useState([])
  const [kwStats, setKwStats] = useState([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [ov, ds, cs, kw] = await Promise.all([
        api.getOverview(), api.getDailyStats(14), api.getCategoryStats(), api.getKeywordStats(),
      ])
      setOverview(ov); setDaily(ds); setCatStats(cs); setKwStats(kw)
    } catch (e) { console.error(e) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const maxCatRate = Math.max(...catStats.map(c => c.reply_rate), 1)
  const maxKwRate  = Math.max(...kwStats.map(k => k.reply_rate), 1)

  // 当日中心の15日分データを構築（前7日 + 今日 + 後7日）
  const todayStr = new Date().toISOString().slice(0, 10)
  const dataByDate = Object.fromEntries(daily.map(d => [d.date, d]))
  const chartData = Array.from({ length: 15 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - 7 + i)
    const date = d.toISOString().slice(0, 10)
    return {
      date,
      sent:    dataByDate[date]?.sent    ?? 0,
      replied: dataByDate[date]?.replied ?? 0,
      isToday: date === todayStr,
      isFuture: date > todayStr,
    }
  })
  const maxSent = Math.max(...chartData.map(d => d.sent), 1)

  return (
    <div style={{ padding: '32px 36px' }}>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'white' }}>アナリティクス</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#7481a0' }}>送信・返信・カテゴリ別パフォーマンス分析</p>
        </div>
        <button onClick={load} className="btn-ghost" style={{ padding: '8px 10px' }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* KPI */}
      {overview && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
          {[
            { label: '返信率',        val: `${overview.reply_rate}%`,      color: '#4f8ef7' },
            { label: '前向き率',      val: `${overview.positive_rate}%`,   color: '#22c55e' },
            { label: '商談化率',      val: `${overview.conversion_rate}%`, color: '#f59e0b' },
            { label: '成約率 (deal)', val: `${overview.deal_rate}%`,       color: '#818cf8' },
          ].map(({ label, val, color }) => (
            <div key={label} className="card" style={{ padding: '18px 22px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 4, background: `linear-gradient(135deg,${color},${color}aa)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                {val}
              </div>
              <div style={{ fontSize: 11, color: '#7481a0' }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* 送信推移チャート（全幅） */}
      <div className="card" style={{ padding: '22px 26px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>14日間 送信・返信推移</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: '#7481a0' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, display: 'inline-block', background: '#4f8ef7' }} />送信数
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, display: 'inline-block', background: '#22c55e' }} />返信数
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, display: 'inline-block', background: '#fbbf24' }} />今日
            </span>
          </div>
        </div>

        {/* バー */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 110 }}>
          {chartData.map((d, i) => {
            const hSent    = Math.max((d.sent    / maxSent) * 100, d.sent    > 0 ? 6 : 0)
            const hReplied = Math.max((d.replied / maxSent) * 100, d.replied > 0 ? 6 : 0)
            const sentBg = d.isToday
              ? 'linear-gradient(180deg, #fcd34d, #f59e0b)'
              : d.isFuture ? 'rgba(255,255,255,0.07)'
              : 'linear-gradient(180deg, #4f8ef7, #6366f1)'
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 2 }}>
                {/* ラベル: 送信/返信 */}
                {!d.isFuture && (
                  <div style={{ fontSize: 9, textAlign: 'center', lineHeight: 1.3 }}>
                    <div style={{ fontWeight: d.isToday ? 700 : 500, color: d.isToday ? '#fbbf24' : d.sent > 0 ? '#94a3b8' : '#2a3050' }}>
                      {d.sent}
                    </div>
                    <div style={{ color: d.replied > 0 ? '#4ade80' : '#2a3050' }}>
                      {d.replied}
                    </div>
                  </div>
                )}
                {/* 2本バー横並び */}
                <div style={{ width: '100%', display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                  <div style={{
                    flex: 1,
                    height: d.sent > 0 || d.isFuture ? `${Math.max(hSent, d.isFuture ? 8 : 4)}px` : '3px',
                    minHeight: 3,
                    background: sentBg,
                    borderRadius: '3px 3px 0 0',
                    boxShadow: d.isToday ? '0 0 10px rgba(251,191,36,0.35)' : 'none',
                    border: d.isToday ? '1px solid rgba(251,191,36,0.4)' : 'none',
                    borderBottom: 'none',
                    transition: 'height 0.4s ease',
                  }} />
                  {!d.isFuture && (
                    <div style={{
                      flex: 1,
                      height: d.replied > 0 ? `${Math.max(hReplied, 4)}px` : '3px',
                      minHeight: 3,
                      background: d.replied > 0 ? 'linear-gradient(180deg, #4ade80, #16a34a)' : 'rgba(255,255,255,0.04)',
                      borderRadius: '3px 3px 0 0',
                      borderBottom: 'none',
                      transition: 'height 0.4s ease',
                    }} />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* 日付ラベル */}
        <div style={{ display: 'flex', gap: 5, marginTop: 0, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
          {chartData.map((d, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              {d.isToday ? (
                <div>
                  <div style={{ fontSize: 9, color: '#fbbf24', fontWeight: 700, lineHeight: 1.4 }}>今日</div>
                  <div style={{ fontSize: 9, color: '#fbbf24', fontWeight: 600 }}>{d.date.slice(5)}</div>
                </div>
              ) : (
                <div style={{ fontSize: 9, color: d.isFuture ? '#2a3050' : '#4a5568', lineHeight: 1.4 }}>
                  <div style={{ marginBottom: 2, visibility: 'hidden' }}>·</div>
                  {d.date.slice(5)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* カテゴリ別 ＆ キーワード別 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 18 }}>カテゴリ別 返信率</div>
          {catStats.length === 0 ? (
            <p style={{ fontSize: 12, color: '#4a5568' }}>データなし</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {catStats.map(c => (
                <HBarRow key={c.category_id} label={c.category_name} value={c.reply_rate} max={maxCatRate}
                  color="#818cf8" sub={`${c.reply_rate}%`} />
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 18 }}>キーワード別 返信率</div>
          {kwStats.length === 0 ? (
            <p style={{ fontSize: 12, color: '#4a5568' }}>データなし（検索実行後に表示されます）</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {kwStats.map(k => (
                <HBarRow key={k.keyword} label={k.keyword} value={k.reply_rate} max={maxKwRate}
                  color="#22c55e" sub={`${k.reply_rate}% (${k.replied}/${k.sent})`} />
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
