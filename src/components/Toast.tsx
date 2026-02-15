'use client';

import { useEffect, useState } from 'react';
import styles from './Toast.module.css';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
    message: string;
    type?: ToastType;
    duration?: number;
    onClose: () => void;
}

const icons = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
};

export default function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
    const [exiting, setExiting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setExiting(true);
            setTimeout(onClose, 300);
        }, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const Icon = icons[type];

    return (
        <div className={`${styles.toast} ${styles[type]} ${exiting ? styles.exit : ''}`}>
            <Icon size={18} className={styles.icon} />
            <span className={styles.message}>{message}</span>
            <button className={styles.closeBtn} onClick={() => { setExiting(true); setTimeout(onClose, 300); }}>
                <X size={14} />
            </button>
        </div>
    );
}
