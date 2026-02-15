'use client';

import { useEffect, useState } from 'react';
import styles from './Confetti.module.css';

interface ConfettiProps {
    active: boolean;
    duration?: number;
}

const COLORS = ['#7C3AED', '#8B5CF6', '#A78BFA', '#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#F97316'];

export default function Confetti({ active, duration = 3000 }: ConfettiProps) {
    const [particles, setParticles] = useState<Array<{ id: number; style: React.CSSProperties }>>([]);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (active) {
            setVisible(true);
            const newParticles = Array.from({ length: 50 }, (_, i) => ({
                id: i,
                style: {
                    '--x': `${Math.random() * 100}vw`,
                    '--y': `${-10 - Math.random() * 20}vh`,
                    '--r': `${Math.random() * 720 - 360}deg`,
                    '--delay': `${Math.random() * 0.5}s`,
                    '--size': `${6 + Math.random() * 8}px`,
                    '--color': COLORS[Math.floor(Math.random() * COLORS.length)],
                    '--duration': `${1.5 + Math.random() * 1.5}s`,
                } as React.CSSProperties,
            }));
            setParticles(newParticles);

            const timer = setTimeout(() => {
                setVisible(false);
                setParticles([]);
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [active, duration]);

    if (!visible) return null;

    return (
        <div className={styles.confettiContainer}>
            {particles.map(p => (
                <div key={p.id} className={styles.particle} style={p.style} />
            ))}
        </div>
    );
}
