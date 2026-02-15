'use client';

import styles from './LoadingScreen.module.css';

interface LoadingScreenProps {
    message?: string;
}

export default function LoadingScreen({ message = 'Cargando...' }: LoadingScreenProps) {
    return (
        <div className={styles.container}>
            <div className={styles.spinnerWrapper}>
                <div className={styles.spinner}>
                    <div className={styles.ring} />
                    <div className={styles.ring} />
                </div>
            </div>
            <p className={styles.message}>{message}</p>
        </div>
    );
}
