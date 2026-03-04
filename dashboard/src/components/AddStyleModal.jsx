import React, { useState, useEffect, useRef } from 'react'
import { X, UserPlus, AtSign } from 'lucide-react'

function AddStyleModal({ isOpen, onClose, onSubmit, existingNames = [] }) {
    const [name, setName] = useState('')
    const [xUsername, setXUsername] = useState('')
    const [loading, setLoading] = useState(false)
    const inputRef = useRef(null)

    const isDuplicate = existingNames.includes(name.trim().toLowerCase())

    useEffect(() => {
        if (isOpen) {
            setName('')
            setXUsername('')
            setLoading(false)
            setTimeout(() => inputRef.current?.focus(), 50)
        }
    }, [isOpen])

    const handleSubmit = async (e) => {
        e.preventDefault()
        const trimmed = name.trim()
        if (!trimmed || isDuplicate) return
        setLoading(true)
        try {
            await onSubmit(trimmed, xUsername.trim())
            onClose()
        } catch (err) {
            alert('追加に失敗しました: ' + err.message)
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 100,
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: '#0f172a',
                    border: '1px solid rgba(96,165,250,0.2)',
                    borderRadius: '16px',
                    padding: '28px',
                    width: '360px',
                    boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
                }}
            >
                {/* ヘッダー */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <UserPlus size={18} color="#60a5fa" />
                        <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem' }}>
                            スタイルを追加
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '2px' }}
                    >
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '8px', fontWeight: 500 }}>
                            アカウント名
                        </label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="例: 田中太郎"
                            maxLength={50}
                            style={{
                                width: '100%',
                                background: 'rgba(30,41,59,0.8)',
                                border: `1px solid ${isDuplicate ? 'rgba(239,68,68,0.6)' : 'rgba(96,165,250,0.2)'}`,
                                borderRadius: '8px',
                                padding: '10px 14px',
                                color: '#e2e8f0',
                                fontSize: '0.95rem',
                                outline: 'none',
                                boxSizing: 'border-box',
                            }}
                            onFocus={e => e.target.style.borderColor = isDuplicate ? 'rgba(239,68,68,0.8)' : 'rgba(96,165,250,0.5)'}
                            onBlur={e => e.target.style.borderColor = isDuplicate ? 'rgba(239,68,68,0.6)' : 'rgba(96,165,250,0.2)'}
                        />
                        {isDuplicate && (
                            <p style={{ margin: '6px 0 0', color: '#f87171', fontSize: '0.72rem' }}>
                                既にそのスタイル名は存在します
                            </p>
                        )}
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '8px', fontWeight: 500 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <AtSign size={13} color="#94a3b8" />
                                X ユーザー名（任意）
                            </div>
                        </label>
                        <input
                            type="text"
                            value={xUsername}
                            onChange={e => setXUsername(e.target.value)}
                            placeholder="例: @elonmusk"
                            maxLength={50}
                            style={{
                                width: '100%',
                                background: 'rgba(30,41,59,0.8)',
                                border: '1px solid rgba(96,165,250,0.2)',
                                borderRadius: '8px',
                                padding: '10px 14px',
                                color: '#e2e8f0',
                                fontSize: '0.95rem',
                                outline: 'none',
                                boxSizing: 'border-box',
                            }}
                            onFocus={e => e.target.style.borderColor = 'rgba(96,165,250,0.5)'}
                            onBlur={e => e.target.style.borderColor = 'rgba(96,165,250,0.2)'}
                        />
                        <p style={{ margin: '6px 0 0', color: '#475569', fontSize: '0.72rem', lineHeight: 1.4 }}>
                            入力すると、その人のツイートから文体を自動分析します
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                flex: 1,
                                background: 'rgba(100,116,139,0.15)',
                                border: '1px solid rgba(100,116,139,0.2)',
                                borderRadius: '8px',
                                padding: '10px',
                                cursor: 'pointer',
                                color: '#94a3b8',
                                fontSize: '0.88rem',
                                fontWeight: 500,
                            }}
                        >
                            キャンセル
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !name.trim() || isDuplicate}
                            style={{
                                flex: 2,
                                background: name.trim() && !isDuplicate
                                    ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
                                    : 'rgba(100,116,139,0.2)',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '10px',
                                cursor: loading || !name.trim() || isDuplicate ? 'not-allowed' : 'pointer',
                                color: name.trim() && !isDuplicate ? 'white' : '#64748b',
                                fontSize: '0.88rem',
                                fontWeight: 600,
                                opacity: loading ? 0.7 : 1,
                                transition: 'all 0.15s',
                            }}
                        >
                            {loading ? '追加中...' : '追加する'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default AddStyleModal

