import React, { useState, useRef, useEffect } from 'react'
import { Activity, ChevronDown, Plus, Check, Edit2 } from 'lucide-react'

const Header = ({ currentAccount, accounts, onSwitchAccount, onAddAccountClick, onEditAccountClick }) => {
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef(null)

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div>
                <h1 className="header-title">
                    <span className="gradient-text">X Automation</span>{' '}
                    <span style={{ color: '#f8fafc' }}>Dashboard</span>
                </h1>
                <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                    株式会社からもん | 多人数同時生成・管理
                </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <div style={{ position: 'relative' }} ref={dropdownRef}>
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            background: 'rgba(30, 41, 59, 0.7)',
                            border: '1px solid rgba(148, 163, 184, 0.2)',
                            padding: '0.5rem 1rem',
                            borderRadius: '20px',
                            color: '#f8fafc',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            backdropFilter: 'blur(8px)',
                            transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(30, 41, 59, 0.9)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(30, 41, 59, 0.7)'}
                    >
                        {currentAccount ? currentAccount.name : 'アカウント読込中...'}
                        <ChevronDown size={14} style={{ color: '#94a3b8', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>

                    {isOpen && (
                        <div style={{
                            position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem',
                            background: 'rgba(15, 23, 42, 0.95)',
                            border: '1px solid rgba(148, 163, 184, 0.2)',
                            borderRadius: '12px',
                            padding: '0.5rem',
                            width: '200px',
                            zIndex: 50,
                            backdropFilter: 'blur(12px)',
                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                            animation: 'fadeIn 0.2s ease'
                        }}>
                            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                {(accounts || []).map(acc => (
                                    <div
                                        key={acc.id}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '0.25rem 0.5rem',
                                            marginBottom: '0.25rem',
                                            borderRadius: '8px',
                                            transition: 'background 0.2s',
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <button
                                            onClick={() => {
                                                if (currentAccount?.id !== acc.id) {
                                                    onSwitchAccount(acc.id)
                                                }
                                                setIsOpen(false)
                                            }}
                                            style={{
                                                display: 'flex', alignItems: 'center', flex: 1, gap: '0.5rem',
                                                background: 'transparent', border: 'none',
                                                color: '#e2e8f0', textAlign: 'left',
                                                cursor: 'pointer', padding: '0.25rem'
                                            }}
                                        >
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.name}</span>
                                            {currentAccount?.id === acc.id && <Check size={14} style={{ color: '#3b82f6' }} />}
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsOpen(false);
                                                onEditAccountClick(acc);
                                            }}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                color: '#94a3b8',
                                                cursor: 'pointer',
                                                padding: '0.25rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                borderRadius: '4px'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.color = '#60a5fa'}
                                            onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                                            title="アカウント情報を編集"
                                        >
                                            <Edit2 size={13} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '0.25rem 0' }} />
                            <button
                                onClick={() => {
                                    setIsOpen(false)
                                    onAddAccountClick()
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    width: '100%', padding: '0.5rem 0.75rem',
                                    background: 'transparent', border: 'none',
                                    color: '#60a5fa', textAlign: 'left',
                                    borderRadius: '8px', cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    transition: 'background 0.2s',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <Plus size={14} />
                                アカウントを追加
                            </button>
                        </div>
                    )}
                </div>

                <div className="system-badge">
                    <span className="system-dot" />
                    <span>System Online</span>
                </div>
            </div>
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </header>
    )
}

export default Header
