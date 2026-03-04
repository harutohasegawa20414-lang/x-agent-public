import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const IosDatePicker = ({ value, onChange }) => {
    // value is Date object or ISO string
    const currentDate = value ? new Date(value) : new Date();
    const [viewDate, setViewDate] = useState(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));

    const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const days = [];
    const totalDays = daysInMonth(year, month);
    const offset = firstDayOfMonth(year, month);

    // Padding for start of month
    for (let i = 0; i < offset; i++) {
        days.push(null);
    }

    // Days of month
    for (let i = 1; i <= totalDays; i++) {
        days.push(new Date(year, month, i));
    }

    const isSelected = (date) => {
        if (!date) return false;
        return date.getDate() === currentDate.getDate() &&
            date.getMonth() === currentDate.getMonth() &&
            date.getFullYear() === currentDate.getFullYear();
    };

    const isToday = (date) => {
        if (!date) return false;
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    };

    const handlePrevMonth = () => {
        setViewDate(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
        setViewDate(new Date(year, month + 1, 1));
    };

    const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

    return (
        <div className="ios-date-picker" style={{
            background: 'rgba(15, 23, 42, 0.95)',
            borderRadius: '20px',
            padding: '1.5rem',
            color: '#f8fafc',
            fontFamily: 'Inter, sans-serif',
            userSelect: 'none',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)',
            border: '1px solid rgba(96, 165, 250, 0.15)'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.5rem'
            }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>
                    {year}年 {month + 1}月
                </h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={handlePrevMonth} style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: 'none',
                        color: '#94a3b8',
                        padding: '0.5rem',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                    }}>
                        <ChevronLeft size={18} />
                    </button>
                    <button onClick={handleNextMonth} style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: 'none',
                        color: '#94a3b8',
                        padding: '0.5rem',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                    }}>
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>

            {/* Weekdays */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '0.5rem',
                marginBottom: '0.5rem',
                textAlign: 'center'
            }}>
                {weekDays.map(day => (
                    <div key={day} style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600' }}>
                        {day}
                    </div>
                ))}
            </div>

            {/* Days Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '0.5rem',
                textAlign: 'center'
            }}>
                {days.map((date, i) => (
                    <div
                        key={i}
                        onClick={() => date && onChange(date)}
                        style={{
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: date ? 'pointer' : 'default',
                            borderRadius: '50%',
                            fontSize: '0.9rem',
                            fontWeight: isSelected(date) || isToday(date) ? '600' : '400',
                            position: 'relative',
                            transition: 'all 0.2s',
                            background: isSelected(date) ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'transparent',
                            color: isSelected(date) ? 'white' : (isToday(date) ? '#60a5fa' : '#e2e8f0'),
                            opacity: date ? 1 : 0
                        }}
                    >
                        {date ? date.getDate() : ''}
                        {isToday(date) && !isSelected(date) && (
                            <div style={{
                                position: 'absolute',
                                bottom: '4px',
                                width: '4px',
                                height: '4px',
                                borderRadius: '50%',
                                background: '#60a5fa'
                            }} />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default IosDatePicker;
