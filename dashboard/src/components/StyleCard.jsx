import React, { useState } from 'react'
import { RotateCw, PenTool, Twitter, Clock, Loader2, Sparkles, Trash2, Layers } from 'lucide-react'

const StyleCard = ({ style, post, loading, onGenerate, onPost, onSchedule, scheduledTime, setPostContent, onDelete, frameworks, selectedFrameworkId, onFrameworkSelect }) => {
    const [showFrameworks, setShowFrameworks] = useState(false)

    const allFrameworks = frameworks || []
    const selectedFw = allFrameworks.find(fw => fw.id === selectedFrameworkId)

    return (
        <div className="style-card">
            {/* カードヘッダー */}
            <div className="style-card-header">
                <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                    <div className="style-avatar">
                        {style.name[0]}
                    </div>
                    <h3 className="style-name">{style.name}</h3>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {onDelete && (
                        <button
                            onClick={() => onDelete(style.id)}
                            className="refresh-btn"
                            title="削除"
                            style={{ color: '#ef4444' }}
                        >
                            <Trash2 style={{ width: '15px', height: '15px' }} />
                        </button>
                    )}
                    <button
                        onClick={() => onGenerate(style.id)}
                        className="refresh-btn"
                        title="リフレッシュ"
                        disabled={loading}
                    >
                        <RotateCw style={{ width: '17px', height: '17px' }} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* フレームワークタブ */}
            <div style={{ padding: '0 1rem 0.5rem' }}>
                <button
                    onClick={() => setShowFrameworks(prev => !prev)}
                    style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        border: `1.5px solid ${showFrameworks || selectedFrameworkId ? '#6366f1' : 'rgba(96,165,250,0.15)'}`,
                        background: showFrameworks || selectedFrameworkId ? 'rgba(99,102,241,0.12)' : 'rgba(7,11,25,0.6)',
                        color: showFrameworks || selectedFrameworkId ? '#818cf8' : '#475569',
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        fontWeight: '500',
                        letterSpacing: '0.02em',
                        transition: 'all 0.15s',
                        boxShadow: showFrameworks || selectedFrameworkId ? '0 0 0 1px rgba(99,102,241,0.3)' : 'none',
                    }}
                >
                    <Layers style={{ width: '11px', height: '11px' }} />
                    フレームワーク
                    {selectedFrameworkId && (
                        <span style={{
                            display: 'inline-block',
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: '#6366f1',
                            marginLeft: '2px',
                        }} />
                    )}
                </button>

                {/* 選択中フレームワーク名（タブ閉じているとき） */}
                {!showFrameworks && selectedFw && (
                    <span style={{
                        marginLeft: '8px',
                        fontSize: '0.68rem',
                        color: '#64748b',
                        fontStyle: 'italic',
                    }}>
                        {selectedFw.name}
                    </span>
                )}

                {/* フレームワーク選択エリア */}
                {showFrameworks && (
                    <div style={{
                        marginTop: '8px',
                        display: 'flex',
                        gap: '6px',
                        overflowX: 'auto',
                        paddingBottom: '4px',
                    }}>
                        {/* なし（自動）チップ */}
                        <button
                            onClick={() => onFrameworkSelect(style.id, null)}
                            style={{
                                flexShrink: 0,
                                padding: '4px 10px',
                                borderRadius: '20px',
                                border: `1.5px solid ${!selectedFrameworkId ? '#6366f1' : 'rgba(96,165,250,0.15)'}`,
                                background: !selectedFrameworkId ? 'rgba(99,102,241,0.15)' : 'rgba(7,11,25,0.8)',
                                color: !selectedFrameworkId ? '#818cf8' : '#475569',
                                cursor: 'pointer',
                                fontSize: '0.70rem',
                                whiteSpace: 'nowrap',
                                boxShadow: !selectedFrameworkId ? '0 0 0 1px #6366f1' : 'none',
                                transition: 'all 0.15s',
                            }}
                        >
                            なし（自動）
                        </button>

                        {allFrameworks.length === 0 && (
                            <span style={{ fontSize: '0.70rem', color: '#334155', alignSelf: 'center', whiteSpace: 'nowrap' }}>
                                フレームワークがありません
                            </span>
                        )}

                        {allFrameworks.map(fw => (
                            <button
                                key={fw.id}
                                onClick={() => onFrameworkSelect(style.id, fw.id)}
                                title={fw.description || fw.name}
                                style={{
                                    flexShrink: 0,
                                    padding: '4px 10px',
                                    borderRadius: '20px',
                                    border: `1.5px solid ${selectedFrameworkId === fw.id ? '#6366f1' : 'rgba(96,165,250,0.15)'}`,
                                    background: selectedFrameworkId === fw.id ? 'rgba(99,102,241,0.15)' : 'rgba(7,11,25,0.8)',
                                    color: selectedFrameworkId === fw.id ? '#818cf8' : '#94a3b8',
                                    cursor: 'pointer',
                                    fontSize: '0.70rem',
                                    whiteSpace: 'nowrap',
                                    boxShadow: selectedFrameworkId === fw.id ? '0 0 0 1px #6366f1' : 'none',
                                    transition: 'all 0.15s',
                                    maxWidth: '160px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}
                            >
                                {fw.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* 投稿エリア */}
            <div className="post-area">
                {loading ? (
                    <div className="spinner">
                        <Loader2 style={{ width: '28px', height: '28px', color: '#6366f1' }} className="animate-spin" />
                    </div>
                ) : post ? (
                    <textarea
                        value={post}
                        onChange={(e) => setPostContent(style.id, e.target.value)}
                        className="post-textarea"
                    />
                ) : (
                    <div className="post-placeholder" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.5 }}>
                            <PenTool style={{ width: '28px', height: '28px', marginBottom: '8px' }} />
                            <p style={{ margin: 0 }}>投稿文を生成してください</p>
                        </div>
                        <button
                            onClick={() => onGenerate(style.id)}
                            style={{
                                padding: '8px 16px',
                                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontWeight: '500',
                                fontSize: '0.9rem',
                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.2)'
                            }}
                        >
                            <Sparkles style={{ width: '14px', height: '14px' }} />
                            生成する
                        </button>
                    </div>
                )}
            </div>

            {/* アクションボタン */}
            <div className="action-buttons">
                <button
                    onClick={() => onPost(post)}
                    disabled={!post || loading}
                    className="btn-post"
                >
                    <Twitter style={{ width: '15px', height: '15px' }} />
                    <span>今すぐ投稿</span>
                </button>
                <button
                    onClick={() => onSchedule(style.id)}
                    disabled={!post || loading}
                    className="btn-schedule"
                >
                    <Clock style={{ width: '15px', height: '15px' }} />
                    <span>{scheduledTime || '予約投稿'}</span>
                </button>
            </div>
        </div>
    )
}

export default StyleCard
