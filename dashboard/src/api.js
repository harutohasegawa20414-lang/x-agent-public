export const fetchStyles = async () => {
    const res = await fetch('/api/styles')
    if (!res.ok) throw new Error('スタイルの取得に失敗しました')
    return res.json()
}

export const addCustomStyle = async (name, xUsername = '') => {
    const body = { name }
    if (xUsername && xUsername.trim()) body.x_username = xUsername.trim()
    const res = await fetch('/api/styles/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error('スタイルの追加に失敗しました')
    return res.json()
}

export const deleteCustomStyle = async (styleId) => {
    const res = await fetch(`/api/styles/custom/${styleId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('スタイルの削除に失敗しました')
    return res.json()
}

export const generatePost = async (styleId, topic, contextOverride = null, frameworkId = null) => {
    const body = { style: styleId, topic }
    if (contextOverride !== null) body.context_override = contextOverride
    if (frameworkId !== null) body.framework_id = frameworkId
    const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    })
    if (!res.ok) {
        const error = await res.json()
        throw new Error(error.detail || '生成に失敗しました')
    }
    return res.json()
}

export const fetchFrameworks = async (styleId) => {
    const res = await fetch(`/api/frameworks/${styleId}`)
    if (!res.ok) throw new Error('フレームワークの取得に失敗しました')
    return res.json()
}

export const generateFrameworks = async (styleId) => {
    const res = await fetch(`/api/frameworks/${styleId}/generate`, { method: 'POST' })
    if (!res.ok) {
        const error = await res.json()
        throw new Error(error.detail || 'フレームワーク生成に失敗しました')
    }
    return res.json()
}

export const saveFrameworks = async (styleId, styleName, frameworks) => {
    const res = await fetch(`/api/frameworks/${styleId}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ style_name: styleName, frameworks })
    })
    if (!res.ok) {
        const error = await res.json()
        throw new Error(error.detail || 'フレームワークの保存に失敗しました')
    }
    return res.json()
}

export const deleteFramework = async (styleId, frameworkId) => {
    const res = await fetch(`/api/frameworks/${styleId}/${frameworkId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('フレームワークの削除に失敗しました')
    return res.json()
}

export const extractFrameworksByUsername = async (xUsername) => {
    const res = await fetch('/api/frameworks/extract-by-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x_username: xUsername.replace(/^@/, '') })
    })
    if (!res.ok) {
        const error = await res.json()
        throw new Error(error.detail || 'フレームワーク抽出に失敗しました')
    }
    return res.json()
}

export const postToX = async (content) => {
    const res = await fetch('/api/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
    })
    if (!res.ok) throw new Error('投稿に失敗しました')
    return res.json()
}

export const sendChatMessage = async (message, history) => {
    const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history })
    })
    if (!res.ok) throw new Error('チャットメッセージの送信に失敗しました')
    return res.json()
}

export const fetchChatSession = async () => {
    const res = await fetch('/api/chat/session')
    if (!res.ok) throw new Error('チャットセッションの取得に失敗しました')
    return res.json()
}

export const saveChatSession = async (data) => {
    const res = await fetch('/api/chat/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
    if (!res.ok) throw new Error('チャットセッションの保存に失敗しました')
    return res.json()
}

export const resetChatSession = async () => {
    const res = await fetch('/api/chat/session', { method: 'DELETE' })
    if (!res.ok) throw new Error('チャットセッションのリセットに失敗しました')
    return res.json()
}

export const fetchGeneratedPosts = async () => {
    const res = await fetch('/api/generated')
    if (!res.ok) throw new Error('生成済み投稿の取得に失敗しました')
    return res.json()
}

export const clearGeneratedPost = async (styleId) => {
    const res = await fetch(`/api/generated/${styleId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('生成済み投稿の削除に失敗しました')
    return res.json()
}

export const fetchSourceStatus = async () => {
    const res = await fetch('/api/sources/status')
    if (!res.ok) throw new Error('ソース情報の取得に失敗しました')
    return res.json()
}

export const syncSources = async () => {
    const res = await fetch('/api/sources/sync', { method: 'POST' })
    if (!res.ok) {
        const error = await res.json()
        throw new Error(error.detail || '同期に失敗しました')
    }
    return res.json()
}

export const fetchHistory = async () => {
    const res = await fetch('/api/history')
    if (!res.ok) throw new Error('投稿履歴の取得に失敗しました')
    return res.json()
}

export const deleteHistoryEntry = async (postId) => {
    const res = await fetch(`/api/history/${postId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('削除に失敗しました')
    return res.json()
}

export const fetchSchedulerStatus = async () => {
    const res = await fetch('/api/scheduler/status')
    if (!res.ok) throw new Error('スケジューラー状態の取得に失敗しました')
    return res.json()
}

export const fetchSchedulerConfig = async () => {
    const res = await fetch('/api/scheduler/config')
    if (!res.ok) throw new Error('スケジューラー設定の取得に失敗しました')
    return res.json()
}

export const updateSchedulerConfig = async (config) => {
    const res = await fetch('/api/scheduler/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
    })
    if (!res.ok) throw new Error('設定の更新に失敗しました')
    return res.json()
}

export const runSchedulerJobNow = async (jobId) => {
    const res = await fetch(`/api/scheduler/run-now/${jobId}`, { method: 'POST' })
    if (!res.ok) throw new Error('ジョブ의 実行に失敗しました')
    return res.json()
}

export const refreshScheduler = async () => {
    const res = await fetch('/api/scheduler/refresh', { method: 'POST' })
    if (!res.ok) throw new Error('スケジューラーの更新に失敗しました')
    return res.json()
}

export const fetchAccounts = async () => {
    const res = await fetch('/api/accounts')
    if (!res.ok) throw new Error('アカウント一覧の取得に失敗しました')
    return res.json()
}

export const fetchCurrentAccount = async () => {
    const res = await fetch('/api/accounts/current')
    if (!res.ok) throw new Error('現在のアカウントの取得に失敗しました')
    return res.json()
}

export const switchAccount = async (accountId) => {
    const res = await fetch('/api/accounts/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId })
    })
    if (!res.ok) throw new Error('アカウントへの切り替えに失敗しました')
    return res.json()
}

export const addAccount = async (config) => {
    const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
    })
    if (!res.ok) throw new Error('アカウントの追加に失敗しました')
    return res.json()
}

export const editAccount = async (accountId, config) => {
    const res = await fetch(`/api/accounts/${accountId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
    })
    if (!res.ok) throw new Error('アカウントの更新に失敗しました')
    return res.json()
}

export const deleteAccount = async (accountId) => {
    const res = await fetch(`/api/accounts/${accountId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('アカウントの削除に失敗しました')
    return res.json()
}
