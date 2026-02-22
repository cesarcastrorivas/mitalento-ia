'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Certificate as CertType, CertificationLevel, LearningPath, User } from '@/types';
import { FIXED_PATHS } from '@/lib/constants';
import { Award, Copy, Check, Loader2, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import QRCode from 'qrcode';
import styles from './page.module.css';

const LEVEL_LABELS: Record<string, string> = {
    fundamental: 'Asesor Certificado — Nivel Fundamental',
    professional: 'Asesor Certificado — Nivel Profesional',
    elite: 'Asesor Certificado — Nivel Élite',
};

const LEVEL_COLORS: Record<string, string> = {
    fundamental: '#10b981',
    professional: '#f59e0b',
    elite: '#ef4444',
};

interface PathCertStatus {
    path: LearningPath;
    certificate: CertType | null;
    isCompleted: boolean;
}

export default function CertificatePage() {
    const { user } = useAuth();
    const [pathStatuses, setPathStatuses] = useState<PathCertStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState<string | null>(null); // pathId being generated
    const [expandedCert, setExpandedCert] = useState<string | null>(null);
    const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});
    const [copied, setCopied] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (user) loadData();
    }, [user]);

    const loadData = async () => {
        try {
            if (!user) return;

            // 1. Empezamos con las 3 rutas obligatorias (Fijas)
            // 1. Empezamos con las 3 rutas obligatorias (Fijas)
            let allPaths: LearningPath[] = [...FIXED_PATHS];
            let completedPaths: string[] = [];

            // 2. Cargar perfil de usuario para ver si tiene rutas adicionales asignadas y rutas completadas
            const userDocSnap = await getDoc(doc(db, 'users', user.uid));
            if (userDocSnap.exists()) {
                const userData = userDocSnap.data() as User;
                completedPaths = userData.completedPaths || [];
                const assignedIds = userData.assignedPathIds || [];

                // 3. Si tiene rutas asignadas, las verificamos en Firestore
                if (assignedIds.length > 0) {
                    const pathsQ = query(collection(db, 'learning_paths'), where('__name__', 'in', assignedIds));
                    const pathsSnapshot = await getDocs(pathsQ);

                    const dynamicPaths = pathsSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    } as LearningPath));

                    // Fusionar y ordenar (el orden por defecto es 'order' o 99 si no existe)
                    allPaths = [...allPaths, ...dynamicPaths].sort((a, b) => (a.order || 99) - (b.order || 99));
                }
            }

            // 4. Get user's certificates
            const certsSnap = await getDocs(
                query(
                    collection(db, 'certificates'),
                    where('userId', '==', user.uid),
                    where('isActive', '==', true)
                )
            );
            const certs = certsSnap.docs.map(d => ({ id: d.id, ...d.data() } as CertType));

            // 4. Build status per path
            const statuses: PathCertStatus[] = allPaths.map(path => {
                const cert = certs.find(c => c.pathId === path.id) || null;
                const isCompleted = completedPaths.includes(path.id);
                return { path, certificate: cert, isCompleted };
            });

            setPathStatuses(statuses);

            // 5. Generate QR codes for existing certificates
            const qrs: Record<string, string> = {};
            for (const cert of certs) {
                if (cert.verificationCode) {
                    try {
                        const url = `${window.location.origin}/verify/${cert.verificationCode}`;
                        qrs[cert.id] = await QRCode.toDataURL(url, {
                            width: 140,
                            margin: 2,
                            color: { dark: '#111827', light: '#ffffff' },
                        });
                    } catch { /* skip */ }
                }
            }
            setQrDataUrls(qrs);

            // Auto-expand first certificate
            if (certs.length > 0) {
                setExpandedCert(certs[0].id);
            }
        } catch (error) {
            console.error('Error loading certificate data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateCertificate = async (pathId: string) => {
        if (!user) return;
        setGenerating(pathId);
        setErrorMsg('');
        try {
            const response = await fetch('/api/generate-certificate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.uid, pathId }),
            });
            const data = await response.json();
            if (data.error) {
                setErrorMsg(data.error);
                return;
            }
            await loadData();
        } catch (err: any) {
            console.error('Error generating certificate:', err);
            setErrorMsg('Error al generar el certificado. Intenta de nuevo.');
        } finally {
            setGenerating(null);
        }
    };

    const handleCopyLink = (cert: CertType) => {
        const url = `${window.location.origin}/verify/${cert.verificationCode}`;
        navigator.clipboard.writeText(url);
        setCopied(cert.id);
        setTimeout(() => setCopied(''), 2000);
    };

    if (loading) {
        return (
            <div className={styles.page}>
                <div className={styles.loading}>
                    <div className={styles.spinner} />
                    <span>Cargando certificados...</span>
                </div>
            </div>
        );
    }

    const earnedCount = pathStatuses.filter(s => s.certificate).length;

    return (
        <div className={styles.page}>
            <div style={{ maxWidth: '800px', margin: '0 auto', padding: '1.5rem 1rem' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏛️</div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#111827', marginBottom: '0.25rem' }}>
                        Mis Certificados
                    </h1>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {earnedCount > 0
                            ? `${earnedCount} de ${pathStatuses.length} certificados obtenidos`
                            : 'Completa las rutas para obtener tus certificados'}
                    </p>
                </div>

                {errorMsg && (
                    <div style={{
                        padding: '0.75rem 1rem',
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '0.75rem',
                        fontSize: '0.85rem',
                        color: '#991B1B',
                        marginBottom: '1rem',
                        textAlign: 'center',
                    }}>
                        {errorMsg}
                    </div>
                )}

                {/* Path Certificates */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {pathStatuses.map((status, idx) => {
                        const { path, certificate, isCompleted } = status;
                        const level = path.certificationLevel || 'fundamental';
                        const color = LEVEL_COLORS[level] || '#6b7280';
                        const isExpanded = expandedCert === certificate?.id;

                        return (
                            <div
                                key={path.id}
                                style={{
                                    background: '#fff',
                                    border: `1px solid ${certificate ? color + '40' : '#e5e7eb'}`,
                                    borderRadius: '1rem',
                                    overflow: 'hidden',
                                    boxShadow: certificate ? `0 4px 20px ${color}15` : '0 1px 3px rgba(0,0,0,0.05)',
                                }}
                            >
                                {/* Card Header */}
                                <div
                                    style={{
                                        padding: '1rem 1.25rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        cursor: certificate ? 'pointer' : 'default',
                                        background: certificate ? `${color}08` : 'transparent',
                                    }}
                                    onClick={() => certificate && setExpandedCert(isExpanded ? null : certificate.id)}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                                        <div style={{
                                            width: '2.5rem',
                                            height: '2.5rem',
                                            borderRadius: '0.75rem',
                                            background: certificate ? color : '#f3f4f6',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '1.1rem',
                                            color: certificate ? '#fff' : '#9ca3af',
                                            fontWeight: 700,
                                        }}>
                                            {certificate ? '✓' : idx + 1}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827' }}>
                                                {path.title}
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                                {LEVEL_LABELS[level] || 'Certificado'}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        {certificate ? (
                                            <>
                                                <span style={{
                                                    fontSize: '0.7rem',
                                                    fontWeight: 700,
                                                    color,
                                                    background: `${color}15`,
                                                    padding: '0.25rem 0.5rem',
                                                    borderRadius: '0.5rem',
                                                    textTransform: 'uppercase',
                                                }}>
                                                    {certificate.score}% • Certificado
                                                </span>
                                                {isExpanded ? <ChevronUp size={16} color="#9ca3af" /> : <ChevronDown size={16} color="#9ca3af" />}
                                            </>
                                        ) : isCompleted ? (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleGenerateCertificate(path.id);
                                                }}
                                                disabled={generating === path.id}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.35rem',
                                                    background: color,
                                                    color: '#fff',
                                                    border: 'none',
                                                    padding: '0.4rem 0.75rem',
                                                    borderRadius: '0.5rem',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                {generating === path.id ? (
                                                    <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generando...</>
                                                ) : (
                                                    <><Award size={14} /> Generar</>
                                                )}
                                            </button>
                                        ) : (
                                            <span style={{
                                                fontSize: '0.7rem',
                                                fontWeight: 600,
                                                color: '#9ca3af',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.25rem',
                                            }}>
                                                <Lock size={12} /> Pendiente
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Expanded Certificate Detail */}
                                {certificate && isExpanded && (
                                    <div style={{
                                        padding: '1.5rem',
                                        borderTop: `1px solid ${color}20`,
                                        textAlign: 'center',
                                    }}>
                                        <div style={{ marginBottom: '0.5rem', fontSize: '0.7rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                            Urbanity Academy
                                        </div>
                                        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827', marginBottom: '0.25rem' }}>
                                            Certificado de Competencia
                                        </h2>
                                        <div style={{
                                            display: 'inline-block',
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '1rem',
                                            background: `${color}15`,
                                            color,
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            marginBottom: '1rem',
                                        }}>
                                            {LEVEL_LABELS[certificate.level] || 'Certificado'}
                                        </div>

                                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#374151', marginBottom: '0.75rem' }}>
                                            {certificate.userName}
                                        </div>

                                        <div style={{
                                            display: 'flex',
                                            justifyContent: 'center',
                                            gap: '1.5rem',
                                            marginBottom: '1rem',
                                        }}>
                                            <div>
                                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{certificate.score}%</div>
                                                <div style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 600 }}>PUNTAJE</div>
                                            </div>
                                            {qrDataUrls[certificate.id] && (
                                                <img
                                                    src={qrDataUrls[certificate.id]}
                                                    alt="QR"
                                                    style={{ width: '70px', height: '70px', borderRadius: '0.5rem' }}
                                                />
                                            )}
                                        </div>

                                        <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginBottom: '0.75rem' }}>
                                            Código: {certificate.verificationCode} • Emitido: {certificate.issuedAt?.toDate?.()?.toLocaleDateString('es-MX', {
                                                year: 'numeric', month: 'long', day: 'numeric'
                                            }) || 'N/A'}
                                        </div>

                                        <button
                                            onClick={() => handleCopyLink(certificate)}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.35rem',
                                                padding: '0.4rem 0.75rem',
                                                borderRadius: '0.5rem',
                                                border: '1px solid #e5e7eb',
                                                background: '#fff',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                color: '#374151',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            {copied === certificate.id ? <Check size={14} /> : <Copy size={14} />}
                                            {copied === certificate.id ? 'Copiado' : 'Copiar Link'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {pathStatuses.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#9ca3af' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                        <p>No hay rutas de certificación disponibles.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
