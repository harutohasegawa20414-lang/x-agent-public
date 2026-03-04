import React, { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, Copy, Power, X, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { api } from '../hooks/useApi.js'

const DEFAULT_WEIGHTS = {
  profile_match: 30,
  post_match: 25,
  hashtag_match: 15,
  follower_range: 15,
  engagement: 15,
}

const EMPTY_FORM = {
  name: '', description: '',
  profile_keywords: [], post_keywords: [], hashtags: [], exclude_keywords: [],
  follower_min: 0, follower_max: 1000000,
  post_frequency_min: 0, last_post_days_max: 0, engagement_threshold: 0.0,
  is_verified_only: false,
  score_weights: { ...DEFAULT_WEIGHTS },
  dm_template_id: '',
  auto_replenish: true,
  replenish_threshold: 5,
}

function TagInput({ label, value, onChange }) {
  const [input, setInput] = useState('')
  const add = () => {
    const v = input.trim()
    if (v && !value.includes(v)) { onChange([...value, v]); setInput('') }
  }
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, color: '#7481a0', marginBottom: 5, fontWeight: 500 }}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        {value.map(tag => (
          <span key={tag} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 8px', borderRadius: 20,
            background: 'rgba(79,142,247,0.12)', border: '1px solid rgba(79,142,247,0.25)',
            fontSize: 11, color: '#7db3fc',
          }}>
            {tag}
            <button onClick={() => onChange(value.filter(t => t !== tag))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7db3fc', padding: 0, lineHeight: 1 }}>
              <X size={9} />
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder="入力してEnter"
          style={{ flex: 1, padding: '6px 10px', fontSize: 12 }} />
        <button onClick={add} className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }}>追加</button>
      </div>
    </div>
  )
}

function StatBadge({ label, value, color = '#4f8ef7' }) {
  return (
    <span style={{ fontSize: 11, color: '#7481a0' }}>
      {label}: <span style={{ color }}>{value}</span>
    </span>
  )
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState([])
  const [templates, setTemplates] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showWeights, setShowWeights] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const load = async () => {
    const [cats, tmpls] = await Promise.all([api.getCategories(), api.getTemplates()])
    setCategories(cats); setTemplates(tmpls)
  }
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY_FORM, score_weights: { ...DEFAULT_WEIGHTS } }); setShowWeights(false); setShowModal(true) }
  const openEdit = (cat) => {
    setEditing(cat)
    setForm({
      name: cat.name, description: cat.description,
      profile_keywords: cat.conditions.profile_keywords,
      post_keywords: cat.conditions.post_keywords,
      hashtags: cat.conditions.hashtags,
      exclude_keywords: cat.conditions.exclude_keywords,
      follower_min: cat.conditions.follower_min,
      follower_max: cat.conditions.follower_max,
      post_frequency_min: cat.conditions.post_frequency_min ?? 0,
      last_post_days_max: cat.conditions.last_post_days_max ?? 0,
      engagement_threshold: cat.conditions.engagement_threshold,
      is_verified_only: cat.conditions.is_verified_only ?? false,
      score_weights: { ...DEFAULT_WEIGHTS, ...cat.score_weights },
      dm_template_id: cat.dm_template_id ?? '',
      auto_replenish: cat.auto_replenish ?? true,
      replenish_threshold: cat.replenish_threshold ?? 5,
    })
    setShowWeights(false); setShowModal(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const weights = Object.fromEntries(
        Object.entries(form.score_weights).map(([k, v]) => [k, Number(v)])
      )
      const conditions = {
        profile_keywords: form.profile_keywords,
        post_keywords: form.post_keywords,
        hashtags: form.hashtags,
        exclude_keywords: form.exclude_keywords,
        follower_min: Number(form.follower_min),
        follower_max: Number(form.follower_max),
        post_frequency_min: Number(form.post_frequency_min),
        last_post_days_max: Number(form.last_post_days_max),
        engagement_threshold: Number(form.engagement_threshold),
        is_verified_only: form.is_verified_only,
      }
      if (editing) {
        await api.updateCategory(editing.id, {
          name: form.name, description: form.description,
          conditions, score_weights: weights,
          dm_template_id: form.dm_template_id || null,
          auto_replenish: form.auto_replenish,
          replenish_threshold: Number(form.replenish_threshold),
        })
      } else {
        await api.createCategory({
          name: form.name, description: form.description,
          ...conditions,
          is_verified_only: form.is_verified_only,
          score_weights: weights, dm_template_id: form.dm_template_id || null,
          auto_replenish: form.auto_replenish,
          replenish_threshold: Number(form.replenish_threshold),
        })
      }
      await load(); setShowModal(false)
      setMsg(editing ? 'カテゴリを更新しました' : 'カテゴリを作成しました')
      setTimeout(() => setMsg(null), 3000)
    } catch (e) { setMsg('エラー: ' + e.message) }
    setSaving(false)
  }

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setWeight = (k, v) => setForm(f => ({ ...f, score_weights: { ...f.score_weights, [k]: v } }))
  const handleDelete = async (id) => { if (!confirm('削除しますか？')) return; await api.deleteCategory(id); load() }
  const handleToggle = async (id) => { await api.toggleCategory(id); load() }
  const handleDuplicate = async (id) => { await api.duplicateCategory(id); load() }
  const handleReplenish = async (id, name) => {
    setMsg(`「${name}」のターゲットを補充中...`)
    try {
      const r = await api.triggerReplenish(id)
      setMsg(`「${name}」: ${r.added}件追加（検索: ${r.found}件 / KW: ${r.keyword}）`)
      await load()
    } catch (e) { setMsg('補充エラー: ' + e.message) }
    setTimeout(() => setMsg(null), 5000)
  }

  const handleGraduate = async (id, name) => {
    if (!confirm(`「${name}」をテストモードから卒業させますか？`)) return
    await api.graduateCategory(id); load()
    setMsg(`「${name}」が通常運用に移行しました`)
    setTimeout(() => setMsg(null), 3000)
  }

  return (
    <div style={{ padding: '32px 36px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'white' }}>カテゴリ管理</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#7481a0' }}>ターゲットカテゴリの作成・編集・複製</p>
        </div>
        <button onClick={openCreate} className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', fontSize: 13 }}>
          <Plus size={14} />新規カテゴリ
        </button>
      </div>

      {msg && (
        <div style={{
          marginBottom: 20, padding: '10px 16px', borderRadius: 10, fontSize: 13,
          background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80',
        }}>{msg}</div>
      )}

      {categories.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#4a5568' }}>
          <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>⊕</div>
          <p style={{ fontSize: 14 }}>カテゴリがありません。「新規カテゴリ」から作成してください。</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {categories.map(cat => (
            <div key={cat.id} className="card card-hover" style={{ padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: 'white', fontSize: 14 }}>{cat.name}</span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                      background: cat.enabled ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      color: cat.enabled ? '#4ade80' : '#f87171',
                      border: `1px solid ${cat.enabled ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                    }}>
                      {cat.enabled ? '有効' : '無効'}
                    </span>
                    {cat.test_mode && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                        background: 'rgba(251,191,36,0.1)', color: '#fbbf24',
                        border: '1px solid rgba(251,191,36,0.25)',
                      }}>
                        🧪 テスト運用中（上限{cat.test_mode_limit}件/日）
                      </span>
                    )}
                  </div>
                  {cat.description && (
                    <p style={{ margin: '0 0 8px', fontSize: 12, color: '#7481a0' }}>{cat.description}</p>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                    {cat.conditions.profile_keywords.slice(0, 5).map(kw => (
                      <span key={kw} style={{
                        padding: '1px 8px', borderRadius: 20, fontSize: 11,
                        background: 'rgba(79,142,247,0.1)', color: '#7db3fc',
                        border: '1px solid rgba(79,142,247,0.15)',
                      }}>{kw}</span>
                    ))}
                    {cat.conditions.profile_keywords.length > 5 && (
                      <span style={{ fontSize: 11, color: '#4a5568' }}>+{cat.conditions.profile_keywords.length - 5}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <StatBadge label="送信" value={cat.stats.total_sent} />
                    <StatBadge label="返信" value={cat.stats.total_replied} color="#22c55e" />
                    <StatBadge label="返信率" value={`${cat.stats.reply_rate}%`} color="#f59e0b" />
                    <StatBadge label="フォロワー" value={`${cat.conditions.follower_min.toLocaleString()}〜${cat.conditions.follower_max.toLocaleString()}`} color="#94a3b8" />
                    {cat.dm_template_id && (() => {
                      const t = templates.find(t => t.id === cat.dm_template_id)
                      return t ? <StatBadge label="テンプレ" value={t.name} color="#818cf8" /> : null
                    })()}
                    <StatBadge label="補充閾値" value={`${cat.replenish_threshold ?? 5}件`} color={cat.auto_replenish ? '#4ade80' : '#4a5568'} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                  {cat.auto_replenish !== false && (
                    <button onClick={() => handleReplenish(cat.id, cat.name)} title="今すぐターゲット補充"
                      style={{
                        padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                        background: 'rgba(34,197,94,0.08)', color: '#4ade80',
                        border: '1px solid rgba(34,197,94,0.2)',
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                      <RefreshCw size={10} />補充
                    </button>
                  )}
                  {cat.test_mode && (
                    <button onClick={() => handleGraduate(cat.id, cat.name)} title="テストモード卒業"
                      style={{
                        padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                        background: 'rgba(251,191,36,0.1)', color: '#fbbf24',
                        border: '1px solid rgba(251,191,36,0.25)',
                      }}>
                      卒業
                    </button>
                  )}
                  {[
                    { onClick: () => handleToggle(cat.id), icon: Power, color: cat.enabled ? '#22c55e' : '#7481a0', title: cat.enabled ? '無効化' : '有効化' },
                    { onClick: () => openEdit(cat), icon: Edit2, color: '#7db3fc', title: '編集' },
                    { onClick: () => handleDuplicate(cat.id), icon: Copy, color: '#94a3b8', title: '複製' },
                    { onClick: () => handleDelete(cat.id), icon: Trash2, color: '#ef4444', title: '削除' },
                  ].map(({ onClick, icon: Icon, color, title }) => (
                    <button key={title} onClick={onClick} title={title} className="btn-ghost"
                      style={{ padding: '7px', borderRadius: 8, color }}>
                      <Icon size={13} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', padding: '28px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'white' }}>
                {editing ? 'カテゴリ編集' : '新規カテゴリ作成'}
              </h2>
              <button onClick={() => setShowModal(false)} className="btn-ghost" style={{ padding: 6, borderRadius: 7 }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[['name', 'カテゴリ名 *', 'text'], ['description', '説明', 'text']].map(([k, l]) => (
                <div key={k}>
                  <label style={{ display: 'block', fontSize: 11, color: '#7481a0', marginBottom: 5, fontWeight: 500 }}>{l}</label>
                  <input value={form[k]} onChange={e => setField(k, e.target.value)}
                    style={{ width: '100%', padding: '9px 12px', fontSize: 13 }} />
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <TagInput label="プロフィールキーワード" value={form.profile_keywords} onChange={v => setField('profile_keywords', v)} />
                <TagInput label="投稿キーワード" value={form.post_keywords} onChange={v => setField('post_keywords', v)} />
                <TagInput label="ハッシュタグ (#不要)" value={form.hashtags} onChange={v => setField('hashtags', v)} />
                <TagInput label="除外キーワード" value={form.exclude_keywords} onChange={v => setField('exclude_keywords', v)} />
              </div>
              {/* 数値条件 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {[
                  ['follower_min', 'フォロワー最小', '1'],
                  ['follower_max', 'フォロワー最大', '1'],
                  ['engagement_threshold', 'エンゲージメント閾値(%)', '0.1'],
                  ['post_frequency_min', '最低投稿数（0=制限なし）', '1'],
                  ['last_post_days_max', '最終投稿から最大N日（0=制限なし）', '1'],
                ].map(([k, l, step]) => (
                  <div key={k}>
                    <label style={{ display: 'block', fontSize: 11, color: '#7481a0', marginBottom: 5, fontWeight: 500 }}>{l}</label>
                    <input type="number" step={step}
                      value={form[k]} onChange={e => setField(k, e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', fontSize: 13 }} />
                  </div>
                ))}
              </div>


              {/* 青バッジフィルター */}
              <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(79,142,247,0.04)', border: '1px solid rgba(79,142,247,0.12)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#7db3fc', marginBottom: 2 }}>✓ 認証済みアカウント（青バッジ）のみ</div>
                    <div style={{ fontSize: 11, color: '#7481a0' }}>ONにすると未認証アカウントは検索結果から完全除外されます</div>
                  </div>
                  <div onClick={() => setField('is_verified_only', !form.is_verified_only)} style={{
                    width: 38, height: 20, borderRadius: 10, position: 'relative', cursor: 'pointer', flexShrink: 0,
                    background: form.is_verified_only ? 'linear-gradient(135deg,#4f8ef7,#3b6fd4)' : 'rgba(255,255,255,0.1)',
                    transition: 'background 0.2s',
                  }}>
                    <div style={{
                      position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%',
                      background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                      left: form.is_verified_only ? 20 : 2,
                    }} />
                  </div>
                </div>
              </div>

              {/* スコア重み付け（折りたたみ） */}
              <div>
                <button type="button" onClick={() => setShowWeights(v => !v)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0',
                  fontSize: 12, fontWeight: 600, color: '#7481a0',
                }}>
                  {showWeights ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  スコア重み付け設定（合計100推奨）
                </button>
                {showWeights && (
                  <div style={{ marginTop: 10, padding: '16px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
                      {[
                        ['profile_match', 'プロフィール'],
                        ['post_match', '投稿KW'],
                        ['hashtag_match', 'ハッシュタグ'],
                        ['follower_range', 'フォロワー'],
                        ['engagement', 'エンゲージ'],
                      ].map(([k, l]) => (
                        <div key={k} style={{ textAlign: 'center' }}>
                          <label style={{ display: 'block', fontSize: 10, color: '#7481a0', marginBottom: 4 }}>{l}</label>
                          <input type="number" min="0" max="100" value={form.score_weights[k] ?? 0}
                            onChange={e => setWeight(k, e.target.value)}
                            style={{ width: '100%', padding: '7px 6px', fontSize: 13, textAlign: 'center' }} />
                        </div>
                      ))}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: '#4a5568', textAlign: 'right' }}>
                      合計: <span style={{
                        color: Object.values(form.score_weights).reduce((s, v) => s + Number(v), 0) === 100 ? '#4ade80' : '#f59e0b',
                        fontWeight: 600,
                      }}>{Object.values(form.score_weights).reduce((s, v) => s + Number(v), 0)}</span> / 100
                    </div>
                  </div>
                )}
              </div>

              {/* 自動補充設定 */}
              <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.12)' }}>
                <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 600, marginBottom: 10 }}>🔄 自動ターゲット補充</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>pending が閾値以下になったら自動補充</span>
                  <div onClick={() => setField('auto_replenish', !form.auto_replenish)} style={{
                    width: 38, height: 20, borderRadius: 10, position: 'relative', cursor: 'pointer',
                    background: form.auto_replenish ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'rgba(255,255,255,0.1)',
                    transition: 'background 0.2s', flexShrink: 0,
                  }}>
                    <div style={{
                      position: 'absolute', top: 2, width: 16, height: 16, borderRadius: '50%',
                      background: 'white', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                      left: form.auto_replenish ? 20 : 2,
                    }} />
                  </div>
                </div>
                {form.auto_replenish && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <label style={{ fontSize: 12, color: '#7481a0' }}>補充トリガー閾値（pending件数）:</label>
                    <input type="number" min="1" max="50" value={form.replenish_threshold}
                      onChange={e => setField('replenish_threshold', e.target.value)}
                      style={{ width: 70, padding: '6px 10px', fontSize: 13 }} />
                    <span style={{ fontSize: 11, color: '#4a5568' }}>件未満で補充</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8 }}>
                <button onClick={() => setShowModal(false)} className="btn-ghost" style={{ padding: '9px 18px', fontSize: 13 }}>キャンセル</button>
                <button onClick={save} disabled={saving || !form.name} className="btn-primary" style={{ padding: '9px 20px', fontSize: 13 }}>
                  {saving ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
