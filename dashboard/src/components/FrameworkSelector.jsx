import React, { useState } from 'react'
import { ClipboardList, Loader2, Trash2, ChevronDown, Check } from 'lucide-react'

const FrameworkSelector = ({ styleId, styleName, frameworks, selectedId, onSelect, onGenerate, onSave, onDelete }) => {
    const [isGenerating, setIsGenerating] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [candidates, setCandidates] = useState(null)
    const [checkedIds, setCheckedIds] = useState(new Set())
    const [expandedId, setExpandedId] = useState(null)

    const selected = frameworks.find(fw => fw.id === selectedId)

    const handleGenerateClick = async () => {
        setIsGenerating(true)
        try {
            const result = await onGenerate(styleId)
            const fws = result.frameworks || []
            setCandidates(fws)
            setCheckedIds(new Set(fws.map(fw => fw.id)))
            setExpandedId(null)
        } catch (err) {
            alert(`フレームワーク取得に失敗しました: ${err.message}`)
        } finally {
            setIsGenerating(false)
        }
    }

    const toggleCheck = (id) => {
        setCheckedIds(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }

    const toggleExpand = (id) => {
        setExpandedId(prev => prev === id ? null : id)
    }

    const handleSave = async () => {
        const sel = candidates.filter(fw => checkedIds.has(fw.id))
        if (sel.length === 0) {
            alert('1つ以上選択してください')
            return
        }
        setIsSaving(true)
        try {
            await onSave(styleId, styleName, sel)
            setCandidates(null)
            setCheckedIds(new Set())
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
    }

    return (
        <div style={{
            borderTop: '1px solid rgba(96,165,250,0.1)',
            borderBottom: '1px solid rgba(96,165,250,0.1)',
            padding: '10px 14px',
            background: 'rgba(99,102,241,0.04)',
        }}>
            {/* ヘッダー行 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <ClipboardList size={13} style={{ color: '#a855f7', flexShrink: 0 }} />
                <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 500, flexShrink: 0 }}>投稿フレームワーク</span>

                {candidates && (
                    <span style={{ fontSize: '0.75rem', color: '#a5b4fc', flex: 1 }}>
                        {candidates.length}個を抽出 — 保存するものを選択
                    </span>
                )}
                {!candidates && <span style={{ flex: 1 }} />}

                {!candidates && (
                    <button
                        onClick={handleGenerateClick}
                        disabled={isGenerating}
                        style={{
                            fontSize: '0.72rem',
                            padding: '3px 8px',
                            background: 'rgba(99,102,241,0.15)',
                            border: '1px solid rgba(99,102,241,0.3)',
                            borderRadius: '5px',
                            color: '#a5b4fc',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                        }}
                    >
                        {isGenerating
                            ? <><Loader2 size={11} className="animate-spin" />取得中...</>
                            : (frameworks.length > 0 ? '更新' : '生成')}
                    </button>
                )}
            </div>

            {/* ── 通常表示: 横スライダーカード ── */}
            {!candidates && (
                frameworks.length > 0 ? (
                    <div style={{
                        display: 'flex',
                        gap: '8px',
                        overflowX: 'auto',
                        paddingBottom: '4px',
                        scrollbarWidth: 'thin',
                        scrollbarColor: 'rgba(96,165,250,0.2) transparent',
                    }}>
                        {/* 「なし」カード */}
                        <button
                            onClick={() => onSelect(styleId, null)}
                            style={{
                                flexShrink: 0,
                                width: '110px',
                                background: !selectedId
                                    ? 'rgba(99,102,241,0.15)'
                                    : 'rgba(15,23,42,0.5)',
                                border: `1.5px solid ${!selectedId ? '#6366f1' : 'rgba(71,85,105,0.35)'}`,
                                borderRadius: '10px',
                                padding: '8px 10px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                                transition: 'border-color 0.2s, background 0.2s',
                            }}
                        >
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: !selectedId ? '#a5b4fc' : '#94a3b8' }}>
                                なし（自動）
                            </span>
                            <span style={{ fontSize: '0.65rem', color: '#475569', lineHeight: 1.4 }}>
                                フレームワークを使わず生成
                            </span>
                        </button>

                        {frameworks.map(fw => {
                            const isSelected = fw.id === selectedId
                            return (
                                <div
                                    key={fw.id}
                                    style={{
                                        flexShrink: 0,
                                        width: '160px',
                                        background: isSelected
                                            ? 'rgba(99,102,241,0.15)'
                                            : 'rgba(15,23,42,0.5)',
                                        border: `1.5px solid ${isSelected ? '#6366f1' : 'rgba(71,85,105,0.35)'}`,
                                        borderRadius: '10px',
                                        padding: '8px 10px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '4px',
                                        position: 'relative',
                                        transition: 'border-color 0.2s, background 0.2s',
                                    }}
                                    onClick={() => onSelect(styleId, fw.id)}
                                >
                                    {/* タイトル + 削除ボタン */}
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '4px' }}>
                                        <span style={{
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            color: isSelected ? '#a5b4fc' : '#e2e8f0',
                                            lineHeight: 1.3,
                                            flex: 1,
                                        }}>
                                            {fw.name}
                                        </span>
                                        <button
                                            onClick={e => { e.stopPropagation(); onDelete(styleId, fw.id); if (isSelected) onSelect(styleId, null) }}
                                            title="削除"
                                            style={{
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                color: '#ef4444', padding: '1px', flexShrink: 0,
                                                opacity: 0.6,
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                                            onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
                                        >
                                            <Trash2 size={10} />
                                        </button>
                                    </div>

                                    {/* 説明文 */}
                                    {fw.description && (
                                        <p style={{
                                            margin: 0,
                                            fontSize: '0.65rem',
                                            color: '#64748b',
                                            lineHeight: 1.4,
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                        }}>
                                            {fw.description}
                                        </p>
                                    )}

                                    {/* テンプレートプレビュー */}
                                    {fw.template && (
                                        <pre style={{
                                            margin: 0,
                                            fontSize: '0.6rem',
                                            color: '#475569',
                                            fontFamily: 'inherit',
                                            whiteSpace: 'pre-wrap',
                                            background: 'rgba(7,11,25,0.5)',
                                            border: '1px solid rgba(96,165,250,0.08)',
                                            borderRadius: '5px',
                                            padding: '4px 6px',
                                            maxHeight: '52px',
                                            overflow: 'hidden',
                                            lineHeight: 1.4,
                                        }}>
                                            {fw.template}
                                        </pre>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <span style={{ fontSize: '0.75rem', color: '#475569' }}>未生成</span>
                )
            )}

            {/* ── 候補チェックリスト（生成後） ── */}
            {candidates && (
                <div style={{ marginTop: '4px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '320px', overflowY: 'auto' }}>
                        {candidates.map(fw => (
                            <div
                                key={fw.id}
                                style={{
                                    background: checkedIds.has(fw.id) ? 'rgba(99,102,241,0.1)' : 'rgba(15,23,42,0.4)',
                                    border: `1px solid ${checkedIds.has(fw.id) ? 'rgba(99,102,241,0.35)' : 'rgba(71,85,105,0.3)'}`,
                                    borderRadius: '6px',
                                    overflow: 'hidden',
                                }}
                            >
                                <div
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', cursor: 'pointer' }}
                                    onClick={() => toggleCheck(fw.id)}
                                >
                                    <div style={{
                                        width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
                                        border: `1.5px solid ${checkedIds.has(fw.id) ? '#6366f1' : '#475569'}`,
                                        background: checkedIds.has(fw.id) ? '#6366f1' : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        {checkedIds.has(fw.id) && <Check size={10} color="white" strokeWidth={3} />}
                                    </div>
                                    <span style={{ fontSize: '0.78rem', color: '#e2e8f0', flex: 1, fontWeight: 500 }}>{fw.name}</span>
                                    <button
                                        onClick={e => { e.stopPropagation(); toggleExpand(fw.id) }}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px', display: 'flex' }}
                                    >
                                        <ChevronDown size={12} style={{ transform: expandedId === fw.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                                    </button>
                                </div>
                                {expandedId === fw.id && (
                                    <div style={{ padding: '0 8px 8px 32px' }}>
                                        <p style={{ margin: '0 0 4px', fontSize: '0.72rem', color: '#94a3b8' }}>{fw.description}</p>
                                        <pre style={{ margin: 0, fontSize: '0.68rem', color: '#64748b', fontFamily: 'inherit', whiteSpace: 'pre-wrap', background: 'rgba(15,23,42,0.5)', padding: '4px 6px', borderRadius: '4px' }}>
                                            {fw.template}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{checkedIds.size}個選択中</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={handleCancel}
                                style={{
                                    fontSize: '0.75rem', padding: '4px 10px',
                                    background: 'rgba(71,85,105,0.3)', border: '1px solid rgba(71,85,105,0.4)',
                                    borderRadius: '5px', color: '#94a3b8', cursor: 'pointer',
                                }}
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving || checkedIds.size === 0}
                                style={{
                                    fontSize: '0.75rem', padding: '4px 12px',
                                    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                    border: 'none', borderRadius: '5px', color: 'white',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                                    opacity: (isSaving || checkedIds.size === 0) ? 0.6 : 1,
                                }}
                            >
                                {isSaving ? <Loader2 size={11} className="animate-spin" /> : null}
                                選択して保存
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default FrameworkSelector
