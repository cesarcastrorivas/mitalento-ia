'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Certificate as CertType } from '@/types';
import { ShieldCheck, ShieldX } from 'lucide-react';

const LEVEL_LABELS: Record<string, string> = {
    fundamental: 'Nivel Fundamental',
    professional: 'Nivel Profesional',
    elite: 'Nivel Élite',
};

export default function VerifyPage() {
    const params = useParams();
    const code = params.code as string;
    const [cert, setCert] = useState<CertType | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (code) verifyCertificate();
    }, [code]);

    const verifyCertificate = async () => {
        try {
            const q = query(
                collection(db, 'certificates'),
                where('verificationCode', '==', code)
            );
            const snap = await getDocs(q);
            if (snap.empty) {
                setNotFound(true);
            } else {
                setCert({ id: snap.docs[0].id, ...snap.docs[0].data() } as CertType);
            }
        } catch (error) {
            console.error('Error verifying:', error);
            setNotFound(true);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#f8f9fb', fontFamily: 'system-ui, sans-serif'
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: '50%',
                        border: '3px solid rgba(99,102,241,0.1)', borderTopColor: '#6366f1',
                        animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem'
                    }} />
                    <p style={{ color: '#6b7280' }}>Verificando certificado...</p>
                </div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    if (notFound || !cert) {
        return (
            <div style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#fef2f2', fontFamily: 'system-ui, sans-serif'
            }}>
                <div style={{
                    background: 'white', borderRadius: 24, padding: '3rem', textAlign: 'center',
                    maxWidth: 400, boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
                }}>
                    <ShieldX size={48} color="#ef4444" style={{ marginBottom: '1rem' }} />
                    <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827', marginBottom: '0.5rem' }}>
                        Certificado No Encontrado
                    </h1>
                    <p style={{ color: '#6b7280', fontSize: '0.85rem', lineHeight: 1.6 }}>
                        El código de verificación no corresponde a ningún certificado válido de Urbanity Academy.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)', fontFamily: 'system-ui, sans-serif',
            padding: '2rem'
        }}>
            <div style={{
                background: 'white', borderRadius: 24, padding: '3rem', textAlign: 'center',
                maxWidth: 480, width: '100%', boxShadow: '0 8px 30px rgba(0,0,0,0.08)'
            }}>
                <ShieldCheck size={48} color="#10b981" style={{ marginBottom: '1rem' }} />

                <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827', marginBottom: '0.25rem' }}>
                    ✅ Certificado Válido
                </h1>

                <div style={{
                    display: 'inline-block', padding: '0.3rem 1rem', borderRadius: 12,
                    background: cert.isActive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    color: cert.isActive ? '#059669' : '#ef4444',
                    fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' as const,
                    letterSpacing: '0.1em', marginBottom: '1.5rem'
                }}>
                    {cert.isActive ? 'ACTIVO' : 'INACTIVO'}
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#111827', marginBottom: '0.25rem' }}>
                        {cert.userName}
                    </div>
                    <div style={{
                        fontSize: '0.8rem', color: '#6b7280', fontWeight: 600
                    }}>
                        {LEVEL_LABELS[cert.level] || 'Asesor Certificado'}
                    </div>
                </div>

                <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem',
                    padding: '1rem', background: '#f9fafb', borderRadius: 16, marginBottom: '1rem'
                }}>
                    <div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827' }}>{cert.score}%</div>
                        <div style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' as const }}>Puntaje</div>
                    </div>
                    <div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#111827' }}>
                            {cert.issuedAt?.toDate?.()?.toLocaleDateString('es-MX') || 'N/A'}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' as const }}>Fecha</div>
                    </div>
                </div>

                <p style={{ fontSize: '0.7rem', color: '#d1d5db' }}>
                    Código: {cert.verificationCode}
                </p>

                <div style={{ marginTop: '1.5rem', fontSize: '0.7rem', color: '#9ca3af' }}>
                    🏛️ Urbanity Academy — Certificación Comercial Verificada
                </div>
            </div>
        </div>
    );
}
