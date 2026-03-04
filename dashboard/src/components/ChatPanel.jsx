import React, { useState, useEffect, useRef } from 'react'
import { sendChatMessage, fetchChatSession, saveChatSession, resetChatSession } from '../api'
import { Bot, Send, Trash2, CheckCircle, X } from 'lucide-react'

export default function ChatPanel({ onContextConfirm, activeContext, onContextClear }) {
    const [messages, setMessages] = useState([])
    const [pendingContext, setPendingContext] = useState(null)
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const isComposing = useRef(false)
    const messagesContainerRef = useRef(null)
    const isInitialMount = useRef(true)

    useEffect(() => {
        fetchChatSession()
            .then(data => {
                if (data.messages?.length) setMessages(data.messages)
            })
            .catch(() => {})
    }, [])

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false
            return
        }
        const el = messagesContainerRef.current
        if (el) el.scrollTop = el.scrollHeight
    }, [messages, pendingContext])

    const persistSession = (msgs, ctx) => {
        saveChatSession({ messages: msgs, active_context: ctx ?? null }).catch(() => {})
    }

    const handleSend = async () => {
        const text = input.trim()
        if (!text || loading) return

        const newMessages = [...messages, { role: 'user', content: text }]
        setMessages(newMessages)
        setInput('')
        setLoading(true)

        try {
            const res = await sendChatMessage(text, messages)
            const aiMsg = { role: 'ai', content: res.ai_message }
            const updated = [...newMessages, aiMsg]
            setMessages(updated)
            if (res.extracted_context) {
                setPendingContext(res.extracted_context)
            }
            persistSession(updated, activeContext)
        } catch (err) {
            const errMsg = { role: 'ai', content: `エラーが発生しました: ${err.message}` }
            const updated = [...newMessages, errMsg]
            setMessages(updated)
            persistSession(updated, activeContext)
        } finally {
            setLoading(false)
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !isComposing.current) {
            e.preventDefault()
            handleSend()
        }
    }

    const handleConfirmContext = () => {
        onContextConfirm(pendingContext)
        persistSession(messages, pendingContext)
        setPendingContext(null)
    }

    const handleDiscardPending = () => {
        setPendingContext(null)
    }

    const handleClearActive = () => {
        onContextClear()
        persistSession(messages, null)
    }

    const handleReset = async () => {
        setMessages([])
        setPendingContext(null)
        onContextClear()
        await resetChatSession().catch(() => {})
    }

    return (
        <div className="chat-panel">
            <div className="chat-panel-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Bot size={16} style={{ color: '#60a5fa' }} />
                    <span className="chat-panel-title">AIチャット</span>
                </div>
                <button className="chat-reset-btn" onClick={handleReset} title="会話をリセット">
                    <Trash2 size={13} />
                </button>
            </div>

            <div className="chat-messages" ref={messagesContainerRef}>
                {messages.length === 0 && (
                    <div className="chat-empty">
                        <Bot size={28} style={{ color: '#334155', marginBottom: '0.4rem' }} />
                        <p>一次情報についてAIに質問できます</p>
                        <p style={{ fontSize: '0.78rem' }}>例:「強みについて教えて」</p>
                    </div>
                )}
                {messages.map((msg, i) => (
                    <div key={i} className={`bubble ${msg.role === 'user' ? 'bubble-user' : 'bubble-ai'}`}>
                        {msg.content}
                    </div>
                ))}
                {loading && (
                    <div className="bubble bubble-ai bubble-loading">
                        <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                    </div>
                )}
            </div>

            {/* 提案コンテキスト（未確定） */}
            {pendingContext && (
                <div className="context-preview pending">
                    <div className="context-preview-label">抽出されたコンテキスト（未確定）</div>
                    <pre className="context-preview-text">{pendingContext}</pre>
                    <div className="context-preview-actions">
                        <button className="btn-confirm-context" onClick={handleConfirmContext}>
                            <CheckCircle size={13} />
                            この内容で生成に使う
                        </button>
                        <button className="btn-discard-context" onClick={handleDiscardPending}>
                            <X size={13} />
                            破棄
                        </button>
                    </div>
                </div>
            )}

            {/* 確定済みコンテキスト */}
            {activeContext && !pendingContext && (
                <div className="context-preview active">
                    <div className="context-preview-label">
                        <CheckCircle size={12} style={{ color: '#22c55e' }} />
                        生成に使うコンテキスト（確定済み）
                    </div>
                    <pre className="context-preview-text">{activeContext}</pre>
                    <button className="btn-discard-context" onClick={handleClearActive}>
                        <X size={13} />
                        クリア
                    </button>
                </div>
            )}

            <div className="chat-input-row">
                <textarea
                    className="chat-input"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onCompositionStart={() => { isComposing.current = true }}
                    onCompositionEnd={() => { isComposing.current = false }}
                    onKeyDown={handleKeyDown}
                    placeholder="メッセージを入力… (Enter で送信)"
                    rows={2}
                    disabled={loading}
                />
                <button
                    className="chat-send-btn"
                    onClick={handleSend}
                    disabled={!input.trim() || loading}
                >
                    <Send size={15} />
                </button>
            </div>
        </div>
    )
}
