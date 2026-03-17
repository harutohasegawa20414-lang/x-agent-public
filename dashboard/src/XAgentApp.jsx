import React, { useState, useEffect, useRef } from 'react'
import TopicInput from './components/TopicInput'
import StyleCard from './components/StyleCard'
import HistoryPanel from './components/HistoryPanel'
import SchedulerPanel from './components/SchedulerPanel'
import AccountModal from './components/AccountModal'
import ChatPanel from './components/ChatPanel'
import AddStyleModal from './components/AddStyleModal'
import FrameworkExtractorPanel from './components/FrameworkExtractorPanel'
import { fetchStyles, generatePost, postToX, fetchAccounts, fetchCurrentAccount, switchAccount, addAccount, editAccount, addCustomStyle, deleteCustomStyle, fetchGeneratedPosts, fetchFrameworks, saveFrameworks, deleteFramework, extractFrameworksByUsername, fetchSourceSelections } from './api'
import SourceSelector from './components/SourceSelector'
import { Link as LinkIcon, Cpu, ShieldCheck, Zap, History, Settings2, ChevronDown, Check, Plus, Edit2 } from 'lucide-react'

const NAV = [
    { id: 'generate', label: '投稿生成', icon: Zap },
    { id: 'scheduler', label: 'スケジューラー', icon: Settings2 },
    { id: 'history', label: '投稿履歴', icon: History },
]

function SidebarAccountSwitcher({ currentAccount, accounts, onSwitch, onEdit, onAdd }) {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    if (!currentAccount) {
        return (
            <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {(accounts && accounts.length > 0) ? (
                    <>
                        <div style={{ fontSize: 10, color: '#4f6080', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 6 }}>
                            アカウントを選択
                        </div>
                        {accounts.map(acc => (
                            <button
                                key={acc.id}
                                onClick={() => onSwitch(acc.id)}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
                                    background: 'rgba(255,255,255,0.04)', cursor: 'pointer', color: '#aab4cc',
                                    fontSize: 12, fontWeight: 500, fontFamily: 'inherit', marginBottom: 4,
                                    textAlign: 'left',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(29,155,240,0.08)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                            >
                                <div style={{
                                    width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                                    background: 'rgba(255,255,255,0.08)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 9, fontWeight: 800, color: 'white',
                                }}>
                                    {acc.name.slice(0, 1).toUpperCase()}
                                </div>
                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {acc.name}
                                </span>
                            </button>
                        ))}
                        <button
                            onClick={() => onAdd()}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                padding: '7px 10px', borderRadius: 8, border: '1px dashed rgba(29,155,240,0.5)',
                                background: 'rgba(29,155,240,0.05)', cursor: 'pointer',
                                color: '#1d9bf0', fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
                                marginTop: 4,
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(29,155,240,0.1)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(29,155,240,0.05)'}
                        >
                            <Plus size={13} />
                            新しいアカウントを追加
                        </button>
                    </>
                ) : (
                    <button
                        onClick={() => { onAdd() }}
                        style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            padding: '8px 10px', borderRadius: 8, border: '1px dashed rgba(29,155,240,0.5)',
                            background: 'rgba(29,155,240,0.05)', cursor: 'pointer',
                            color: '#1d9bf0', fontSize: 13, fontFamily: 'inherit', fontWeight: 600,
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(29,155,240,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(29,155,240,0.05)'}
                    >
                        <Plus size={14} />
                        アカウントを登録
                    </button>
                )}
            </div>
        )
    }

    return (
        <div ref={ref} style={{ position: 'relative', padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.04)', cursor: 'pointer', color: '#aab4cc',
                    fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                }}
            >
                <div style={{
                    width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                    background: 'linear-gradient(135deg, #1d9bf0, #6366f1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800, color: 'white',
                }}>
                    {currentAccount.name.slice(0, 1).toUpperCase()}
                </div>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
                    {currentAccount.name}
                </span>
                <ChevronDown size={12} style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>

            {open && (
                <div style={{
                    position: 'absolute', top: '100%', left: 12, right: 12, marginTop: 4,
                    background: '#131929', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    zIndex: 200, overflow: 'hidden',
                }}>
                    <div style={{ padding: '6px 10px 4px', fontSize: 10, color: '#4f6080', fontWeight: 600, letterSpacing: '0.06em' }}>
                        アカウント切り替え
                    </div>
                    {(accounts || []).map(acc => (
                        <div
                            key={acc.id}
                            style={{ display: 'flex', alignItems: 'center' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            <button
                                onClick={() => { onSwitch(acc.id); setOpen(false) }}
                                style={{
                                    flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '8px 10px', border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer', color: currentAccount?.id === acc.id ? '#7db3fc' : '#aab4cc',
                                    fontSize: 12, fontFamily: 'inherit', textAlign: 'left',
                                }}
                            >
                                <div style={{
                                    width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                                    background: currentAccount?.id === acc.id ? 'linear-gradient(135deg, #1d9bf0, #6366f1)' : 'rgba(255,255,255,0.08)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 9, fontWeight: 800, color: 'white',
                                }}>
                                    {acc.name.slice(0, 1).toUpperCase()}
                                </div>
                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.name}</span>
                                {currentAccount?.id === acc.id && <Check size={11} style={{ color: '#1d9bf0', flexShrink: 0 }} />}
                            </button>
                            <button
                                onClick={() => { onEdit(acc); setOpen(false) }}
                                style={{
                                    padding: '8px 10px 8px 0', border: 'none',
                                    background: 'transparent', cursor: 'pointer',
                                    color: '#4f6080', fontFamily: 'inherit', display: 'flex', alignItems: 'center',
                                }}
                                onMouseEnter={e => e.currentTarget.style.color = '#7db3fc'}
                                onMouseLeave={e => e.currentTarget.style.color = '#4f6080'}
                                title="アカウントを編集"
                            >
                                <Edit2 size={12} />
                            </button>
                        </div>
                    ))}
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
                    <button
                        onClick={() => { onAdd(); setOpen(false) }}
                        style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 10px', border: 'none',
                            background: 'transparent', cursor: 'pointer',
                            color: '#1d9bf0', fontSize: 12, fontFamily: 'inherit', textAlign: 'left',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(29,155,240,0.08)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                        <Plus size={13} />
                        アカウントを追加
                    </button>
                </div>
            )}
        </div>
    )
}

function XAgentApp() {
    const [topic, setTopic] = useState("")
    const [styles, setStyles] = useState([])
    const [posts, setPosts] = useState({})
    const [loading, setLoading] = useState({})
    const [scheduling, setScheduling] = useState({})
    const [showSourceSelector, setShowSourceSelector] = useState(false)
    const [sourceSelections, setSourceSelections] = useState({ urls: [] })
    const [activeTab, setActiveTab] = useState('generate')
    const [accounts, setAccounts] = useState([])
    const [currentAccount, setCurrentAccount] = useState(null)
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false)
    const [accountToEdit, setAccountToEdit] = useState(null)
    const [isAddStyleModalOpen, setIsAddStyleModalOpen] = useState(false)
    const [activeContext, setActiveContext] = useState(null)
    const [selectedFrameworks, setSelectedFrameworks] = useState({})
    const [globalFrameworks, setGlobalFrameworks] = useState([])
    const [selectedGlobalFrameworkId, setSelectedGlobalFrameworkId] = useState(null)

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const stylesData = await fetchStyles()
                setStyles(stylesData)
                try {
                    const globalData = await fetchFrameworks('__global__')
                    setGlobalFrameworks(globalData.frameworks || [])
                } catch (_) { }
                try {
                    const generatedData = await fetchGeneratedPosts()
                    const restored = {}
                    Object.entries(generatedData).forEach(([styleId, entry]) => {
                        if (entry?.content) restored[styleId] = entry.content
                    })
                    setPosts(restored)
                } catch (_) { }
                try {
                    const selData = await fetchSourceSelections()
                    setSourceSelections(selData)
                } catch (_) { }
                try {
                    const accountsData = await fetchAccounts()
                    setAccounts(accountsData)
                    const currentData = await fetchCurrentAccount()
                    setCurrentAccount(currentData)
                } catch (err) {
                    console.error("Failed to load accounts:", err)
                }
            } catch (err) {
                console.error("Failed to load initial data:", err)
            }
        }
        loadInitialData()
    }, [])

    useEffect(() => {
        window.__setTopic = (t) => setTopic(t)
        window.__generatePost = (styleId) => handleGenerate(styleId)
        window.__generateAll = () => generateAll()
        return () => {
            delete window.__setTopic
            delete window.__generatePost
            delete window.__generateAll
        }
    })

    const handleAddStyle = async (name, xUsername) => {
        const newStyle = await addCustomStyle(name, xUsername)
        setStyles(prev => [...prev, newStyle])
    }

    const handleDeleteStyle = async (styleId) => {
        if (!confirm('このスタイルを削除しますか？')) return
        try {
            await deleteCustomStyle(styleId)
            setStyles(prev => prev.filter(s => s.id !== styleId))
            setPosts(prev => { const next = { ...prev }; delete next[styleId]; return next })
        } catch (err) {
            alert(`削除に失敗しました: ${err.message}`)
        }
    }

    const handleSwitchAccount = async (accountId) => {
        try {
            const data = await switchAccount(accountId)
            setCurrentAccount(data.current)
        } catch (err) {
            alert(`アカウント切り替えに失敗しました: ${err.message}`)
        }
    }

    const handleAddOrEditAccount = async (config, isEdit) => {
        try {
            if (isEdit) {
                await editAccount(config.id, config)
                alert('アカウント情報を更新しました')
            } else {
                await addAccount(config)
                alert('アカウントを追加しました')
            }
            const accountsData = await fetchAccounts()
            setAccounts(accountsData)
            const currentData = await fetchCurrentAccount()
            setCurrentAccount(currentData)
            setIsAccountModalOpen(false)
            setAccountToEdit(null)
        } catch (err) {
            alert(`アカウント${isEdit ? '更新' : '追加'}に失敗しました: ${err.message}`)
        }
    }

    const handleGenerate = async (styleId) => {
        if (!topic && !activeContext) {
            alert("トピックを入力するか、AIチャットでコンテキストを確定してください")
            return
        }
        setLoading(prev => ({ ...prev, [styleId]: true }))
        try {
            const frameworkId = selectedFrameworks[styleId] || selectedGlobalFrameworkId || null
            const data = await generatePost(styleId, topic, activeContext, frameworkId)
            setPosts(prev => ({ ...prev, [styleId]: data.content }))
        } catch (err) {
            alert(`生成に失敗しました: ${err.message}`)
        } finally {
            setLoading(prev => ({ ...prev, [styleId]: false }))
        }
    }

    const handleFrameworkSelect = (styleId, frameworkId) => {
        setSelectedFrameworks(prev => ({ ...prev, [styleId]: frameworkId }))
    }

    const handleGlobalFrameworkExtract = async (xUsername) => {
        return await extractFrameworksByUsername(xUsername)
    }

    const handleGlobalFrameworkSave = async (selectedFws) => {
        const existingIds = new Set(globalFrameworks.map(fw => fw.id))
        const newFws = selectedFws.filter(fw => !existingIds.has(fw.id))
        const merged = [...globalFrameworks, ...newFws]
        const data = await saveFrameworks('__global__', 'Global', merged)
        setGlobalFrameworks(data.frameworks || [])
    }

    const handleGlobalFrameworkDelete = async (frameworkId) => {
        await deleteFramework('__global__', frameworkId)
        setGlobalFrameworks(prev => prev.filter(fw => fw.id !== frameworkId))
        if (selectedGlobalFrameworkId === frameworkId) {
            setSelectedGlobalFrameworkId(null)
        }
    }

    const handleGlobalFrameworkSelect = (frameworkId) => {
        setSelectedGlobalFrameworkId(frameworkId)
    }

    const generateAll = async () => {
        for (const s of styles) {
            await handleGenerate(s.id)
            await new Promise(r => setTimeout(r, 1000))
        }
    }

    const handlePost = async (content) => {
        if (!content) return
        if (!confirm("Xに投稿しますか？\n（凍結防止のため、30〜300秒のランダムな待機時間が入ります）")) return
        try {
            const data = await postToX(content)
            if (data.status === "queued") {
                alert("投稿をキューに入れました。\n" + data.message)
            } else {
                alert("投稿に成功しました！")
            }
        } catch (err) {
            alert(`通信エラーが発生しました: ${err.message}`)
        }
    }

    const handleSchedule = (styleId) => {
        const time = prompt("投稿時間を入力してください (例: 20:00)")
        if (time) {
            setScheduling(prev => ({ ...prev, [styleId]: time }))
            alert(`${time} に予約しました（シミュレーション）`)
        }
    }

    const setPostContent = (styleId, content) => {
        setPosts(prev => ({ ...prev, [styleId]: content }))
    }

    return (
        <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: '#0e1120' }}>

            {/* ── Sidebar ── */}
            <aside style={{
                width: 220,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                background: '#0b0e1a',
                borderRight: '1px solid rgba(255,255,255,0.06)',
            }}>

                {/* Logo */}
                <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 34, height: 34, borderRadius: 10,
                            background: 'linear-gradient(135deg, #1d9bf0, #6366f1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 14px rgba(29,155,240,0.4)',
                            fontSize: 16, fontWeight: 800, color: 'white',
                        }}>
                            X
                        </div>
                        <div>
                            <div style={{ color: 'white', fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>投稿自動化</div>
                            <div style={{ color: '#1d9bf0', fontSize: 11, fontWeight: 500 }}>X Agent System</div>
                        </div>
                    </div>
                </div>

                {/* Account Switcher */}
                <SidebarAccountSwitcher
                    currentAccount={currentAccount}
                    accounts={accounts}
                    onSwitch={handleSwitchAccount}
                    onEdit={(acc) => { setAccountToEdit(acc); setIsAccountModalOpen(true) }}
                    onAdd={() => { setAccountToEdit(null); setIsAccountModalOpen(true) }}
                />

                {/* Nav */}
                <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {NAV.map(({ id, label, icon: Icon }) => {
                        const active = activeTab === id
                        return (
                            <button key={id} onClick={() => setActiveTab(id)} style={{
                                width: '100%',
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '9px 12px',
                                borderRadius: 9,
                                border: 'none',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontFamily: 'inherit',
                                fontSize: 13,
                                fontWeight: active ? 600 : 400,
                                background: active ? 'rgba(29,155,240,0.12)' : 'transparent',
                                color: active ? '#60c4fc' : '#7481a0',
                                transition: 'all 0.15s',
                            }}
                                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#aab4cc' } }}
                                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#7481a0' } }}
                            >
                                <Icon size={15} style={{ flexShrink: 0 }} />
                                {label}
                                {active && (
                                    <div style={{
                                        marginLeft: 'auto', width: 3, height: 16, borderRadius: 2,
                                        background: 'linear-gradient(180deg, #1d9bf0, #6366f1)',
                                    }} />
                                )}
                            </button>
                        )
                    })}
                </nav>

                {/* Online status */}
                <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ position: 'relative', width: 8, height: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
                            <div style={{
                                position: 'absolute', inset: -2, borderRadius: '50%',
                                background: 'rgba(34,197,94,0.3)', animation: 'pulse 2s infinite',
                            }} />
                        </div>
                        <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 500 }}>System Online</span>
                    </div>
                </div>
            </aside>

            {/* ── Main ── */}
            <main style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', background: '#070b14' }}>
                <div style={{ padding: '28px 32px', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>

                    {activeTab === 'history' ? (
                        <HistoryPanel />
                    ) : activeTab === 'scheduler' ? (
                        <SchedulerPanel />
                    ) : (
                        <>
                            <FrameworkExtractorPanel
                                globalFrameworks={globalFrameworks}
                                selectedGlobalFrameworkId={selectedGlobalFrameworkId}
                                onExtract={handleGlobalFrameworkExtract}
                                onSave={handleGlobalFrameworkSave}
                                onDelete={handleGlobalFrameworkDelete}
                                onSelect={handleGlobalFrameworkSelect}
                            />

                            <TopicInput
                                topic={topic}
                                setTopic={setTopic}
                                onGenerateAll={generateAll}
                            />

                            {/* ソースバー */}
                            <div className="sync-bar">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                                    <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.03em', flexShrink: 0 }}>ソース:</span>
                                    {(() => {
                                        const urls = sourceSelections.urls || []
                                        if (urls.length === 0) {
                                            return <span style={{ color: '#475569', fontSize: '0.8rem' }}>未選択</span>
                                        }
                                        return urls.map((u, i) => (
                                            <span key={i} style={{
                                                display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                                padding: '0.2rem 0.6rem', borderRadius: '6px',
                                                background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)',
                                                color: '#60a5fa', fontSize: '0.75rem', fontWeight: 600,
                                            }}>
                                                <LinkIcon size={11} />
                                                {u.title || 'URL'}
                                            </span>
                                        ))
                                    })()}
                                </div>
                                <button
                                    onClick={() => setShowSourceSelector(true)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                                        padding: '0.45rem 0.9rem', borderRadius: '8px',
                                        background: 'rgba(96,165,250,0.08)',
                                        border: '1px solid rgba(96,165,250,0.2)',
                                        color: '#93c5fd', cursor: 'pointer',
                                        fontSize: '0.8rem', fontWeight: 600,
                                    }}
                                >
                                    ソースを選択
                                </button>
                            </div>
                            {showSourceSelector && (
                                <SourceSelector
                                    onClose={() => setShowSourceSelector(false)}
                                    onSaved={(sel) => setSourceSelections(sel)}
                                />
                            )}

                            {/* 2カラムレイアウト: 左=スタイルカード / 右=AIチャット */}
                            <div className="main-split">
                                <div className="main-left">
                                    <div className="styles-grid">
                                        {styles.map(style => (
                                            <StyleCard
                                                key={style.id}
                                                style={style}
                                                post={posts[style.id]}
                                                loading={loading[style.id]}
                                                onGenerate={handleGenerate}
                                                onPost={handlePost}
                                                onSchedule={handleSchedule}
                                                scheduledTime={scheduling[style.id]}
                                                setPostContent={setPostContent}
                                                onDelete={handleDeleteStyle}
                                                frameworks={globalFrameworks}
                                                selectedFrameworkId={selectedFrameworks[style.id] || null}
                                                onFrameworkSelect={handleFrameworkSelect}
                                            />
                                        ))}
                                        <div className="add-card" onClick={() => setIsAddStyleModalOpen(true)} style={{ cursor: 'pointer' }}>
                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid rgba(96,165,250,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <span style={{ fontSize: '1.5rem', fontWeight: 300, color: '#334155' }}>+</span>
                                            </div>
                                            <p style={{ margin: 0, fontSize: '0.9rem' }}>スタイルを追加</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="main-right">
                                    <ChatPanel
                                        onContextConfirm={setActiveContext}
                                        activeContext={activeContext}
                                        onContextClear={() => setActiveContext(null)}
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    <footer className="footer" style={{ marginTop: 'auto', paddingTop: '2rem' }}>
                        <p style={{ margin: 0 }}>© 2026 株式会社からもん AI Agent Div.</p>
                        <div className="footer-badges">
                            <span className="footer-badge">
                                <Cpu style={{ width: '14px', height: '14px', color: '#a855f7' }} />
                                Gemini 2.0 Enabled
                            </span>
                            <span className="footer-badge">
                                <ShieldCheck style={{ width: '14px', height: '14px', color: '#60a5fa' }} />
                                X API v2 Authenticated
                            </span>
                        </div>
                    </footer>
                </div>
            </main>

            <AccountModal
                isOpen={isAccountModalOpen}
                onClose={() => {
                    setIsAccountModalOpen(false)
                    setAccountToEdit(null)
                }}
                onSubmit={handleAddOrEditAccount}
                initialData={accountToEdit}
            />

            <AddStyleModal
                isOpen={isAddStyleModalOpen}
                onClose={() => setIsAddStyleModalOpen(false)}
                onSubmit={handleAddStyle}
                existingNames={styles.map(s => s.name.toLowerCase())}
            />

            <style>{`
                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 0.6; }
                    50% { transform: scale(1.5); opacity: 0; }
                }
            `}</style>
        </div>
    )
}

export default XAgentApp
