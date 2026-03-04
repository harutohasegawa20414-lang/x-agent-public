import React, { useEffect, useState } from 'react'
import { Send, Reply, Users, TrendingUp, AlertTriangle, RefreshCw, Heart, ArrowUpRight, Zap, ZapOff } from 'lucide-react'
import { api } from '../../hooks/useApi.js'

function KPICard({ label, value, sub, icon: Icon, color = '#4f8ef7', trend }) {
  return (
    <div className="card card-hover" style={{ padding: '22px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: `${color}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `1px solid ${color}30`,
        }}>
          <Icon size={17} style={{ color }} />
        </div>
        {trend !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, color: '#22c55e' }}>
            <ArrowUpRight size={12} />
            <span>{trend}</span>
          </div>
        )}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 4, lineHeight: 1 }}>
        {value ?? '—'}
      </div>
      <div style={{ fontSize: 12, color: '#7481a0', fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#4a5568', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function DashboardPage() {
  const [overview, setOverview] = useState(null)
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)
  const [autoSend, setAutoSend] = useState({ enabled: false, pending: 0, waitSeconds: 0, canSendNow: true })

  const load = async () => {
    setLoading(true)
    try {
      const [ov, he, as_] = await Promise.all([
        api.getOverview(),
        api.getHealthScore(),
        api.getAutoSendStatus(),
      ])
      setOverview(ov)
      setHealth(he)
      setAutoSend({
        enabled: as_.auto_send_enabled,
        pending: as_.pending_targets,
        waitSeconds: as_.wait_seconds,
        canSendNow: as_.can_send_now,
      })
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const handleToggleAutoSend = async () => {
    if (autoSend.enabled) {
      await api.disableAutoSend()
    } else {
      if (!confirm('自動送信を開始しますか？\nスコアの高い pending ターゲットへ、2〜10分のランダム間隔でDMを送信し続けます。')) return
      await api.enableAutoSend()
    }
    const s = await api.getAutoSendStatus()
    setAutoSend({ enabled: s.auto_send_enabled, pending: s.pending_targets, waitSeconds: s.wait_seconds, canSendNow: s.can_send_now })
  }

  useEffect(() => { load() }, [])

  const healthColor = !health ? '#7481a0'
    : health.score >= 80 ? '#22c55e'
    : health.score >= 50 ? '#f59e0b'
    : '#ef4444'

  return (
    <div style={{ padding: '32px 36px', minHeight: '100%' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, lineHeight: 1.15 }}>
            <span className="gradient-title">X営業入口</span>
            <span style={{ color: 'white' }}> 最適化システム</span>
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#7481a0' }}>
            No.9 ｜ ターゲット発掘・DM自動化・返信管理
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* 自動送信トグル */}
          <button onClick={handleToggleAutoSend} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 16px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: autoSend.enabled ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)',
            color: autoSend.enabled ? '#4ade80' : '#7481a0',
            border: `1px solid ${autoSend.enabled ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.12)'}`,
            transition: 'all 0.2s',
          }}>
            {autoSend.enabled
              ? <Zap size={13} style={{ color: '#4ade80' }} />
              : <ZapOff size={13} style={{ color: '#7481a0' }} />
            }
            {autoSend.enabled ? '自動送信 ON' : '自動送信 OFF'}
            {autoSend.enabled && (
              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>
                {autoSend.pending > 0
                  ? `/ ${autoSend.pending}件待機`
                  : '/ ターゲット不足'}
              </span>
            )}
          </button>

          {/* 更新 */}
          <button onClick={load} className="btn-ghost"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', fontSize: 13 }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            更新
          </button>
        </div>
      </div>

      {/* ── KPI ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <KPICard label="総送信数" value={overview?.total_sent?.toLocaleString() ?? '0'}
          sub="DM送信累計" icon={Send} color="#4f8ef7" />
        <KPICard label="有効返信数" value={overview?.total_replied?.toLocaleString() ?? '0'}
          sub={`返信率 ${overview?.reply_rate ?? 0}%`} icon={Reply} color="#818cf8" />
        <KPICard label="ターゲット数" value={overview?.total_targets?.toLocaleString() ?? '0'}
          sub={`${overview?.total_categories ?? 0} カテゴリ`} icon={Users} color="#06b6d4" />
        <KPICard label="商談化率" value={`${overview?.deal_rate ?? 0}%`}
          sub={`転換率 ${overview?.conversion_rate ?? 0}%`} icon={TrendingUp} color="#22c55e" />
      </div>

      {/* ── Health Card（全幅） ── */}
      <div className="card" style={{ padding: '20px 28px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Heart size={14} style={{ color: healthColor }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'white', whiteSpace: 'nowrap' }}>アカウント健全度</span>
        </div>
        {health && (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
              <span style={{ fontSize: 40, fontWeight: 800, color: healthColor, lineHeight: 1 }}>{health.score}</span>
              <span style={{ fontSize: 12, color: '#7481a0', paddingBottom: 4 }}>/ 100</span>
            </div>
            <div style={{ flex: 1, maxWidth: 200 }}>
              <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 3, width: `${health.score}%`, background: `linear-gradient(90deg, ${healthColor}88, ${healthColor})`, transition: 'width 0.6s ease' }} />
              </div>
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 12px', borderRadius: 20,
              background: `${healthColor}18`, border: `1px solid ${healthColor}30`,
              fontSize: 12, fontWeight: 600, color: healthColor,
            }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: healthColor }} />
              {health.status}
            </div>
            <div style={{ display: 'flex', gap: 24, fontSize: 12, color: '#7481a0' }}>
              <span>直近7日 送信: <span style={{ color: '#94a3b8', fontWeight: 600 }}>{health.details?.recent_sent ?? 0}</span></span>
              <span>失敗: <span style={{ color: '#94a3b8', fontWeight: 600 }}>{health.details?.recent_failed ?? 0}</span></span>
              <span>日平均: <span style={{ color: '#94a3b8', fontWeight: 600 }}>{health.details?.daily_avg ?? 0}</span></span>
            </div>
            {health.details?.emergency_stop && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#ef4444' }}>
                <AlertTriangle size={11} /> 緊急停止中
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Alert ── */}
      {overview?.pending_human > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 20px', borderRadius: 12,
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.25)',
        }}>
          <AlertTriangle size={15} style={{ color: '#f59e0b', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: '#fbbf24' }}>
            人間対応待ちの返信が <strong>{overview.pending_human}</strong> 件あります。「返信管理」から確認してください。
          </span>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
