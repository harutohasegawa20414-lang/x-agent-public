import React, { useEffect, useState } from 'react'
import { Search, Users, Star, Ban, ExternalLink, RefreshCw, ChevronDown, Trash2 } from 'lucide-react'
import { api } from '../../hooks/useApi.js'

const STATUS_CONFIG = {
  pending:     { label: '未送信',         color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',  border: 'rgba(148,163,184,0.2)' },
  dm_sent:     { label: 'DM送信済',       color: '#7db3fc', bg: 'rgba(79,142,247,0.1)',   border: 'rgba(79,142,247,0.2)' },
  replied:     { label: '返信あり',       color: '#4ade80', bg: 'rgba(34,197,94,0.1)',    border: 'rgba(34,197,94,0.2)' },
  converted:   { label: '商談化',         color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',   border: 'rgba(251,191,36,0.2)' },
  blacklisted: { label: 'ブラックリスト', color: '#f87171', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.2)' },
}

const DEAL_RESULT_CONFIG = {
  won:          { label: '✅ 成約',         color: '#4ade80' },
  lost:         { label: '❌ 失注',         color: '#f87171' },
  pending_deal: { label: '⏳ 保留',         color: '#f59e0b' },
  continuing:   { label: '🔄 継続フォロー', color: '#818cf8' },
}

function Badge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  return (
    <span style={{
      padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 500,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
    }}>{cfg.label}</span>
  )
}

export default function TargetsPage() {
  const [targets, setTargets] = useState([])
  const [categories, setCategories] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [filter, setFilter] = useState({ category_id: '', status: '' })
  const [searchForm, setSearchForm] = useState({ keyword: '', category_id: '', max_results: 20, score_threshold: 0, search_mode: 'profile' })
  const [searchResult, setSearchResult] = useState(null)
  const [msg, setMsg] = useState(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [cats, ts, st] = await Promise.all([api.getCategories(), api.getTargets(filter), api.getTargetStats()])
      setCategories(cats); setTargets(ts); setStats(st)
    } catch (e) { console.error(e) }
    setLoading(false)
  }
  useEffect(() => { loadData() }, [])

  const handleSearch = async () => {
    if (!searchForm.keyword || !searchForm.category_id) return
    setSearching(true); setSearchResult(null)
    try {
      const result = await api.searchTargets(searchForm)
      setSearchResult(result)
      setMsg(`${result.added}件追加（検索: ${result.found}件 / スコア通過: ${result.scored}件）`)
      await loadData()
      setTimeout(() => setMsg(null), 5000)
    } catch (e) { setMsg('エラー: ' + e.message) }
    setSearching(false)
  }

  const handleBlacklist = async (target) => {
    if (!confirm(`@${target.username} をブラックリストに追加しますか？`)) return
    await api.addBlacklist({ user_id: target.user_id, username: target.username, reason: 'ダッシュボードから追加' })
    loadData()
  }

  const handleDealResult = async (target, deal_result) => {
    await api.updateDealResult(target.id, deal_result)
    loadData()
  }

  const handleDelete = async (target) => {
    if (!confirm(`@${target.username} を削除しますか？`)) return
    await api.deleteTarget(target.id)
    loadData()
  }

  const handleDeleteAll = async () => {
    if (!confirm(`全ターゲット（${targets.length}件）を削除しますか？\nこの操作は取り消せません。`)) return
    const res = await api.deleteAllTargets()
    setMsg(`${res.deleted}件のターゲットを削除しました`)
    setTimeout(() => setMsg(null), 4000)
    loadData()
  }

  const statItems = stats ? [
    { label: '全ターゲット', val: stats.total, color: '#94a3b8' },
    { label: '未送信', val: stats.pending, color: '#7db3fc' },
    { label: 'DM送信済', val: stats.dm_sent, color: '#818cf8' },
    { label: '返信あり', val: stats.replied, color: '#4ade80' },
  ] : []

  return (
    <div style={{ padding: '32px 36px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'white' }}>ターゲット管理</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#7481a0' }}>X ユーザーの検索・スコアリング・DM管理</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={loadData} className="btn-ghost" style={{ padding: '8px 10px' }}>
            <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          {targets.length > 0 && (
            <button onClick={handleDeleteAll} className="btn-ghost"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', fontSize: 13, color: '#f87171', borderColor: 'rgba(239,68,68,0.25)' }}>
              <Trash2 size={13} />全削除
            </button>
          )}
          <button onClick={() => setShowSearch(!showSearch)} className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', fontSize: 13 }}>
            <Search size={13} />ユーザー検索
            <ChevronDown size={12} style={{ transform: showSearch ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
          </button>
        </div>
      </div>

      {msg && (
        <div style={{
          marginBottom: 20, padding: '10px 16px', borderRadius: 10, fontSize: 13,
          background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80',
        }}>{msg}</div>
      )}

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {statItems.map(({ label, val, color }) => (
          <div key={label} className="card" style={{ padding: '16px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color, marginBottom: 3 }}>{val ?? 0}</div>
            <div style={{ fontSize: 11, color: '#7481a0' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Search Panel */}
      {showSearch && (
        <div className="card" style={{ padding: '20px 24px', marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 600, color: 'white' }}>
            キーワードでユーザーを検索 & スコアリング
          </h3>
          {/* 検索モード切替 */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 12, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', width: 'fit-content' }}>
            {[
              { value: 'profile', label: 'プロフィール検索' },
              { value: 'tweet', label: 'ツイート検索' },
            ].map(({ value, label }) => (
              <button key={value}
                onClick={() => setSearchForm(f => ({ ...f, search_mode: value }))}
                style={{
                  padding: '7px 18px', fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer',
                  background: searchForm.search_mode === value ? 'rgba(79,142,247,0.2)' : 'transparent',
                  color: searchForm.search_mode === value ? '#7db3fc' : '#7481a0',
                  borderRight: value === 'profile' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                }}>
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            <input value={searchForm.keyword} onChange={e => setSearchForm(f => ({ ...f, keyword: e.target.value }))}
              placeholder="キーワード（例: 経営者 起業）"
              style={{ padding: '9px 12px', fontSize: 13 }} />
            <select value={searchForm.category_id} onChange={e => setSearchForm(f => ({ ...f, category_id: e.target.value }))}
              style={{ padding: '9px 12px', fontSize: 13 }}>
              <option value="">カテゴリ選択</option>
              {categories.filter(c => c.enabled).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="number" value={searchForm.max_results} onChange={e => setSearchForm(f => ({ ...f, max_results: Number(e.target.value) }))}
              placeholder="最大件数" style={{ padding: '9px 12px', fontSize: 13 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ fontSize: 12, color: '#7481a0', display: 'flex', alignItems: 'center', gap: 6 }}>
              スコア閾値:
              <input type="number" value={searchForm.score_threshold}
                onChange={e => setSearchForm(f => ({ ...f, score_threshold: Number(e.target.value) }))}
                style={{ width: 60, padding: '5px 8px', fontSize: 12 }} />
            </label>
            <button onClick={handleSearch} disabled={searching || !searchForm.keyword || !searchForm.category_id}
              className="btn-primary" style={{ padding: '9px 20px', fontSize: 13 }}>
              {searching ? '検索中...' : '検索・スコアリング'}
            </button>
          </div>
          {searchResult && (
            <div style={{
              marginTop: 12, padding: '10px 14px', borderRadius: 8, fontSize: 12,
              background: 'rgba(79,142,247,0.06)', border: '1px solid rgba(79,142,247,0.15)', color: '#94a3b8',
            }}>
              <span style={{
                display: 'inline-block', padding: '1px 7px', borderRadius: 4, fontSize: 10, marginRight: 8,
                background: searchResult.search_mode_used === 'profile' ? 'rgba(79,142,247,0.15)' : 'rgba(251,191,36,0.15)',
                color: searchResult.search_mode_used === 'profile' ? '#7db3fc' : '#fbbf24',
              }}>
                {searchResult.search_mode_used === 'profile' ? 'プロフィール検索' : 'ツイート検索'}
              </span>
              検索 {searchResult.found}件 → スコア通過 {searchResult.scored}件 → 新規追加 <span style={{ color: '#7db3fc' }}>{searchResult.added}件</span>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {[
          <select key="cat" value={filter.category_id} onChange={e => setFilter(f => ({ ...f, category_id: e.target.value }))}
            style={{ padding: '7px 12px', fontSize: 12 }}>
            <option value="">全カテゴリ</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>,
          <select key="st" value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}
            style={{ padding: '7px 12px', fontSize: 12 }}>
            <option value="">全ステータス</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>,
          <button key="btn" onClick={loadData} className="btn-ghost" style={{ padding: '7px 14px', fontSize: 12 }}>絞り込み</button>,
        ]}
      </div>

      {/* Target List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {targets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#4a5568' }}>
            <Users size={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 10px' }} />
            <p style={{ fontSize: 13 }}>ターゲットがありません</p>
          </div>
        ) : targets.map(t => {
          const catName = categories.find(c => c.id === t.category_id)?.name || ''
          return (
            <div key={t.id} className="card card-hover" style={{ padding: '14px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: 'white', fontSize: 13 }}>{t.name}</span>
                    <span style={{ fontSize: 12, color: '#4a5568' }}>@{t.username}</span>
                    <Badge status={t.status} />
                    {catName && (
                      <span style={{
                        padding: '1px 8px', borderRadius: 20, fontSize: 11,
                        background: 'rgba(99,102,241,0.1)', color: '#818cf8',
                        border: '1px solid rgba(99,102,241,0.15)',
                      }}>{catName}</span>
                    )}
                  </div>
                  <p style={{ margin: '0 0 4px', fontSize: 11, color: '#4a5568', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.bio?.slice(0, 90)}
                  </p>
                  <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#7481a0', flexWrap: 'wrap' }}>
                    <span>フォロワー: {t.followers_count?.toLocaleString()}</span>
                    <span>ER: {t.engagement_rate}%</span>
                    {t.dm_sent_at && <span>送信: {t.dm_sent_at.slice(0, 10)}</span>}
                    {t.search_keyword && <span>KW: {t.search_keyword}</span>}
                  </div>
                  {t.status === 'converted' && (
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: '#7481a0' }}>商談結果:</span>
                      <select value={t.deal_result || ''} onChange={e => handleDealResult(t, e.target.value)}
                        style={{ padding: '3px 8px', fontSize: 12, borderRadius: 6 }}>
                        <option value="">未設定</option>
                        {Object.entries(DEAL_RESULT_CONFIG).map(([k, v]) => (
                          <option key={k} value={k}>{v.label}</option>
                        ))}
                      </select>
                      {t.deal_result && (
                        <span style={{ fontSize: 12, color: DEAL_RESULT_CONFIG[t.deal_result]?.color }}>
                          {DEAL_RESULT_CONFIG[t.deal_result]?.label}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Star size={12} style={{ color: '#f59e0b' }} />
                    <span style={{ fontWeight: 700, color: 'white', fontSize: 14 }}>{t.score}</span>
                  </div>
                  <a href={t.profile_url || `https://x.com/${t.username}`} target="_blank" rel="noopener noreferrer"
                    className="btn-ghost" style={{ padding: '5px 10px', borderRadius: 7, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                    <ExternalLink size={11} />リンクに飛ぶ
                  </a>
                  <button onClick={() => handleBlacklist(t)} className="btn-ghost"
                    style={{ padding: '6px', borderRadius: 7, color: '#ef4444' }}>
                    <Ban size={12} />
                  </button>
                  <button onClick={() => handleDelete(t)} className="btn-ghost"
                    style={{ padding: '6px', borderRadius: 7, color: '#f87171', borderColor: 'rgba(239,68,68,0.2)' }}
                    title="削除">
                    <Trash2 size={12} />
                  </button>
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
