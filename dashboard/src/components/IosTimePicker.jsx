import React, { useRef, useEffect } from 'react';

// リストを何周分用意するか。中央(REPEAT/2周目)から前後に十分なバッファを確保する
const REPEAT = 10;

const Wheel = ({ options, value, onChange }) => {
    const containerRef = useRef(null);
    const itemHeight = 40;
    const scrollTimeout = useRef(null);
    const isJumping = useRef(false);
    const count = options.length;
    const midRep = Math.floor(REPEAT / 2);

    // REPEAT周分の拡張リスト
    const extendedOptions = Array.from({ length: REPEAT * count }, (_, i) => options[i % count]);

    // 中央周の指定インデックスへのscrollTop値
    const getMidScrollTop = (localIdx) => (midRep * count + localIdx) * itemHeight;

    // マウント時: 現在値に対応する中央周へスクロール
    useEffect(() => {
        const idx = options.indexOf(value);
        if (idx !== -1 && containerRef.current) {
            containerRef.current.scrollTop = getMidScrollTop(idx);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleScroll = () => {
        if (isJumping.current) return;
        if (scrollTimeout.current) clearTimeout(scrollTimeout.current);

        scrollTimeout.current = setTimeout(() => {
            if (!containerRef.current || isJumping.current) return;

            const scrollTop = containerRef.current.scrollTop;
            const rawIndex = Math.round(scrollTop / itemHeight);
            // 何周目かに関わらず 0〜count-1 に正規化
            const normalizedIndex = ((rawIndex % count) + count) % count;
            const newValue = options[normalizedIndex];

            // 端に寄っていたら中央周の同じ値の位置へサイレント移動
            const targetScrollTop = getMidScrollTop(normalizedIndex);
            if (Math.abs(scrollTop - targetScrollTop) >= 1) {
                isJumping.current = true;
                containerRef.current.scrollTop = targetScrollTop;
                // ブラウザのスナップ補正が終わってからフラグを解除
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    isJumping.current = false;
                }));
            }

            if (newValue !== value) {
                onChange(newValue);
            }
        }, 150);
    };

    return (
        <div
            ref={containerRef}
            onScroll={handleScroll}
            style={{
                height: `${itemHeight * 3}px`,
                overflowY: 'auto',
                scrollSnapType: 'y mandatory',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                position: 'relative',
            }}
            className="wheel-container hide-scrollbar"
        >
            <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
            {/* 上下パディング: 先頭・末尾の項目を中央行に揃えるため */}
            <div style={{ height: `${itemHeight}px`, flexShrink: 0 }} />
            {extendedOptions.map((opt, i) => (
                <div
                    key={i}
                    style={{
                        height: `${itemHeight}px`,
                        scrollSnapAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: opt === value ? '1.25rem' : '1rem',
                        fontWeight: opt === value ? 'bold' : 'normal',
                        color: opt === value ? '#fff' : 'rgba(255,255,255,0.4)',
                        transition: 'all 0.2s',
                    }}
                >
                    {opt}
                </div>
            ))}
            <div style={{ height: `${itemHeight}px`, flexShrink: 0 }} />
        </div>
    );
};

const IosTimePicker = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = React.useState(false);

    const currentHour = value ? value.split(':')[0] : '09';
    const currentMin  = value ? value.split(':')[1] : '00';

    const hours   = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
    const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

    const handleHourChange = (h) => onChange(`${h}:${currentMin}`);
    const handleMinChange  = (m) => onChange(`${currentHour}:${m}`);

    return (
        <div style={{ position: 'relative' }}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(96, 165, 250, 0.2)',
                    borderRadius: '8px',
                    padding: '0.5rem 1rem',
                    color: '#e2e8f0',
                    fontFamily: 'Inter, sans-serif',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    fontWeight: 'bold',
                    letterSpacing: '2px',
                }}
            >
                {currentHour}:{currentMin}
            </div>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '8px',
                    background: '#1e293b',
                    border: '1px solid rgba(96, 165, 250, 0.2)',
                    borderRadius: '16px',
                    padding: '1rem',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '1rem',
                    zIndex: 50,
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                }}>
                    <div style={{ position: 'relative', width: '60px' }}>
                        <Wheel options={hours} value={currentHour} onChange={handleHourChange} />
                        <div style={{
                            position: 'absolute',
                            top: '40px', left: 0, right: 0, height: '40px',
                            borderTop: '1px solid rgba(255,255,255,0.1)',
                            borderBottom: '1px solid rgba(255,255,255,0.1)',
                            pointerEvents: 'none',
                        }} />
                    </div>

                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', paddingBottom: '5px' }}>:</span>

                    <div style={{ position: 'relative', width: '60px' }}>
                        <Wheel options={minutes} value={currentMin} onChange={handleMinChange} />
                        <div style={{
                            position: 'absolute',
                            top: '40px', left: 0, right: 0, height: '40px',
                            borderTop: '1px solid rgba(255,255,255,0.1)',
                            borderBottom: '1px solid rgba(255,255,255,0.1)',
                            pointerEvents: 'none',
                        }} />
                    </div>

                    <button
                        onClick={() => setIsOpen(false)}
                        style={{
                            position: 'absolute',
                            bottom: '-15px',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '20px',
                            padding: '4px 16px',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                        }}
                    >
                        OK
                    </button>
                </div>
            )}
        </div>
    );
};

export default IosTimePicker;
