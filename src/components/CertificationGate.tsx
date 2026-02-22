'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { CertificationLevel } from '@/types';
import { Lock, ShieldX, AlertTriangle } from 'lucide-react';
import styles from './CertificationGate.module.css';

interface CertificationGateProps {
    requiredLevel: CertificationLevel;
    children: React.ReactNode;
}

const LEVEL_CONFIG: Record<CertificationLevel, {
    label: string;
    requiredPrevious: CertificationLevel | null;
    minScore: number;
    dayLabel: string;
}> = {
    none: { label: 'Sin Certificación', requiredPrevious: null, minScore: 0, dayLabel: '' },
    fundamental: { label: 'Nivel Fundamental', requiredPrevious: null, minScore: 80, dayLabel: 'Día 1' },
    professional: { label: 'Nivel Profesional', requiredPrevious: 'fundamental', minScore: 85, dayLabel: 'Día 2' },
    elite: { label: 'Nivel Élite', requiredPrevious: 'professional', minScore: 80, dayLabel: 'Día 3' },
};

const LEVEL_ORDER: CertificationLevel[] = ['none', 'fundamental', 'professional', 'elite'];

function getLevelIndex(level: CertificationLevel): number {
    return LEVEL_ORDER.indexOf(level);
}

export default function CertificationGate({ requiredLevel, children }: CertificationGateProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [userLevel, setUserLevel] = useState<CertificationLevel>('none');
    const [hasAccess, setHasAccess] = useState(false);

    useEffect(() => {
        checkAccess();
    }, [user, requiredLevel]);

    const checkAccess = async () => {
        if (!user) {
            setLoading(false);
            return;
        }

        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                const level = (data.certificationLevel as CertificationLevel) || 'none';
                setUserLevel(level);

                // Admin always has access
                if (user.role === 'admin') {
                    setHasAccess(true);
                } else if (requiredLevel === 'none' || requiredLevel === 'fundamental') {
                    // Fundamental (Day 1) is always accessible
                    setHasAccess(true);
                } else {
                    // Check if user has completed the required previous level
                    const config = LEVEL_CONFIG[requiredLevel];
                    if (config.requiredPrevious) {
                        const userLevelIndex = getLevelIndex(level);
                        const requiredPreviousIndex = getLevelIndex(config.requiredPrevious);
                        setHasAccess(userLevelIndex >= requiredPreviousIndex + 1);
                    } else {
                        setHasAccess(true);
                    }
                }
            }
        } catch (error) {
            console.error('Error checking certification access:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className={styles.loadingGate}>
                <div className={styles.spinner} />
                <span className={styles.loadingText}>Verificando certificación...</span>
            </div>
        );
    }

    if (!hasAccess) {
        const config = LEVEL_CONFIG[requiredLevel];
        const prevConfig = config.requiredPrevious ? LEVEL_CONFIG[config.requiredPrevious] : null;

        return (
            <div className={`${styles.gateOverlay} ${styles.locked}`}>
                <div className={styles.lockScreen}>
                    <div className={styles.lockIcon}>
                        <Lock size={32} />
                    </div>
                    <h2 className={styles.lockTitle}>
                        🔒 {config.dayLabel} — Bloqueado
                    </h2>
                    <p className={styles.lockMessage}>
                        Para acceder al <strong>{config.label}</strong>, debes aprobar primero el nivel anterior.
                    </p>
                    {prevConfig && (
                        <div className={styles.lockRequirement}>
                            <AlertTriangle size={18} className={styles.reqIcon} />
                            <span>Requisito: Aprobar {prevConfig.label} ({prevConfig.dayLabel}) con mínimo {prevConfig.minScore}%</span>
                        </div>
                    )}
                </div>
                <div style={{ filter: 'blur(8px)', opacity: 0.3 }}>
                    {children}
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
