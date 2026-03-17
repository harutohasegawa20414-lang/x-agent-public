import React, { useState } from 'react'
import { BookOpen, Loader2, ChevronDown, Check, Trash2, Plus, Sparkles } from 'lucide-react'

const FrameworkExtractorPanel = ({
    globalFrameworks,
    selectedGlobalFrameworkId,
    onExtract,
    onSave,
    onDelete,
    onSelect,
}) => {
    const [showExtractForm, setShowExtractForm] = useState(false)
    const [xUsername, setXUsername] = useState('')
    const [isExtracting, setIsExtracting] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [candidates, setCandidates] = useState(null)
    const [checkedIds, setCheckedIds] = useState(new Set())
    const [expandedId, setExpandedId] = useState(null)

    const handleExtract = async () => {
        const username = xUsername.replace(/^@/, '').trim()
        if (!username) { alert('Xユーザー名を入力してください'); return }
        setIsExtracting(true)
        try {
            const result = await onExtract(username)
            const fws = result.frameworks || []
            setCandidates(fws)
            setCheckedIds(new Set(fws.map(fw => fw.id)))
            setExpandedId(null)
        } catch (err) {
            alert(`フレームワーク抽出に失敗しました: ${err.message}`)
        } finally {
            setIsExtracting(false)
        }
    }

    const toggleCheck = (id) => {
        setCheckedIds(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const handleSave = async () => {
        const selected = candidates.filter(fw => checkedIds.has(fw.id))
        if (selected.length === 0) { alert('1つ以上選択してください'); return }
        setIsSaving(true)
        try {
            await onSave(selected)
            setCandidates(null)
            setCheckedIds(new Set())
            setXUsername('')
            setShowExtractForm(false)
        } catch (err) {
            alert(`保存に失敗しました: ${err.message}`)
        } finally {
            setIsSaving(false)
        }
    }

    const handleCancel = () => {
        setCandidates(null)
        setCheckedIds(new Set())
        setExpandedId(null)
        setShowExtractForm(false)
        setXUsername('')
    }

    return (
        <div style={{ marginBottom: '1.25rem' }}>
            {/* セクションヘッダー */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
                <BookOpen size={14} style={{ color: '#a78bfa' }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#94a3b8' }}>
                    投稿フレームワーク
                </span>
                <span style={{ flex: 1 }} />
                {!showExtractForm && !candidates && (
                    <button
                        onClick={() => setShowExtractForm(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '5px',
                            fontSize: '0.75rem', fontWeight: 600,
                            padding: '4px 10px',
                            background: 'rgba(99,102,241,0.12)',
                            border: '1px solid rgba(99,102,241,0.3)',
                            borderRadius: '8px', color: '#a5b4fc', cursor: 'pointer',
                        }}
                    >
                        <Plus size={12} />
                        フレームワーク抽出
                    </button>
                )}
            </div>

            {/* 抽出フォーム */}
            {showExtractForm && !candidates && (
                <div style={{
                    background: 'rgba(15,23,50,0.8)',
                    border: '1px solid rgba(96,165,250,0.2)',
                    borderRadius: '12px',
                    padding: '1rem 1.25rem',
                    marginBottom: '0.75rem',
                }}>
                    <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: '#94a3b8' }}>
                        XユーザーのツイートからAIが投稿フレームワークを抽出します
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <span style={{
                                position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
                                fontSize: '0.85rem', color: '#64748b', fontWeight: 600, pointerEvents: 'none',
                            }}>@</span>
                            <input
                                type="text"
                                value={xUsername}
                                onChange={e => setXUsername(e.target.value.replace(/^@/, ''))}
                                placeholder="Xユーザー名（例: elonmusk）"
                                onKeyDown={e => e.key === 'Enter' && !isExtracting && handleExtract()}
                                autoFocus
                                style={{
                                    width: '100%',
                                    background: 'rgba(7,11,25,0.7)',
                                    border: '1px solid rgba(96,165,250,0.15)',
                                    borderRadius: '10px',
                                    color: '#e2e8f0',
                                    fontSize: '0.88rem',
                                    fontFamily: 'Inter, sans-serif',
                                    padding: '0.5rem 0.75rem 0.5rem 1.75rem',
                                    outline: 'none',
                                }}
                            />
                        </div>
                        <button
                            onClick={handleExtract}
                            disabled={isExtracting || !xUsername.trim()}
                            style={{
                                background: 'linear-gradient(135deg, #4c1d95, #6366f1)',
                                border: 'none', borderRadius: '10px', color: 'white',
                                fontSize: '0.85rem', fontWeight: 600,
                                padding: '0.5rem 1.1rem',
                                cursor: isExtracting || !xUsername.trim() ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: '6px',
                                whiteSpace: 'nowrap',
                                opacity: (isExtracting || !xUsername.trim()) ? 0.5 : 1,
                                fontFamily: 'Inter, sans-serif',
                            }}
                        >
                            {isExtracting
                                ? <><Loader2 size={14} className="animate-spin" />抽出中...</>
                                : <><Sparkles size={14} />抽出</>}
                        </button>
                        <button
                            onClick={handleCancel}
                            style={{
                                background: 'rgba(71,85,105,0.3)', border: '1px solid rgba(71,85,105,0.4)',
                                borderRadius: '10px', color: '#94a3b8', cursor: 'pointer',
                                fontSize: '0.9rem', padding: '0.5rem 0.75rem',
                                fontFamily: 'Inter, sans-serif',
                            }}
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            {/* 候補カードスライダー（抽出後） */}
            {candidates && (
                <div style={{ marginBottom: '0.75rem' }}>
                    {/* ヘッダー行 */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <span style={{ fontSize: '0.78rem', color: '#a5b4fc' }}>
                            {candidates.length}個を抽出 —
                            <span style={{ color: '#64748b' }}> クリックで選択/解除、選択したものを保存します</span>
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: 600 }}>
                            {checkedIds.size}/{candidates.length} 選択中
                        </span>
                    </div>

                    {/* カードスライダー */}
                    <div style={{
                        display: 'flex',
                        gap: '1rem',
                        overflowX: 'auto',
                        paddingBottom: '6px',
                        scrollbarWidth: 'thin',
                        scrollbarColor: 'rgba(96,165,250,0.2) transparent',
                    }}>
                        {candidates.map(fw => {
                            const checked = checkedIds.has(fw.id)
                            return (
                                <div
                                    key={fw.id}
                                    className="style-card"
                                    onClick={() => toggleCheck(fw.id)}
                                    style={{
                                        flexShrink: 0,
                                        width: '220px',
                                        cursor: 'pointer',
                                        borderColor: checked ? '#6366f1' : 'rgba(96,165,250,0.15)',
                                        boxShadow: checked
                                            ? '0 0 0 1px #6366f1, 0 4px 20px rgba(99,102,241,0.2)'
                                            : 'none',
                                        opacity: checked ? 1 : 0.5,
                                        position: 'relative',
                                    }}
                                >
                                    {/* チェックバッジ（右上） */}
                                    <div style={{
                                        position: 'absolute', top: '10px', right: '10px',
                                        width: '18px', height: '18px', borderRadius: '50%',
                                        border: `1.5px solid ${checked ? '#6366f1' : '#475569'}`,
                                        background: checked ? '#6366f1' : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                        transition: 'all 0.15s',
                                    }}>
                                        {checked && <Check size={10} color="white" strokeWidth={3} />}
                                    </div>

                                    {/* カードヘッダー */}
                                    <div className="style-card-header" style={{ paddingRight: '28px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                                            <div className="style-avatar" style={{
                                                background: checked
                                                    ? 'linear-gradient(135deg, #4c1d95, #6366f1)'
                                                    : 'linear-gradient(135deg, #1e3a8a, #4c1d95)',
                                                color: checked ? '#c4b5fd' : '#93c5fd',
                                            }}>
                                                {fw.name[0]}
                                            </div>
                                            <h3 className="style-name" style={{
                                                color: checked ? '#a5b4fc' : '#e2e8f0',
                                                fontSize: '0.82rem',
                                                whiteSpace: 'normal',
                                                wordBreak: 'break-all',
                                            }}>
                                                {fw.name}
                                            </h3>
                                        </div>
                                    </div>

                                    {/* 説明文（全文表示） */}
                                    {fw.description && (
                                        <p style={{
                                            margin: 0,
                                            fontSize: '0.72rem',
                                            color: '#64748b',
                                            lineHeight: 1.5,
                                        }}>
                                            {fw.description}
                                        </p>
                                    )}

                                    {/* テンプレートプレビュー（全文表示） */}
                                    {fw.template && (
                                        <div style={{
                                            background: 'rgba(7,11,25,0.8)',
                                            border: '1px solid rgba(96,165,250,0.1)',
                                            borderRadius: '10px',
                                            padding: '0.65rem 0.8rem',
                                        }}>
                                            <p style={{ margin: '0 0 4px', fontSize: '0.62rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                投稿イメージ
                                            </p>
                                            <pre style={{
                                                margin: 0,
                                                fontSize: '0.68rem',
                                                color: '#94a3b8',
                                                fontFamily: 'inherit',
                                                whiteSpace: 'pre-wrap',
                                                lineHeight: 1.5,
                                            }}>
                                                {fw.template}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* フッターボタン */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '0.75rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button onClick={handleCancel} style={{ fontSize: '0.78rem', padding: '6px 14px', background: 'rgba(71,85,105,0.3)', border: '1px solid rgba(71,85,105,0.4)', borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                            キャンセル
                        </button>
                        <button onClick={handleSave} disabled={isSaving || checkedIds.size === 0} style={{ fontSize: '0.78rem', padding: '6px 16px', background: 'linear-gradient(135deg, #6366f1, #a855f7)', border: 'none', borderRadius: '8px', color: 'white', cursor: (isSaving || checkedIds.size === 0) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '5px', opacity: (isSaving || checkedIds.size === 0) ? 0.6 : 1, fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
                            {isSaving ? <Loader2 size={12} className="animate-spin" /> : null}
                            選択して保存
                        </button>
                    </div>
                </div>
            )}

            {/* カードスライダー */}
            <div style={{
                display: 'flex',
                gap: '1rem',
                overflowX: 'auto',
                paddingBottom: '4px',
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(96,165,250,0.2) transparent',
            }}>
                {/* 「なし」カード */}
                <div
                    onClick={() => onSelect(null)}
                    className="style-card"
                    style={{
                        flexShrink: 0,
                        width: '180px',
                        minHeight: '140px',
                        cursor: 'pointer',
                        borderColor: !selectedGlobalFrameworkId ? '#6366f1' : 'rgba(96,165,250,0.15)',
                        boxShadow: !selectedGlobalFrameworkId
                            ? '0 0 0 1px #6366f1, 0 4px 20px rgba(99,102,241,0.2)'
                            : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '8px',
                        opacity: !selectedGlobalFrameworkId ? 1 : 0.6,
                    }}
                >
                    <div style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: !selectedGlobalFrameworkId
                            ? 'linear-gradient(135deg, #4c1d95, #6366f1)'
                            : 'rgba(71,85,105,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.1rem',
                    }}>
                        ✦
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ margin: '0 0 4px', fontSize: '0.82rem', fontWeight: 700, color: !selectedGlobalFrameworkId ? '#a5b4fc' : '#94a3b8' }}>
                            フレームワークなし
                        </p>
                        <p style={{ margin: 0, fontSize: '0.7rem', color: '#475569', lineHeight: 1.4 }}>
                            AIが自動で最適な構成を生成
                        </p>
                    </div>
                </div>

                {/* フレームワークカード */}
                {globalFrameworks.map(fw => {
                    const isSelected = selectedGlobalFrameworkId === fw.id
                    return (
                        <div
                            key={fw.id}
                            className="style-card"
                            style={{
                                flexShrink: 0,
                                width: '220px',
                                cursor: 'pointer',
                                borderColor: isSelected ? '#6366f1' : 'rgba(96,165,250,0.15)',
                                boxShadow: isSelected
                                    ? '0 0 0 1px #6366f1, 0 4px 20px rgba(99,102,241,0.2)'
                                    : 'none',
                            }}
                            onClick={() => onSelect(isSelected ? null : fw.id)}
                        >
                            <div className="style-card-header">
                                <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                                    <div className="style-avatar" style={{
                                        background: isSelected
                                            ? 'linear-gradient(135deg, #4c1d95, #6366f1)'
                                            : 'linear-gradient(135deg, #1e3a8a, #4c1d95)',
                                        color: isSelected ? '#c4b5fd' : '#93c5fd',
                                    }}>
                                        {fw.name[0]}
                                    </div>
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        <h3 className="style-name" style={{
                                            color: isSelected ? '#a5b4fc' : '#e2e8f0',
                                            fontSize: '0.82rem',
                                            margin: '0 0 2px 0.6rem',
                                            whiteSpace: 'normal',
                                            wordBreak: 'break-all',
                                        }}>
                                            {fw.name}
                                        </h3>
                                    </div>
                                </div>
                                <button
                                    onClick={e => { e.stopPropagation(); onDelete(fw.id) }}
                                    className="refresh-btn"
                                    title="削除"
                                    style={{ color: '#475569' }}
                                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                                    onMouseLeave={e => e.currentTarget.style.color = '#475569'}
                                >
                                    <Trash2 style={{ width: '13px', height: '13px' }} />
                                </button>
                            </div>

                            {fw.description && (
                                <p style={{
                                    margin: 0,
                                    fontSize: '0.72rem',
                                    color: '#64748b',
                                    lineHeight: 1.5,
                                }}>
                                    {fw.description}
                                </p>
                            )}

                            {fw.template && (
                                <div style={{
                                    background: 'rgba(7,11,25,0.8)',
                                    border: '1px solid rgba(96,165,250,0.1)',
                                    borderRadius: '10px',
                                    padding: '0.65rem 0.8rem',
                                }}>
                                    <p style={{ margin: '0 0 4px', fontSize: '0.62rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                        投稿イメージ
                                    </p>
                                    <pre style={{
                                        margin: 0,
                                        fontSize: '0.68rem',
                                        color: '#94a3b8',
                                        fontFamily: 'inherit',
                                        whiteSpace: 'pre-wrap',
                                        lineHeight: 1.5,
                                    }}>
                                        {fw.template}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )
                })}

                {/* ＋ 追加カード */}
                {!showExtractForm && !candidates && (
                    <div
                        className="add-card"
                        onClick={() => setShowExtractForm(true)}
                        style={{ flexShrink: 0, width: '180px', minHeight: '140px' }}
                    >
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1px solid rgba(96,165,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Plus size={18} style={{ color: '#334155' }} />
                        </div>
                        <p style={{ margin: 0, fontSize: '0.82rem' }}>フレームワークを追加</p>
                    </div>
                )}
            </div>
        </div>
    )
}

export default FrameworkExtractorPanel
