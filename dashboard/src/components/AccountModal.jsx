import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'

const AccountModal = ({ isOpen, onClose, onSubmit, initialData }) => {
    const [formData, setFormData] = useState({
        id: '',
        name: '',
        x_api_key: '',
        x_api_secret: '',
        x_access_token: '',
        x_access_token_secret: ''
    })

    const isEditMode = !!initialData;

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData(initialData);
            } else {
                setFormData({ id: '', name: '', x_api_key: '', x_api_secret: '', x_access_token: '', x_access_token_secret: '' });
            }
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value })
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        onSubmit(formData, isEditMode)
    }

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '500px', width: '100%', padding: '1.5rem', borderRadius: '16px', background: 'rgba(30,30,40,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', maxHeight: 'calc(100vh - 3rem)', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#fff' }}>{isEditMode ? 'アカウント情報を編集' : '新しいXアカウントを追加'}</h2>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.875rem' }}>アカウントID (英数字のみ)</label>
                        <input type="text" name="id" value={formData.id} onChange={handleChange} required disabled={isEditMode} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: isEditMode ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: isEditMode ? '#94a3b8' : '#fff', cursor: isEditMode ? 'not-allowed' : 'text' }} />
                        {isEditMode && <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem', display: 'block' }}>IDは変更できません</span>}
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.875rem' }}>表示名</label>
                        <input type="text" name="name" value={formData.name} onChange={handleChange} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                    </div>
                    {isEditMode && (
                        <p style={{ margin: 0, padding: '0.6rem 0.75rem', borderRadius: '8px', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#94a3b8', fontSize: '0.8rem' }}>
                            キー・トークン欄は空欄のままにすると現在の値を維持します。変更する場合のみ入力してください。
                        </p>
                    )}
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.875rem' }}>API Key</label>
                        <input type="password" name="x_api_key" value={formData.x_api_key} onChange={handleChange} required={!isEditMode} placeholder={isEditMode ? '変更しない場合は空欄' : ''} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.875rem' }}>API Secret</label>
                        <input type="password" name="x_api_secret" value={formData.x_api_secret} onChange={handleChange} required={!isEditMode} placeholder={isEditMode ? '変更しない場合は空欄' : ''} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.875rem' }}>Access Token</label>
                        <input type="password" name="x_access_token" value={formData.x_access_token} onChange={handleChange} required={!isEditMode} placeholder={isEditMode ? '変更しない場合は空欄' : ''} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#cbd5e1', fontSize: '0.875rem' }}>Access Token Secret</label>
                        <input type="password" name="x_access_token_secret" value={formData.x_access_token_secret} onChange={handleChange} required={!isEditMode} placeholder={isEditMode ? '変更しない場合は空欄' : ''} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} />
                    </div>
                    <button type="submit" style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '8px', background: 'linear-gradient(to right, #60a5fa, #a855f7)', color: '#fff', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>{isEditMode ? '変更を保存' : '追加する'}</button>

                </form>
            </div>
            <style>{`
                .modal-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    align-items: flex-start;
                    justify-content: center;
                    padding: 1.5rem 1rem;
                    z-index: 1000;
                    backdrop-filter: blur(4px);
                    overflow-y: auto;
                }
            `}</style>
        </div>
    )
}

export default AccountModal
