import React, { useState, useEffect, useCallback } from 'react'
import { fetchHistory, deleteHistoryEntry } from '../api'
import { Trash2, RefreshCcw, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react'

const STATUS_MAP = {
    queued: { label: '待機中', icon: <Loader2 size={13} className="spin-icon" />, color: '#f59e0b' },
    posted: { label: '投稿済', icon: <CheckCircle2 size={13} />, color: '#22c55e' },
    failed: { label: '失敗', icon: <XCircle size={13} />, color: '#ef4444' },
}

function HistoryPanel() {
    const [history, setHistory] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all') // all | queued | posted | failed

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const data = await fetchHistory()
            setHistory(data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    // 30秒ごとに自動更新（バックグラウンド投稿を反映するため）
    useEffect(() => {
        const interval = setInterval(() => {
            load();
        }, 30000);
        return () => clearInterval(interval);
    }, [load]);

    const handleDelete = async (id) => {
        if (!confirm('この投稿履歴を削除しますか？')) return
        try {
            await deleteHistoryEntry(id)
            setHistory(prev => prev.filter(h => h.id !== id))
        } catch (e) {
            alert(`削除に失敗しました: ${e.message}`)
        }
    }

    const filtered = filter === 'all' ? history : history.filter(h => h.status === filter)

    return (
        <div className="history-panel">
            {/* ツールバー */}
            <div className="history-toolbar">
                <div className="history-filters">
                    {['all', 'queued', 'posted', 'failed'].map(f => (
                        <button
                            key={f}
                            className={`filter-tab ${filter === f ? 'active' : ''}`}
                            onClick={() => setFilter(f)}
                        >
                            {f === 'all' ? 'すべて' : STATUS_MAP[f]?.label}
                            <span className="filter-count">
                                {f === 'all' ? history.length : history.filter(h => h.status === f).length}
                            </span>
                        </button>
                    ))}
                </div>
                <button className="history-refresh-btn" onClick={load} disabled={loading}>
                    <RefreshCcw size={13} className={loading ? 'spin-icon' : ''} />
                    更新
                </button>
            </div>

            {/* コンテンツ */}
            {loading ? (
                <div className="history-empty">
                    <Loader2 size={28} className="spin-icon" style={{ color: '#60a5fa' }} />
                    <p>読み込み中...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="history-empty">
                    <Clock size={32} style={{ color: '#334155' }} />
                    <p>投稿履歴がありません</p>
                </div>
            ) : (
                <div className="history-list">
                    {filtered.map(entry => {
                        const st = STATUS_MAP[entry.status] ?? STATUS_MAP.queued
                        return (
                            <div key={entry.id} className="history-card">
                                <div className="history-card-header">
                                    <div className="history-meta">
                                        <span className="history-account">{entry.account_name ?? '不明'}</span>
                                        {entry.style_name && (
                                            <span className="history-style">#{entry.style_name}</span>
                                        )}
                                    </div>
                                    <div className="history-actions">
                                        <span className="history-status" style={{ color: st.color }}>
                                            {st.icon}
                                            {st.label}
                                        </span>
                                        <button
                                            className="history-delete-btn"
                                            onClick={() => handleDelete(entry.id)}
                                            title="削除"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                                <p className="history-content">{entry.content}</p>
                                <p className="history-date">
                                    {entry.posted_at
                                        ? new Date(entry.posted_at).toLocaleString('ja-JP')
                                        : '---'}
                                </p>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

export default HistoryPanel
