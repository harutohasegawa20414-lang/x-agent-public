const API_BASE = '/api'

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'API Error')
  }
  return res.json()
}

export const api = {
  // カテゴリ
  getCategories: () => apiFetch('/categories'),
  createCategory: (data) => apiFetch('/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id, data) => apiFetch(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id) => apiFetch(`/categories/${id}`, { method: 'DELETE' }),
  toggleCategory: (id) => apiFetch(`/categories/${id}/toggle`, { method: 'POST' }),
  duplicateCategory: (id) => apiFetch(`/categories/${id}/duplicate`, { method: 'POST' }),
  graduateCategory: (id) => apiFetch(`/categories/${id}/graduate`, { method: 'POST' }),

  // ターゲット
  searchTargets: (data) => apiFetch('/targets/search', { method: 'POST', body: JSON.stringify(data) }),
  getTargets: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null))
    return apiFetch(`/targets?${q}`)
  },
  getTargetStats: () => apiFetch('/targets/stats'),
  updateTargetStatus: (id, data) => apiFetch(`/targets/${id}/status`, { method: 'PUT', body: JSON.stringify(data) }),
  updateDealResult: (id, deal_result) => apiFetch(`/targets/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: 'converted', deal_result }) }),
  addBlacklist: (data) => apiFetch('/targets/blacklist', { method: 'POST', body: JSON.stringify(data) }),
  markReplied: (id) => apiFetch(`/targets/${id}/mark-replied`, { method: 'POST' }),
  getReplenishStatus: () => apiFetch('/targets/replenish-status'),
  triggerReplenish: (id) => apiFetch(`/categories/${id}/replenish`, { method: 'POST' }),

  // テンプレート
  getTemplates: (category_id) => apiFetch(`/templates${category_id ? `?category_id=${category_id}` : ''}`),
  createTemplate: (data) => apiFetch('/templates', { method: 'POST', body: JSON.stringify(data) }),
  updateTemplate: (id, data) => apiFetch(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTemplate: (id) => apiFetch(`/templates/${id}`, { method: 'DELETE' }),

  // DM
  generateDM: (data) => apiFetch('/dm/generate', { method: 'POST', body: JSON.stringify(data) }),
  sendDM: (data) => apiFetch('/dm/send', { method: 'POST', body: JSON.stringify(data) }),
  getDMHistory: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null))
    return apiFetch(`/dm/history?${q}`)
  },
  getHealthScore: () => apiFetch('/dm/health'),
  getSendConfig: () => apiFetch('/dm/config'),
  updateSendConfig: (data) => apiFetch('/dm/config', { method: 'PUT', body: JSON.stringify(data) }),
  emergencyStop: () => apiFetch('/dm/emergency-stop', { method: 'POST' }),
  resumeSending: () => apiFetch('/dm/resume', { method: 'POST' }),
  getSendIntervalStatus: () => apiFetch('/dm/send-status'),
  getAutoSendStatus: () => apiFetch('/dm/auto-send/status'),
  enableAutoSend: (categories) => apiFetch('/dm/auto-send/enable', {
    method: 'POST',
    body: categories ? JSON.stringify(categories) : undefined,
  }),
  disableAutoSend: () => apiFetch('/dm/auto-send/disable', { method: 'POST' }),

  // 返信
  getReplies: (params = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null))
    return apiFetch(`/replies?${q}`)
  },
  addReply: (data) => apiFetch('/replies', { method: 'POST', body: JSON.stringify(data) }),
  updateReply: (id, data) => apiFetch(`/replies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getReplyStats: () => apiFetch('/replies/stats'),
  pollReplies: () => apiFetch('/replies/poll', { method: 'POST' }),
  getPollStatus: () => apiFetch('/replies/poll-status'),

  // 商談
  registerMeeting: (data) => apiFetch('/meetings/register', { method: 'POST', body: JSON.stringify(data) }),

  // アナリティクス
  getOverview: () => apiFetch('/analytics/overview'),
  getDailyStats: (days) => apiFetch(`/analytics/daily?days=${days || 14}`),
  getCategoryStats: () => apiFetch('/analytics/categories'),
  getTemplateStats: () => apiFetch('/analytics/templates'),
  getTimeDistribution: () => apiFetch('/analytics/time-distribution'),
  getKeywordStats: () => apiFetch('/analytics/keywords'),
}
