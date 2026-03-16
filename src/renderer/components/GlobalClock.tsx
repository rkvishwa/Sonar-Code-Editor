import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import './GlobalClock.css';

interface GlobalClockProps {
    mode?: 'absolute' | 'inline';
    className?: string;
    style?: React.CSSProperties;
}

export default function GlobalClock({ mode = 'absolute', className = '', style }: GlobalClockProps) {
    const [time, setTime] = useState<string>('');

    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }));
        };

        updateTime();
        const interval = setInterval(updateTime, 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);

    return (
        <div className={`global-clock-base global-clock-${mode} ${className}`} style={style}>
            <Clock size={12} className="global-clock-icon" />
            <span className="global-clock-time">{time}</span>
        </div>
    );
}
