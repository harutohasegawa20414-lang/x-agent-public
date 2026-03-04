import React from 'react'
import { MessageSquare, Sparkles } from 'lucide-react'

const TopicInput = ({ topic, setTopic, onGenerateAll }) => {
    return (
        <div className="topic-section">
            <MessageSquare style={{ color: '#475569', width: '20px', height: '20px', flexShrink: 0 }} />
            <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="投稿のトピックを入力（例：AIによる業務効率化）"
                className="topic-input"
            />
            <button
                onClick={onGenerateAll}
                className="generate-btn"
            >
                <Sparkles style={{ width: '16px', height: '16px' }} />
                <span>全員分を生成</span>
            </button>
        </div>
    )
}

export default TopicInput
