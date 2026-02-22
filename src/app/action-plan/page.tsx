'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Target, Calculator, Sparkles, Loader2, TrendingUp, Phone, Calendar, DollarSign } from 'lucide-react';
import styles from './page.module.css';

// Urbanity sales funnel metrics (configurable)
const FUNNEL = {
    avgTicket: 250000,           // MXN average commission per closing
    closeRate: 0.10,             // 10% closing rate
    appointmentShowRate: 0.50,   // 50% of appointments show
    callToAppointmentRate: 0.20, // 20% call to appointment
};

interface PlanResult {
    plan30: string;
    plan60: string;
    plan90: string;
}

export default function ActionPlanPage() {
    const { user } = useAuth();
    const [targetIncome, setTargetIncome] = useState<number>(50000);
    const [generating, setGenerating] = useState(false);
    const [plan, setPlan] = useState<PlanResult | null>(null);
    const [error, setError] = useState('');

    // Calculated KPIs
    const closingsNeeded = Math.ceil(targetIncome / FUNNEL.avgTicket);
    const appointmentsNeeded = Math.ceil(closingsNeeded / FUNNEL.closeRate);
    const showsNeeded = Math.ceil(appointmentsNeeded / FUNNEL.appointmentShowRate);
    const callsPerMonth = Math.ceil(showsNeeded / FUNNEL.callToAppointmentRate);
    const callsPerDay = Math.ceil(callsPerMonth / 22); // 22 working days
    const appointmentsPerWeek = Math.ceil(appointmentsNeeded / 4);

    const handleGenerate = async () => {
        if (!user) return;
        setGenerating(true);
        setError('');

        try {
            const response = await fetch('/api/generate-action-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.uid,
                    userName: user.displayName,
                    targetIncome,
                    callsPerDay,
                    appointmentsPerWeek,
                    closingsPerMonth: closingsNeeded,
                }),
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            setPlan({
                plan30: data.plan30,
                plan60: data.plan60,
                plan90: data.plan90,
            });
        } catch (err: any) {
            setError(err.message || 'Error generating plan');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className={styles.page}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.headerIcon}>
                        <Target size={32} color="white" />
                    </div>
                    <h1 className={styles.title}>Plan de Acción 30-60-90</h1>
                    <p className={styles.subtitle}>
                        Calcula tus KPIs y genera tu plan personalizado con IA
                    </p>
                </div>

                {/* Calculator */}
                <div className={styles.calculatorCard}>
                    <h2 className={styles.sectionTitle}>
                        <Calculator size={20} /> Calculadora de KPIs
                    </h2>

                    <div className={styles.inputGroup}>
                        <label className={styles.label}>Meta de Ingreso Mensual (MXN)</label>
                        <div className={styles.inputWrapper}>
                            <span className={styles.inputPrefix}>$</span>
                            <input
                                type="number"
                                className={styles.input}
                                value={targetIncome}
                                onChange={(e) => setTargetIncome(Number(e.target.value))}
                                min={10000}
                                max={1000000}
                                step={5000}
                            />
                        </div>
                    </div>

                    <div className={styles.kpiGrid}>
                        <div className={styles.kpiCard}>
                            <div className={styles.kpiValue}>{callsPerDay}</div>
                            <div className={styles.kpiLabel}>Llamadas por Día</div>
                        </div>
                        <div className={styles.kpiCard}>
                            <div className={styles.kpiValue}>{appointmentsPerWeek}</div>
                            <div className={styles.kpiLabel}>Citas por Semana</div>
                        </div>
                        <div className={styles.kpiCard}>
                            <div className={styles.kpiValue}>{closingsNeeded}</div>
                            <div className={styles.kpiLabel}>Cierres por Mes</div>
                        </div>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={generating || targetIncome < 10000}
                        className={styles.generateBtn}
                    >
                        {generating ? (
                            <>
                                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                                Generando plan con IA...
                            </>
                        ) : (
                            <>
                                <Sparkles size={20} />
                                Generar Plan Personalizado con IA
                            </>
                        )}
                    </button>

                    {error && (
                        <div style={{ color: '#ef4444', textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem', fontWeight: 600 }}>
                            {error}
                        </div>
                    )}
                </div>

                {/* Generated Plan */}
                {plan && (
                    <>
                        <div className={styles.planCard}>
                            <div className={styles.planPeriod}>
                                <span className={`${styles.periodBadge} ${styles.p30}`}>30 Días</span>
                                <span className={styles.periodTitle}>Fase de Arranque</span>
                            </div>
                            <div className={styles.planContent}>{plan.plan30}</div>
                        </div>

                        <div className={styles.planCard} style={{ animationDelay: '0.1s' }}>
                            <div className={styles.planPeriod}>
                                <span className={`${styles.periodBadge} ${styles.p60}`}>60 Días</span>
                                <span className={styles.periodTitle}>Fase de Aceleración</span>
                            </div>
                            <div className={styles.planContent}>{plan.plan60}</div>
                        </div>

                        <div className={styles.planCard} style={{ animationDelay: '0.2s' }}>
                            <div className={styles.planPeriod}>
                                <span className={`${styles.periodBadge} ${styles.p90}`}>90 Días</span>
                                <span className={styles.periodTitle}>Fase de Consolidación</span>
                            </div>
                            <div className={styles.planContent}>{plan.plan90}</div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
