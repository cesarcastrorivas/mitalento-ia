'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { FileCheck, ArrowRight, Loader2, Shield } from 'lucide-react';
import styles from './page.module.css';

const STANDARDS = [
    { icon: '🎯', text: 'Representar la marca Urbanity con profesionalismo, ética y excelencia en cada interacción con clientes y prospectos.' },
    { icon: '📜', text: 'Cumplir con el código de conducta comercial: no prometer lo que no se puede cumplir, no dar información falsa, respetar la confidencialidad del cliente.' },
    { icon: '📊', text: 'Mantener los KPIs mínimos establecidos: llamadas diarias, citas semanales, y seguimiento puntual de prospectos.' },
    { icon: '🤝', text: 'Colaborar con el equipo, compartir mejores prácticas y apoyar a los compañeros en el logro de metas colectivas.' },
    { icon: '📱', text: 'Usar las herramientas oficiales de Urbanity (CRM Génesis, scripts aprobados, material de marketing autorizado) de forma consistente.' },
    { icon: '🚫', text: 'No participar en prácticas de competencia desleal, captación no autorizada o uso indebido de información de prospectos de otros asesores.' },
    { icon: '📈', text: 'Comprometerse con la formación continua y la mejora de habilidades a través de la plataforma Mi Talento Urbanity.' },
    { icon: '⏰', text: 'Ser puntual en citas, reuniones de equipo y compromisos adquiridos con la empresa y con los clientes.' },
];

interface CommitmentData {
    signedAt: any;
    signedName: string;
}

export default function CompromisoPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [existing, setExisting] = useState<CommitmentData | null>(null);
    const [signedName, setSignedName] = useState('');
    const [accepted, setAccepted] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (user) checkExisting();
    }, [user]);

    const checkExisting = async () => {
        try {
            const q = query(
                collection(db, 'commitments'),
                where('userId', '==', user!.uid)
            );
            const snap = await getDocs(q);
            if (!snap.empty) {
                const data = snap.docs[0].data() as CommitmentData;
                setExisting(data);
            }
        } catch (error) {
            console.error('Error checking commitment:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!user || !accepted || signedName.trim().length < 3) return;
        setSubmitting(true);

        try {
            await addDoc(collection(db, 'commitments'), {
                userId: user.uid,
                userName: user.displayName,
                signedName: signedName.trim(),
                signedAt: Timestamp.now(),
            });

            // Redirect to dashboard after signing
            router.push('/dashboard');
        } catch (error) {
            console.error('Error saving commitment:', error);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className={styles.page}>
                <div className={styles.loading}>
                    <div className={styles.spinner} />
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }}>Verificando compromiso...</span>
                </div>
            </div>
        );
    }

    // Already signed
    if (existing) {
        return (
            <div className={styles.page}>
                <div className={styles.container}>
                    <div className={styles.signedCard}>
                        <div className={styles.signedIcon}>✅</div>
                        <h2 className={styles.signedTitle}>Compromiso Firmado</h2>
                        <p className={styles.signedText}>
                            Has firmado el compromiso de estándares como <strong>{existing.signedName}</strong>.
                        </p>
                        <p className={styles.signedDate}>
                            Firmado el: {existing.signedAt?.toDate?.()?.toLocaleDateString('es-MX', {
                                year: 'numeric', month: 'long', day: 'numeric'
                            }) || 'N/A'}
                        </p>
                        <button
                            onClick={() => router.push('/dashboard')}
                            className={styles.continueBtn}
                        >
                            Volver al Inicio <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const canSubmit = accepted && signedName.trim().length >= 3 && !submitting;

    return (
        <div className={styles.page}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.headerIcon}>
                        <Shield size={32} color="white" />
                    </div>
                    <h1 className={styles.title}>Compromiso de Estándares</h1>
                    <p className={styles.subtitle}>
                        Antes de iniciar tu certificación, debes comprometerte con los estándares de conducta profesional de Urbanity.
                    </p>
                </div>

                <div className={styles.card}>
                    <h2 className={styles.sectionTitle}>
                        <FileCheck size={20} /> Código de Conducta Urbanity
                    </h2>

                    <ul className={styles.standardsList}>
                        {STANDARDS.map((s, i) => (
                            <li key={i} className={styles.standardItem}>
                                <span className={styles.standardIcon}>{s.icon}</span>
                                <span>{s.text}</span>
                            </li>
                        ))}
                    </ul>

                    <div className={styles.divider} />

                    <div className={styles.signSection}>
                        <label className={styles.signLabel}>Tu Firma Digital</label>
                        <input
                            type="text"
                            className={styles.signInput}
                            placeholder="Escribe tu nombre completo"
                            value={signedName}
                            onChange={(e) => setSignedName(e.target.value)}
                            maxLength={100}
                        />
                    </div>

                    <label className={styles.checkboxGroup}>
                        <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={accepted}
                            onChange={(e) => setAccepted(e.target.checked)}
                        />
                        <span className={styles.checkboxLabel}>
                            He leído y acepto cumplir con todos los estándares de conducta profesional de Urbanity Academy.
                            Entiendo que el incumplimiento puede resultar en la revocación de mi certificación.
                        </span>
                    </label>

                    <button
                        onClick={handleSubmit}
                        disabled={!canSubmit}
                        className={styles.submitBtn}
                    >
                        {submitting ? (
                            <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Firmando...</>
                        ) : (
                            <><FileCheck size={18} /> Firmar Compromiso y Continuar</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
