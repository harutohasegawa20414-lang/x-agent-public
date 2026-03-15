import React, { useState, useEffect, useRef } from 'react'
import { FileText, Sheet, BookOpen, Link, Check, Loader2, X, Trash2 } from 'lucide-react'
import { fetchDriveFiles, fetchNotionEntries, fetchSourceSelections, saveSourceSelections, fetchUrlContent } from '../api'

export default function SourceSelector({ onClose, onSaved }) {
    const [activeTab, setActiveTab] = useState('drive')
    const [driveFiles, setDriveFiles] = useState([])
    const [notionEntries, setNotionEntries] = useState([])
    const [selectedDrive, setSelectedDrive] = useState([])
    const [selectedNotion, setSelectedNotion] = useState([])
    const [urlSources, setUrlSources] = useState([])
    const [urlInput, setUrlInput] = useState('')
    const [urlLoading, setUrlLoading] = useState(false)
    const [urlError, setUrlError] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const ref = useRef(null)

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            try {
                const [driveRes, notionRes, selRes] = await Promise.all([
                    fetchDriveFiles(),
                    fetchNotionEntries(),
                    fetchSourceSelections(),
                ])
                setDriveFiles(driveRes.files || [])
                setNotionEntries(notionRes.entries || [])
                setSelectedDrive(selRes.drive || [])
                setSelectedNotion(selRes.notion || [])
                if (selRes.urls && selRes.urls.length > 0) {
                    setUrlSources(selRes.urls.map(u => ({ ...u, selected: true })))
                }
            } catch (e) {
                console.error(e)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    // モーダル外クリックで閉じる
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) onClose()
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [onClose])

    const toggleDrive = (id) => {
        setSelectedDrive(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    }

    const toggleNotion = (id) => {
        setSelectedNotion(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    }

    const handleFetchUrl = async () => {
        const url = urlInput.trim()
        if (!url) return
        setUrlLoading(true)
        setUrlError('')
        try {
            const result = await fetchUrlContent(url)
            if (result.status !== 'ok') {
                setUrlError(result.error || 'コンテンツの取得に失敗しました')
            } else {
                setUrlSources(prev => [...prev, { ...result, selected: true }])
                setUrlInput('')
            }
        } catch (e) {
            setUrlError(e.message)
        } finally {
            setUrlLoading(false)
        }
    }

    const toggleUrlSource = (index) => {
        setUrlSources(prev => prev.map((u, i) => i === index ? { ...u, selected: !u.selected } : u))
    }

    const removeUrlSource = (index) => {
        setUrlSources(prev => prev.filter((_, i) => i !== index))
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const selectedUrls = urlSources.filter(u => u.selected).map(u => ({
                url: u.url, title: u.title, text: u.text, type: u.type,
            }))
            await saveSourceSelections(selectedDrive, selectedNotion, selectedUrls)
            onSaved && onSaved({ drive: selectedDrive, notion: selectedNotion, urls: selectedUrls })
            onClose()
        } catch (e) {
            alert('保存に失敗しました: ' + e.message)
        } finally {
            setSaving(false)
        }
    }

    const totalSelected = selectedDrive.length + selectedNotion.length + urlSources.filter(u => u.selected).length

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
        }}>
            <div ref={ref} style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                border: '1px solid rgba(96,165,250,0.2)',
                borderRadius: '16px',
                width: '480px',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
            }}>
                {/* ヘッダー */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '1.2rem 1.5rem',
                    borderBottom: '1px solid rgba(96,165,250,0.1)',
                }}>
                    <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: '1rem' }}>
                        一次情報ソースを選択
                    </span>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                        <X size={18} />
                    </button>
                </div>

                {/* タブ */}
                <div style={{ display: 'flex', borderBottom: '1px solid rgba(96,165,250,0.1)' }}>
                    {[
                        { id: 'drive', label: 'Google Drive', icon: <FileText size={14} /> },
                        { id: 'notion', label: 'Notion', icon: <BookOpen size={14} /> },
                        { id: 'url', label: 'URL', icon: <Link size={14} /> },
                    ].map(tab => {
                        const count = tab.id === 'drive' ? selectedDrive.length
                            : tab.id === 'notion' ? selectedNotion.length
                            : urlSources.filter(u => u.selected).length
                        return (
                            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                                flex: 1, padding: '0.75rem',
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: activeTab === tab.id ? '#60a5fa' : '#64748b',
                                borderBottom: activeTab === tab.id ? '2px solid #60a5fa' : '2px solid transparent',
                                fontWeight: activeTab === tab.id ? 700 : 400,
                                fontSize: '0.85rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                                transition: 'all 0.15s',
                            }}>
                                {tab.icon} {tab.label}
                                {count > 0 && (
                                    <span style={{ background: '#3b82f6', color: 'white', borderRadius: '10px', padding: '0 6px', fontSize: '0.7rem' }}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>

                {/* リスト */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
                    {loading && activeTab !== 'url' ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', color: '#64748b' }}>
                            <Loader2 size={20} className="animate-spin" />
                        </div>
                    ) : activeTab === 'drive' ? (
                        driveFiles.length === 0 ? (
                            <p style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>
                                ファイルがありません
                            </p>
                        ) : driveFiles.map(file => (
                            <SourceItem
                                key={file.id}
                                label={file.name}
                                icon={file.type === 'spreadsheet' ? <Sheet size={15} /> : <FileText size={15} />}
                                checked={selectedDrive.includes(file.id)}
                                onToggle={() => toggleDrive(file.id)}
                            />
                        ))
                    ) : activeTab === 'notion' ? (
                        notionEntries.length === 0 ? (
                            <p style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>
                                エントリがありません
                            </p>
                        ) : notionEntries.map(entry => (
                            <SourceItem
                                key={entry.id}
                                label={entry.name}
                                icon={<BookOpen size={15} />}
                                checked={selectedNotion.includes(entry.id)}
                                onToggle={() => toggleNotion(entry.id)}
                            />
                        ))
                    ) : (
                        /* URL タブ */
                        <div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <input
                                    type="text"
                                    value={urlInput}
                                    onChange={(e) => { setUrlInput(e.target.value); setUrlError('') }}
                                    onKeyDown={(e) => e.key === 'Enter' && handleFetchUrl()}
                                    placeholder="Google Drive / Notion の URL を貼り付け"
                                    style={{
                                        flex: 1, padding: '0.5rem 0.75rem', borderRadius: '8px',
                                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(96,165,250,0.2)',
                                        color: '#e2e8f0', fontSize: '0.85rem', outline: 'none',
                                    }}
                                />
                                <button onClick={handleFetchUrl} disabled={urlLoading || !urlInput.trim()} style={{
                                    padding: '0.5rem 1rem', borderRadius: '8px',
                                    background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                                    border: 'none', color: 'white', cursor: 'pointer',
                                    fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap',
                                    opacity: urlLoading || !urlInput.trim() ? 0.5 : 1,
                                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                                }}>
                                    {urlLoading ? <Loader2 size={14} className="animate-spin" /> : '取得'}
                                </button>
                            </div>
                            {urlError && (
                                <p style={{ color: '#f87171', fontSize: '0.8rem', margin: '0 0 0.75rem 0' }}>
                                    {urlError}
                                </p>
                            )}
                            {urlSources.length === 0 ? (
                                <p style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem 0' }}>
                                    URLを貼り付けてコンテンツを取得してください
                                </p>
                            ) : urlSources.map((src, idx) => (
                                <div key={idx} style={{
                                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                                    padding: '0.65rem 0.75rem', borderRadius: '8px',
                                    cursor: 'pointer', marginBottom: '0.3rem',
                                    background: src.selected ? 'rgba(59,130,246,0.1)' : 'transparent',
                                    border: src.selected ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
                                    transition: 'all 0.15s',
                                }}>
                                    <div onClick={() => toggleUrlSource(idx)} style={{
                                        width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                                        border: src.selected ? '2px solid #3b82f6' : '2px solid #475569',
                                        background: src.selected ? '#3b82f6' : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer',
                                    }}>
                                        {src.selected && <Check size={11} color="white" />}
                                    </div>
                                    <span style={{
                                        color: '#94a3b8', display: 'flex', alignItems: 'center',
                                        fontSize: '0.7rem', fontWeight: 700,
                                        background: src.type === 'gdrive' ? 'rgba(52,211,153,0.15)' : 'rgba(168,85,247,0.15)',
                                        color: src.type === 'gdrive' ? '#34d399' : '#a855f7',
                                        padding: '2px 6px', borderRadius: '4px',
                                    }}>
                                        {src.type === 'gdrive' ? 'G' : 'N'}
                                    </span>
                                    <span onClick={() => toggleUrlSource(idx)} style={{
                                        color: '#e2e8f0', fontSize: '0.85rem', flex: 1, cursor: 'pointer',
                                    }}>
                                        {src.title || 'ドキュメント'}
                                    </span>
                                    <button onClick={() => removeUrlSource(idx)} style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        color: '#64748b', padding: '2px', display: 'flex',
                                    }}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* フッター */}
                <div style={{
                    padding: '1rem 1.5rem',
                    borderTop: '1px solid rgba(96,165,250,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <span style={{ color: '#64748b', fontSize: '0.8rem' }}>
                        {totalSelected > 0 ? `${totalSelected} 件選択中` : '全件を使用（未選択）'}
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={onClose} style={{
                            padding: '0.5rem 1rem', borderRadius: '8px',
                            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                            color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem',
                        }}>キャンセル</button>
                        <button onClick={handleSave} disabled={saving} style={{
                            padding: '0.5rem 1.2rem', borderRadius: '8px',
                            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                            border: 'none', color: 'white', cursor: 'pointer',
                            fontSize: '0.85rem', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                        }}>
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            適用
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function SourceItem({ label, icon, checked, onToggle }) {
    return (
        <div onClick={onToggle} style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.65rem 0.75rem', borderRadius: '8px',
            cursor: 'pointer', marginBottom: '0.3rem',
            background: checked ? 'rgba(59,130,246,0.1)' : 'transparent',
            border: checked ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
            transition: 'all 0.15s',
        }}>
            <div style={{
                width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                border: checked ? '2px solid #3b82f6' : '2px solid #475569',
                background: checked ? '#3b82f6' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                {checked && <Check size={11} color="white" />}
            </div>
            <span style={{ color: '#94a3b8', display: 'flex', alignItems: 'center' }}>{icon}</span>
            <span style={{ color: '#e2e8f0', fontSize: '0.85rem', flex: 1 }}>{label}</span>
        </div>
    )
}
