import React, { useState, useEffect, useCallback } from 'react'
import { fetchSchedulerStatus, fetchSchedulerConfig, runSchedulerJobNow, updateSchedulerConfig, refreshScheduler, fetchStyles, fetchGeneratedPosts } from '../api'
import { Play, Clock, CheckCircle2, RefreshCcw, Loader2, Save, FileText, Calendar, Sparkles, X } from 'lucide-react'
import IosTimePicker from './IosTimePicker'
import IosDatePicker from './IosDatePicker'

// タイムピッカーとカレンダーからの情報をCron文字列 (min hour day month dow) に変換
const parseCron = (cronStr) => {
    if (!cronStr) return { time: "09:00", date: null }
    const parts = cronStr.split(' ')
    const min = parts[0].padStart(2, '0')
    const hour = parts[1].padStart(2, '0')
    const day = parts[2] === '*' ? null : parseInt(parts[2], 10)
    const month = parts[3] === '*' ? null : parseInt(parts[3], 10)

    let date = null
    if (day !== null && month !== null) {
        const now = new Date()
        date = new Date(now.getFullYear(), month - 1, day)
    }

    return {
        time: `${hour}:${min}`,
        date: date
    }
}

const buildCron = (timeStr, dateObj) => {
    const [hour, min] = timeStr.split(':')
    const minutePart = parseInt(min, 10).toString()
    const hourPart = parseInt(hour, 10).toString()

    if (dateObj) {
        const d = new Date(dateObj)
        return `${minutePart} ${hourPart} ${d.getDate()} ${d.getMonth() + 1} *`
    }
    return `${minutePart} ${hourPart} * * *`
}

function SchedulerPanel() {
    const [status, setStatus] = useState(null)
    const [config, setConfig] = useState(null)
    const [styles, setStyles] = useState([])
    const [generatedPosts, setGeneratedPosts] = useState({})
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [runningJob, setRunningJob] = useState(null)

    // UI編集上のローカルステート
    const [editedJobs, setEditedJobs] = useState({})

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [statusData, configData, stylesData, generatedData] = await Promise.all([
                fetchSchedulerStatus(),
                fetchSchedulerConfig(),
                fetchStyles(),
                fetchGeneratedPosts()
            ])
            setStatus(statusData)
            setConfig(configData)
            setStyles(stylesData)
            setGeneratedPosts(generatedData || {})

            // 編集用ステートの初期化
            const initialEdits = {}
            configData?.jobs?.forEach(job => {
                const { time, date } = parseCron(job.cron)
                initialEdits[job.id] = {
                    topic: job.topic || '',
                    content: job.content || '',
                    time: time,
                    date: date,
                    showCalendar: false
                }
            })
            setEditedJobs(initialEdits)

        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadData() }, [loadData])

    const handleRunNow = async (jobId) => {
        setRunningJob(jobId)
        try {
            await runSchedulerJobNow(jobId)
            alert("ジョブを即時実行キューに入れました。履歴を確認してください。")
        } catch (e) {
            alert(`実行エラー: ${e.message}`)
        } finally {
            setRunningJob(null)
        }
    }

    const handleRefresh = async () => {
        setRefreshing(true)
        try {
            await refreshScheduler()
            await loadData()
        } catch (e) {
            alert(`更新エラー: ${e.message}`)
        } finally {
            setRefreshing(false)
        }
    }

    const handleJobEditChange = (jobId, field, value) => {
        setEditedJobs(prev => ({
            ...prev,
            [jobId]: {
                ...prev[jobId],
                [field]: value
            }
        }))
    }

    const saveJobChanges = async (jobId) => {
        if (!config) return
        const editData = editedJobs[jobId]

        const updatedJobs = config.jobs.map(job => {
            if (job.id === jobId) {
                return {
                    ...job,
                    topic: editData.topic,
                    content: editData.content || '',
                    cron: buildCron(editData.time, editData.date),
                    enabled: true
                }
            }
            return job
        })

        try {
            await updateSchedulerConfig({ ...config, enabled: true, jobs: updatedJobs })
            await loadData()
        } catch (e) {
            alert(`保存エラー: ${e.message}`)
        }
    }

    if (loading && !status) {
        return (
            <div className="scheduler-empty">
                <Loader2 size={24} className="animate-spin" style={{ color: '#6366f1' }} />
                <p>スケジューラー情報を読み込み中...</p>
            </div>
        )
    }

    // スタイル情報を辞書化してルックアップしやすくする
    const styleMap = styles.reduce((acc, style) => {
        acc[style.id] = style
        return acc
    }, {})

    return (
        <div className="scheduler-panel">
            {/* 常時稼働ステータス表示 */}
            <div style={{ marginBottom: '1.5rem', background: 'rgba(15, 23, 50, 0.8)', border: '1px solid rgba(96, 165, 250, 0.2)', borderRadius: '16px', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', padding: '0.4rem 0.8rem', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.85rem', flexShrink: 0 }}>
                    <CheckCircle2 size={16} />
                    スケジューラー稼働中
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>ダッシュボード起動中は全スケジュールが常時アクティブです。</p>
            </div>

            {/* スケジュールカードのグリッド */}
            <div className="styles-grid scheduler-grid">
                {config?.jobs?.map(job => {
                    const activeJob = status?.active_jobs?.find(aj => aj.id === job.id)
                    const styleInfo = styleMap[job.style_id] || { name: job.style_id, id: job.style_id }
                    const editData = editedJobs[job.id] || { topic: '', time: '09:00', date: null }

                    // 変更があるかどうかを判定
                    const isChanged = editData.topic !== (job.topic || '') ||
                        editData.content !== (job.content || '') ||
                        editData.time !== parseCron(job.cron).time ||
                        JSON.stringify(editData.date) !== JSON.stringify(parseCron(job.cron).date)

                    // このスタイルの生成済みツイート（投稿生成タブから）
                    const latestGenerated = generatedPosts[job.style_id]

                    return (
                        <div key={job.id} className="style-card scheduler-card">
                            {/* カードヘッダー */}
                            <div className="style-card-header" style={{ borderBottom: '1px solid rgba(96, 165, 250, 0.1)', paddingBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                                    <div className="style-avatar" style={{ background: 'linear-gradient(135deg, #10b981, #047857)' }}>
                                        {styleInfo.name ? styleInfo.name[0] : '?'}
                                    </div>
                                    <div style={{ marginLeft: '0.75rem' }}>
                                        <h3 className="style-name" style={{ margin: 0 }}>{styleInfo.name}</h3>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Clock size={10} />
                                            次回: {activeJob?.next_run_time ? new Date(activeJob.next_run_time).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '未定'}
                                        </div>
                                    </div>
                                </div>

                            </div>

                            {/* 日付の指定 */}
                            <div style={{ position: 'relative', zIndex: editData.showCalendar ? 20 : 'auto' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '8px' }}>
                                    <Calendar size={12} />
                                    日付の指定
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            onClick={() => handleJobEditChange(job.id, 'showCalendar', !editData.showCalendar)}
                                            style={{
                                                width: '100%',
                                                background: 'rgba(0,0,0,0.2)',
                                                border: '1px solid rgba(96, 165, 250, 0.2)',
                                                borderRadius: '8px',
                                                padding: '0.6rem 1rem',
                                                color: editData.date ? '#60a5fa' : '#94a3b8',
                                                textAlign: 'left',
                                                fontSize: '0.9rem',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <span>{editData.date ? new Date(editData.date).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }) : '毎日投稿（日付指定なし）'}</span>
                                            <Calendar size={14} />
                                        </button>

                                        {editData.showCalendar && (
                                            <div style={{
                                                position: 'absolute',
                                                bottom: 'calc(100% + 8px)',
                                                left: 0,
                                                right: 0,
                                                zIndex: 60,
                                                transformOrigin: 'bottom center'
                                            }}>
                                                <IosDatePicker
                                                    value={editData.date}
                                                    onChange={(newDate) => {
                                                        handleJobEditChange(job.id, 'date', newDate)
                                                        handleJobEditChange(job.id, 'showCalendar', false)
                                                    }}
                                                />
                                                <button
                                                    onClick={() => {
                                                        handleJobEditChange(job.id, 'date', null)
                                                        handleJobEditChange(job.id, 'showCalendar', false)
                                                    }}
                                                    style={{
                                                        width: '100%',
                                                        marginTop: '8px',
                                                        background: 'rgba(239, 68, 68, 0.2)',
                                                        color: '#f87171',
                                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                                        borderRadius: '8px',
                                                        padding: '0.5rem',
                                                        fontSize: '0.8rem',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    日付指定を解除（毎日）
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '8px' }}>
                                        <Clock size={12} />
                                        投稿時刻
                                    </label>
                                    <IosTimePicker
                                        value={editData.time}
                                        onChange={(newTime) => handleJobEditChange(job.id, 'time', newTime)}
                                    />
                                </div>

                                {/* トピック設定 */}
                                <div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '4px' }}>
                                        <FileText size={12} />
                                        投稿トピック・指示
                                    </label>
                                    <textarea
                                        value={editData.topic}
                                        onChange={(e) => handleJobEditChange(job.id, 'topic', e.target.value)}
                                        placeholder="例：AIを活用した業務効率化について"
                                        style={{
                                            width: '100%',
                                            background: 'rgba(0,0,0,0.2)',
                                            border: '1px solid rgba(96, 165, 250, 0.2)',
                                            borderRadius: '8px',
                                            padding: '0.5rem',
                                            color: '#e2e8f0',
                                            fontFamily: 'Inter, sans-serif',
                                            resize: 'none',
                                            height: '80px',
                                            fontSize: '0.85rem'
                                        }}
                                    />
                                </div>

                                {/* 生成済みツイート（投稿生成タブと同期） */}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#94a3b8' }}>
                                            <Sparkles size={12} />
                                            ツイート内容（指定時はこの内容を投稿）
                                        </label>
                                        <div style={{ display: 'flex', gap: '4px' }}>
                                            {latestGenerated?.content && (
                                                <button
                                                    onClick={() => handleJobEditChange(job.id, 'content', latestGenerated.content)}
                                                    title="投稿生成タブの最新内容をセット"
                                                    style={{
                                                        background: 'rgba(99,102,241,0.15)',
                                                        border: '1px solid rgba(99,102,241,0.3)',
                                                        borderRadius: '5px',
                                                        padding: '2px 7px',
                                                        cursor: 'pointer',
                                                        color: '#818cf8',
                                                        fontSize: '0.68rem',
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    生成済みをセット
                                                </button>
                                            )}
                                            {editData.content && (
                                                <button
                                                    onClick={() => handleJobEditChange(job.id, 'content', '')}
                                                    title="内容をクリア（自動生成に戻す）"
                                                    style={{
                                                        background: 'rgba(239,68,68,0.1)',
                                                        border: '1px solid rgba(239,68,68,0.2)',
                                                        borderRadius: '5px',
                                                        padding: '2px 6px',
                                                        cursor: 'pointer',
                                                        color: '#f87171',
                                                        fontSize: '0.68rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '2px',
                                                    }}
                                                >
                                                    <X size={9} /> クリア
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <textarea
                                        value={editData.content}
                                        onChange={(e) => handleJobEditChange(job.id, 'content', e.target.value)}
                                        placeholder="空欄の場合はトピックから自動生成されます"
                                        style={{
                                            width: '100%',
                                            background: editData.content ? 'rgba(99,102,241,0.05)' : 'rgba(0,0,0,0.2)',
                                            border: editData.content
                                                ? '1px solid rgba(99,102,241,0.3)'
                                                : '1px solid rgba(96,165,250,0.15)',
                                            borderRadius: '8px',
                                            padding: '0.5rem',
                                            color: editData.content ? '#c7d2fe' : '#64748b',
                                            fontFamily: 'Inter, sans-serif',
                                            resize: 'none',
                                            height: '90px',
                                            fontSize: '0.83rem',
                                            lineHeight: 1.5,
                                        }}
                                    />
                                    {latestGenerated && (
                                        <p style={{ margin: '4px 0 0', fontSize: '0.68rem', color: '#475569' }}>
                                            最終生成: {new Date(latestGenerated.generated_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    )}
                                </div>

                            {/* アクションボタン群 */}
                            <div className="action-buttons" style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    onClick={() => handleRunNow(job.id)}
                                    disabled={runningJob === job.id}
                                    style={{
                                        flex: 1,
                                        background: 'transparent',
                                        color: '#cbd5e1',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px',
                                        padding: '0.5rem',
                                        fontSize: '0.8rem',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.3rem',
                                    }}
                                >
                                    {runningJob === job.id ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                                    テスト生成
                                </button>

                                <button
                                    onClick={() => saveJobChanges(job.id)}
                                    disabled={!isChanged}
                                    style={{
                                        flex: 1,
                                        background: isChanged ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'rgba(59, 130, 246, 0.2)',
                                        color: isChanged ? 'white' : 'rgba(255,255,255,0.4)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '0.5rem',
                                        fontSize: '0.8rem',
                                        fontWeight: '600',
                                        cursor: isChanged ? 'pointer' : 'not-allowed',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.3rem',
                                    }}
                                >
                                    <Save size={14} />
                                    {isChanged ? (editData.content ? '内容付きで保存' : '変更を保存') : '設定済'}
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>

            <div className="scheduler-footer" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                <RefreshCcw size={12} className={refreshing ? "animate-spin" : ""} style={{ flexShrink: 0 }} />
                <span>
                    サーバーエンジンを完全にリフレッシュして最新の状態を強制取得するには
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        style={{
                            background: 'transparent', border: 'none', padding: 0,
                            color: refreshing ? '#64748b' : '#60a5fa',
                            textDecoration: 'underline',
                            cursor: refreshing ? 'not-allowed' : 'pointer',
                            fontSize: 'inherit',
                            marginLeft: '4px', marginRight: '4px'
                        }}
                    >
                        {refreshing ? '更新中...' : 'Update（サーバー更新）'}
                    </button>
                    をクリックしてください。
                </span>
            </div>
        </div>
    )
}

export default SchedulerPanel
