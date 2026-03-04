import React, { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { api } from '../../hooks/useApi.js'
import {
  ResponsiveContainer, ComposedChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts'

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

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#131929',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 12,
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    }}>
      <div style={{ color: '#7481a0', marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.fill, display: 'inline-block' }} />
          <span style={{ color: '#aab4cc' }}>{p.name}:</span>
          <span style={{ color: 'white', fontWeight: 600 }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [overview, setOverview] = useState(null)
  const [daily, setDaily] = useState([])
  const [catStats, setCatStats] = useState([])
  const [kwStats, setKwStats] = useState([])
  const [loading, setLoading] = useState(false)
  const [numDays, setNumDays] = useState(30)

  const load = async () => {
    setLoading(true)
    try {
      const [ov, ds, cs, kw] = await Promise.all([
        api.getOverview(), api.getDailyStats(30), api.getCategoryStats(), api.getKeywordStats(),
      ])
      setOverview(ov); setDaily(ds); setCatStats(cs); setKwStats(kw)
    } catch (e) { console.error(e) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const maxCatRate = Math.max(...catStats.map(c => c.reply_rate), 1)
  const maxKwRate  = Math.max(...kwStats.map(k => k.reply_rate), 1)

  // 過去30日分（今日含む）のデータを構築
  const dataByDate = Object.fromEntries(daily.map(d => [d.date, d]))
  const allData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - 29 + i)
    const date = d.toISOString().slice(0, 10)
    const isToday = i === 29
    return {
      date,
      label: isToday ? '今日' : date.slice(5).replace('-', '/'),
      sent:    dataByDate[date]?.sent    ?? 0,
      replied: dataByDate[date]?.replied ?? 0,
      isToday,
    }
  })

  // スライダーで指定した日数分だけ末尾から切り出す（常に今日が右端）
  const visibleData = allData.slice(30 - numDays)

  // 表示日数に応じてX軸ラベルの間隔を自動調整
  const xAxisInterval =
    numDays <= 7  ? 0 :
    numDays <= 14 ? 1 :
    numDays <= 21 ? 2 : 3

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

      {/* 送信推移チャート */}
      <div className="card" style={{ padding: '22px 26px', marginBottom: 16 }}>
        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>送信・返信推移</span>
            <span style={{
              fontSize: 11, fontWeight: 500, color: '#4f8ef7',
              background: 'rgba(79,142,247,0.1)', border: '1px solid rgba(79,142,247,0.2)',
              borderRadius: 5, padding: '2px 8px',
            }}>直近 {numDays} 日間</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11, color: '#7481a0' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, display: 'inline-block', background: '#4f8ef7' }} />送信数
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, display: 'inline-block', background: '#22c55e' }} />返信数
            </span>
          </div>
        </div>

        {/* グラフ本体 */}
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={visibleData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barCategoryGap="20%">
            <defs>
              <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4f8ef7" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
              <linearGradient id="repliedGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4ade80" />
                <stop offset="100%" stopColor="#16a34a" />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="label"
              interval={xAxisInterval}
              tick={({ x, y, payload }) => {
                const isToday = payload.value === '今日'
                return (
                  <text x={x} y={y + 12} textAnchor="middle" fontSize={10}
                    fill={isToday ? '#fbbf24' : '#4a5568'}
                    fontWeight={isToday ? 700 : 400}
                  >
                    {payload.value}
                  </text>
                )
              }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#4a5568' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)', radius: 4 }} />
            <Bar dataKey="sent" name="送信数" fill="url(#sentGrad)" radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Bar dataKey="replied" name="返信数" fill="url(#repliedGrad)" radius={[3, 3, 0, 0]} maxBarSize={28} />
          </ComposedChart>
        </ResponsiveContainer>

        {/* スクロールバー */}
        <div style={{ marginTop: 16, padding: '0 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 10, color: '#4f6080', whiteSpace: 'nowrap' }}>7日</span>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="range"
                min={7}
                max={30}
                step={1}
                value={numDays}
                onChange={e => setNumDays(Number(e.target.value))}
                style={{ width: '100%' }}
                className="analytics-slider"
              />
            </div>
            <span style={{ fontSize: 10, color: '#4f6080', whiteSpace: 'nowrap' }}>30日</span>
          </div>
          <div style={{ textAlign: 'center', marginTop: 4, fontSize: 10, color: '#4f6080' }}>
            ← 絞り込む　　スライダーで表示期間を変更　　広げる →
          </div>
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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }

        .analytics-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border-radius: 2px;
          background: linear-gradient(
            to right,
            #4f8ef7 0%,
            #4f8ef7 ${((numDays - 7) / 23) * 100}%,
            rgba(255,255,255,0.08) ${((numDays - 7) / 23) * 100}%,
            rgba(255,255,255,0.08) 100%
          );
          outline: none;
          cursor: pointer;
        }
        .analytics-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #4f8ef7;
          border: 2px solid #131929;
          box-shadow: 0 0 8px rgba(79,142,247,0.5);
          cursor: pointer;
          transition: box-shadow 0.15s;
        }
        .analytics-slider::-webkit-slider-thumb:hover {
          box-shadow: 0 0 14px rgba(79,142,247,0.8);
        }
        .analytics-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #4f8ef7;
          border: 2px solid #131929;
          box-shadow: 0 0 8px rgba(79,142,247,0.5);
          cursor: pointer;
        }
        .analytics-slider::-moz-range-track {
          height: 4px;
          border-radius: 2px;
          background: rgba(255,255,255,0.08);
        }
      `}</style>
    </div>
  )
}
