import React, { useEffect, useState } from 'react'
import { AlertTriangle, Play, StopCircle, Save, Heart, Clock, RefreshCw, Link } from 'lucide-react'
import { api } from '../hooks/useApi.js'
import SourceSelector from '../components/SourceSelector.jsx'

export default function SettingsPage() {
  const [config, setConfig] = useState(null)
  const [health, setHealth] = useState(null)
  const [intervalStatus, setIntervalStatus] = useState(null)
  const [replenishStatus, setReplenishStatus] = useState(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [showSourceSelector, setShowSourceSelector] = useState(false)
  const [sourceStatus, setSourceStatus] = useState(null)

  const load = async () => {
    const [c, h, iv, rs, ss] = await Promise.all([
      api.getSendConfig(), api.getHealthScore(),
      api.getSendIntervalStatus(), api.getReplenishStatus(),
      api.getSourceStatus(),
    ])
    setConfig(c); setHealth(h); setIntervalStatus(iv); setReplenishStatus(rs); setSourceStatus(ss)
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    setSaving(true)
    try {
      await api.updateSendConfig(config)
      setMsg('設定を保存しました')
    } catch (e) { setMsg('エラー: ' + e.message) }
    setSaving(false)
    setTimeout(() => setMsg(null), 3000)
  }

  const handleEmergencyStop = async () => {
    if (!confirm('緊急停止しますか？全てのDM送信が停止されます。')) return
    await api.emergencyStop(); load()
    setMsg('緊急停止しました')
    setTimeout(() => setMsg(null), 3000)
  }

  const handleResume = async () => {
    await api.resumeSending(); load()
    setMsg('送信を再開しました')
    setTimeout(() => setMsg(null), 3000)
  }

  if (!config) return (
    <div style={{ padding: '32px 36px', fontSize: 13, color: '#7481a0' }}>読み込み中...</div>
  )

  const healthColor = !health ? '#7481a0'
    : health.score >= 80 ? '#22c55e'
    : health.score >= 50 ? '#f59e0b'
    : '#ef4444'

  return (
    <div style={{ padding: '32px 36px', maxWidth: 680 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'white' }}>設定</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#7481a0' }}>送信制御・安全管理</p>
      </div>

      {msg && (
        <div style={{
          marginBottom: 20, padding: '10px 16px', borderRadius: 10, fontSize: 13,
          background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80',
        }}>{msg}</div>
      )}

      {/* Health */}
      <div className="card" style={{ padding: '22px 26px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <Heart size={14} style={{ color: healthColor }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>アカウント健全度</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 44, fontWeight: 800, lineHeight: 1, color: healthColor }}>{health?.score ?? '—'}</span>
          <div style={{ paddingBottom: 5 }}>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>/ 100</div>
            <div style={{ fontSize: 12, color: healthColor, fontWeight: 600 }}>{health?.status}</div>
          </div>
        </div>
        <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', marginBottom: 16, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 3, width: `${health?.score ?? 0}%`,
            background: `linear-gradient(90deg, ${healthColor}66, ${healthColor})`,
          }} />
        </div>
        <div style={{ fontSize: 11, color: '#4a5568', lineHeight: 2, marginBottom: 12 }}>
          直近7日 送信: <span style={{ color: '#94a3b8' }}>{health?.details?.recent_sent ?? 0}</span> ／
          失敗: <span style={{ color: '#94a3b8' }}>{health?.details?.recent_failed ?? 0}</span> ／
          日平均: <span style={{ color: '#94a3b8' }}>{health?.details?.daily_avg ?? 0}</span> ／
          拒否率: <span style={{ color: (health?.details?.rejection_rate ?? 0) > 15 ? '#f87171' : '#94a3b8' }}>
            {health?.details?.rejection_rate ?? 0}%
          </span>
        </div>

        {/* アラート一覧 */}
        {health?.alerts?.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
            {health.alerts.map((alert, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8,
                background: alert.level === 'danger' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                border: `1px solid ${alert.level === 'danger' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
              }}>
                <AlertTriangle size={12} style={{ color: alert.level === 'danger' ? '#ef4444' : '#f59e0b', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: alert.level === 'danger' ? '#f87171' : '#fbbf24' }}>{alert.message}</span>
              </div>
            ))}
          </div>
        )}

        {config.emergency_stop && !health?.alerts?.some(a => a.message.includes('緊急停止')) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 9,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 14,
          }}>
            <AlertTriangle size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>緊急停止中 — 全送信停止中</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={handleEmergencyStop} disabled={config.emergency_stop} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8,
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
            background: 'rgba(239,68,68,0.08)', color: '#f87171',
            border: '1px solid rgba(239,68,68,0.2)',
            opacity: config.emergency_stop ? 0.4 : 1,
          }}>
            <StopCircle size={13} />緊急停止
          </button>
          <button onClick={handleResume} disabled={!config.emergency_stop} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8,
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
            background: 'rgba(34,197,94,0.08)', color: '#4ade80',
            border: '1px solid rgba(34,197,94,0.2)',
            opacity: !config.emergency_stop ? 0.4 : 1,
          }}>
            <Play size={13} />送信再開
          </button>
        </div>
      </div>

      {/* URL Source */}
      <div className="card" style={{ padding: '22px 26px', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Link size={14} style={{ color: '#60a5fa' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>DM一次情報ソース</span>
          <span style={{ fontSize: 11, color: '#4a5568', marginLeft: 4 }}>（URLからDM生成の文脈を取得）</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>
            {sourceStatus?.url_count > 0
              ? `${sourceStatus.url_count} 件のURLを登録済み`
              : 'URLが未登録です。DM生成の精度を上げるためにURLを追加してください。'}
          </span>
          <button onClick={() => setShowSourceSelector(true)} style={{
            padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer',
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            border: 'none', color: 'white',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Link size={12} />URL管理
          </button>
        </div>
        {sourceStatus?.urls?.length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sourceStatus.urls.map((u, i) => (
              <div key={i} style={{ fontSize: 11, color: '#7481a0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {u.title || u.url}
              </div>
            ))}
          </div>
        )}
      </div>

      {showSourceSelector && (
        <SourceSelector
          onClose={() => setShowSourceSelector(false)}
          onSaved={() => { load(); setMsg('URLソースを更新しました'); setTimeout(() => setMsg(null), 3000) }}
        />
      )}

      {/* Replenish Status */}
      {replenishStatus && (
        <div className="card" style={{ padding: '22px 26px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <RefreshCw size={14} style={{ color: '#4ade80' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>自動ターゲット補充</span>
            <span style={{ fontSize: 11, color: '#4a5568', marginLeft: 4 }}>（10分ごとに自動チェック）</span>
          </div>

          {/* カテゴリ別 pending 状況 */}
          {replenishStatus.by_category.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {replenishStatus.by_category.map(cat => (
                <div key={cat.category_id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 8,
                  background: cat.needs_replenish ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${cat.needs_replenish ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.07)'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: cat.needs_replenish ? '#fbbf24' : '#94a3b8' }}>{cat.category_name}</span>
                    {!cat.auto_replenish && (
                      <span style={{ fontSize: 10, color: '#4a5568' }}>自動補充OFF</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, color: '#7481a0' }}>閾値 {cat.replenish_threshold}</span>
                    <span style={{
                      fontSize: 13, fontWeight: 700,
                      color: cat.needs_replenish ? '#f59e0b' : '#4ade80',
                    }}>
                      {cat.pending} pending
                    </span>
                    {cat.needs_replenish && (
                      <span style={{ fontSize: 10, color: '#fbbf24' }}>⚠ 補充予定</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 補充ログ（最新5件） */}
          {replenishStatus.log.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: '#4a5568', marginBottom: 6 }}>最近の補充履歴</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[...replenishStatus.log].reverse().slice(0, 5).map((entry, i) => (
                  <div key={i} style={{ fontSize: 11, color: '#7481a0', lineHeight: 1.8 }}>
                    {entry.at?.slice(0, 16).replace('T', ' ')} —
                    <span style={{ color: '#94a3b8' }}> {entry.category_name}</span>:
                    <span style={{ color: '#4ade80' }}> +{entry.added}件</span>
                    （KW: {entry.keyword}）
                  </div>
                ))}
              </div>
            </div>
          )}

          {replenishStatus.log.length === 0 && replenishStatus.by_category.length > 0 && (
            <p style={{ margin: 0, fontSize: 12, color: '#4a5568' }}>
              自動送信を有効にすると、pending ターゲットが閾値を下回った際に自動補充されます。
            </p>
          )}
        </div>
      )}

      {/* Interval Status */}
      {intervalStatus && (
        <div className="card" style={{ padding: '22px 26px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Clock size={14} style={{ color: '#818cf8' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>送信間隔ステータス</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 11, color: '#7481a0', marginBottom: 4 }}>次回送信まで</div>
              <div style={{
                fontSize: 20, fontWeight: 700,
                color: intervalStatus.can_send_now ? '#22c55e' : '#f59e0b',
              }}>
                {intervalStatus.can_send_now ? '送信可能' : `${intervalStatus.wait_seconds}秒`}
              </div>
            </div>
            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 11, color: '#7481a0', marginBottom: 4 }}>最終送信</div>
              <div style={{ fontSize: 13, color: '#94a3b8' }}>
                {intervalStatus.last_sent_at ? intervalStatus.last_sent_at.slice(0, 16).replace('T', ' ') : '—'}
              </div>
            </div>
          </div>
          {intervalStatus.last_interval_seconds && (
            <div style={{ marginTop: 10, fontSize: 11, color: '#4a5568' }}>
              前回のランダム間隔: {intervalStatus.last_interval_seconds}秒
            </div>
          )}
        </div>
      )}

      {/* Send Config */}
      <div className="card" style={{ padding: '22px 26px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'white', marginBottom: 20 }}>送信制御設定</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>送信を有効化</span>
            <div onClick={() => setConfig(c => ({ ...c, enabled: !c.enabled }))} style={{
              width: 42, height: 22, borderRadius: 11, position: 'relative', cursor: 'pointer',
              background: config.enabled ? 'linear-gradient(135deg,#4f8ef7,#6366f1)' : 'rgba(255,255,255,0.1)',
              transition: 'background 0.2s', flexShrink: 0,
            }}>
              <div style={{
                position: 'absolute', top: 2, width: 18, height: 18, borderRadius: '50%',
                background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                left: config.enabled ? 22 : 2,
              }} />
            </div>
          </div>

          {/* Number fields */}
          {[
            ['daily_limit', '日次送信上限 (件)'],
            ['per_category_daily_limit', 'カテゴリ別日次上限 (件)'],
            ['min_interval_seconds', '最小送信間隔 (秒)'],
            ['max_interval_seconds', '最大送信間隔 (秒)'],
          ].map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: 13, color: '#94a3b8' }}>{label}</label>
              <input type="number" value={config[key]}
                onChange={e => setConfig(c => ({ ...c, [key]: Number(e.target.value) }))}
                style={{ width: 90, padding: '7px 10px', fontSize: 13, textAlign: 'right' }} />
            </div>
          ))}
        </div>

        <button onClick={save} disabled={saving} className="btn-primary"
          style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', fontSize: 13 }}>
          <Save size={13} />{saving ? '保存中...' : '設定を保存'}
        </button>
      </div>

    </div>
  )
}
