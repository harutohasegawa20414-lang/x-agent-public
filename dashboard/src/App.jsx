import React, { useState } from 'react'
import XAgentApp from './XAgentApp'
import No9App from './No9App'

export default function App() {
  const [activeSystem, setActiveSystem] = useState('xagent')

  return (
    <div style={{ minHeight: '100vh', background: '#070b14' }}>
      {/* ── システム切り替えタブバー ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '8px 16px',
        background: 'rgba(7, 11, 20, 0.95)',
        borderBottom: '1px solid rgba(96,165,250,0.12)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{
          display: 'flex',
          gap: 4,
          background: 'rgba(15, 23, 50, 0.7)',
          border: '1px solid rgba(96,165,250,0.12)',
          borderRadius: 10,
          padding: '3px',
        }}>
          <button
            onClick={() => setActiveSystem('xagent')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 18px',
              borderRadius: 7,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              fontSize: 13,
              fontWeight: 600,
              transition: 'all 0.2s ease',
              background: activeSystem === 'xagent'
                ? 'linear-gradient(135deg, #1e3a8a, #312e81)'
                : 'transparent',
              color: activeSystem === 'xagent' ? '#93c5fd' : '#64748b',
              boxShadow: activeSystem === 'xagent' ? '0 2px 12px rgba(96,165,250,0.2)' : 'none',
            }}
          >
            <span style={{
              width: 20,
              height: 20,
              borderRadius: 6,
              background: activeSystem === 'xagent'
                ? 'linear-gradient(135deg, #1d4ed8, #4c1d95)'
                : 'rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 800,
              color: activeSystem === 'xagent' ? '#93c5fd' : '#64748b',
            }}>X</span>
            X Agent
          </button>

          <button
            onClick={() => setActiveSystem('no9')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 18px',
              borderRadius: 7,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              fontSize: 13,
              fontWeight: 600,
              transition: 'all 0.2s ease',
              background: activeSystem === 'no9'
                ? 'linear-gradient(135deg, #1e3a8a, #312e81)'
                : 'transparent',
              color: activeSystem === 'no9' ? '#93c5fd' : '#64748b',
              boxShadow: activeSystem === 'no9' ? '0 2px 12px rgba(96,165,250,0.2)' : 'none',
            }}
          >
            <span style={{
              width: 20,
              height: 20,
              borderRadius: 6,
              background: activeSystem === 'no9'
                ? 'linear-gradient(135deg, #4f8ef7, #6366f1)'
                : 'rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 800,
              color: 'white',
            }}>9</span>
            No.9 営業
          </button>
        </div>
      </div>

      {/* ── コンテンツ ── */}
      {activeSystem === 'xagent' ? (
        <div style={{ height: 'calc(100vh - 53px)' }}>
          <XAgentApp />
        </div>
      ) : (
        <div style={{ height: 'calc(100vh - 53px)' }}>
          <No9App />
        </div>
      )}
    </div>
  )
}
