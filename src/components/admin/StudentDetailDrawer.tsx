'use client';

import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CertificationLevel } from '@/types';
import { CheckCircle2, ChevronRight, Circle, Loader2, X, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import styles from '@/app/admin/certifications/page.module.css';

// Type definitions needed for the drawer
interface EvalResponse {
    question: string;
    answer: string;
}

export interface StudentRow {
    uid: string;
    displayName: string;
    email: string;
    photoURL?: string;
    certificationLevel: CertificationLevel;
    attitudinalStatus: string;
    avgScore: number;
    evaluationId?: string;
    commitment: boolean;
    supervisorFeedback?: string;
    responses: EvalResponse[];
    stageChecklist?: Record<string, boolean>;
}

interface StudentDetailDrawerProps {
    student: StudentRow;
    onClose: () => void;
    onUpdate: (updatedStudent: StudentRow) => void;
    stageRequirements: Record<string, string[]>;
    stageById: Record<string, any>;
    scoreLabels: Record<string, string>;
    minScoreToPromote: number;
    semaphoreThemes: Record<string, any>;
    promoteButtonLabels: Record<string, string>;
    canPromote: (student: StudentRow) => boolean;
    getBlockedReasons: (student: StudentRow) => string[];
    handlePromote: (student: StudentRow) => Promise<void>;
    handleReject: (student: StudentRow) => Promise<void>;
    generateDisplayId: (uid: string) => string;
}

export default function StudentDetailDrawer({
    student,
    onClose,
    onUpdate,
    stageRequirements,
    stageById,
    scoreLabels,
    minScoreToPromote,
    semaphoreThemes,
    promoteButtonLabels,
    canPromote,
    getBlockedReasons,
    handlePromote,
    handleReject,
    generateDisplayId
}: StudentDetailDrawerProps) {
    const [supervisorNote, setSupervisorNote] = useState(student.supervisorFeedback || '');
    const [savingNote, setSavingNote] = useState(false);

    // Sync note when student changes
    useEffect(() => {
        setSupervisorNote(student.supervisorFeedback || '');
    }, [student.uid, student.supervisorFeedback]);

    const toggleChecklist = async (requirement: string, isChecked: boolean) => {
        const newChecklist = { ...student.stageChecklist, [requirement]: isChecked };
        const updatedStudent = { ...student, stageChecklist: newChecklist };

        // Actualizar UI primero (optimistic)
        onUpdate(updatedStudent);

        try {
            await updateDoc(doc(db, 'users', student.uid), {
                stageChecklist: newChecklist
            });
        } catch (error) {
            console.error('Error updating checklist:', error);
            // Rollback
            onUpdate(student);
        }
    };

    const saveSupervisorNote = async () => {
        setSavingNote(true);
        try {
            const trimmed = supervisorNote.trim();
            await updateDoc(doc(db, 'users', student.uid), {
                supervisorFeedback: trimmed,
            });
            onUpdate({ ...student, supervisorFeedback: trimmed });
        } catch (error) {
            console.error('Error saving note:', error);
        } finally {
            setSavingNote(false);
        }
    };

    return (
        <>
            <div className={styles.drawerOverlay} onClick={onClose} />
            <div className={styles.drawer}>
                <div className={styles.drawerNavbar}>
                    <button onClick={onClose} className={styles.drawerBackBtn}>
                        <ChevronRight size={20} /> Detalle del Candidato
                    </button>
                    <button onClick={onClose} className={styles.drawerCloseIcon}>
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.drawerBody}>
                    {/* Profile Header Centered */}
                    <div className={styles.drawerProfileCenter}>
                        <div className={styles.hugeAvatarWrapper} style={{ borderColor: semaphoreThemes[student.attitudinalStatus]?.dot || '#cbd5e1', position: 'relative', overflow: 'hidden' }}>
                            {student.photoURL ? (
                                <Image src={student.photoURL} alt={student.displayName} fill className="object-cover" sizes="120px" />
                            ) : (
                                <div className={styles.hugeAvatarFallback}>{student.displayName?.charAt(0).toUpperCase()}</div>
                            )}
                        </div>
                        <h2 className={styles.profileName}>{student.displayName}</h2>
                        <p className={styles.profileEmail}>{student.email}</p>

                        <div className={styles.profileBadgesGroup}>
                            <span className={styles.profileLevelBadge} style={{ backgroundColor: stageById[student.certificationLevel]?.lightColor, color: stageById[student.certificationLevel]?.color }}>
                                <CheckCircle2 size={12} /> {stageById[student.certificationLevel]?.label || 'Sin Nivel'}
                            </span>
                            <span className={styles.profileIdBadge}>ID: {generateDisplayId(student.uid)}</span>
                        </div>
                    </div>

                    <hr className={styles.divider} />

                    {/* Checklist dinámico por etapa */}
                    <div className={styles.drawerSection}>
                        <h3 className={styles.sectionHeading}>
                            Requisitos — {stageById[student.certificationLevel]?.label || 'Etapa'}
                        </h3>

                        {/* Score label de la etapa */}
                        {scoreLabels[student.certificationLevel] && (
                            <div className={styles.scoreIndicator}>
                                <div className={styles.scoreLabel}>{scoreLabels[student.certificationLevel]}</div>
                                <div className={styles.scoreValue} style={{ color: student.avgScore >= minScoreToPromote ? '#059669' : '#dc2626' }}>
                                    {student.avgScore}%
                                    <span className={styles.scoreMin}>/ {minScoreToPromote}% mín.</span>
                                </div>
                            </div>
                        )}

                        <div className={styles.checklistGrid}>
                            {stageRequirements[student.certificationLevel || 'none']?.map((req, i) => {
                                const isChecked = !!student.stageChecklist?.[req];
                                return (
                                    <div key={i} className={styles.checkRow} onClick={() => toggleChecklist(req, !isChecked)}>
                                        <div className={styles.checkIconBox}>
                                            {isChecked ? <CheckCircle2 size={24} color="#10b981" /> : <Circle size={24} color="#cbd5e1" />}
                                        </div>
                                        <span className={`${styles.checkText} ${isChecked ? styles.checkTextDone : ''}`}>{req}</span>
                                        <span className={`${styles.checkStatus} ${isChecked ? styles.statusCursado : styles.statusProceso}`}>
                                            {isChecked ? 'COMPLETADO' : 'EN PROCESO'}
                                        </span>
                                    </div>
                                );
                            })}
                            {(stageRequirements[student.certificationLevel || 'none']?.length === 0) && (
                                <p className={styles.emptyNotice}>No hay requisitos configurados para esta etapa.</p>
                            )}
                        </div>
                    </div>

                    {/* Supervisor Note */}
                    <div className={styles.drawerSection}>
                        <div className={styles.headingWithAction}>
                            <h3 className={styles.sectionHeading}>Nota del Supervisor</h3>
                            <button onClick={saveSupervisorNote} disabled={savingNote} className={styles.ghostSaveBtn}>
                                {savingNote ? <Loader2 size={14} className={styles.spin} /> : 'Guardar cambios'}
                            </button>
                        </div>
                        <div className={styles.textareaWrapper}>
                            <textarea
                                className={styles.premiumTextarea}
                                value={supervisorNote}
                                onChange={e => setSupervisorNote(e.target.value)}
                                placeholder="Candidato con alto potencial técnico y excelente comunicación. Se recomienda su paso directo a la etapa profesional..."
                                rows={3}
                            />
                        </div>
                    </div>
                </div>

                {/* Sticky Footer Actions */}
                <div className={styles.drawerActionFooter}>
                    <div className={styles.footerActionsRow}>
                        <button
                            onClick={() => handleReject(student)}
                            className={styles.actionBtnReject}
                            disabled={student.attitudinalStatus === 'red'}
                        >
                            {student.attitudinalStatus === 'red' ? 'Rechazado' : 'Rechazar'}
                        </button>

                        {(() => {
                            const current = stageById[student.certificationLevel];
                            const hasNext = !!current?.next;
                            const promotable = canPromote(student);
                            const label = promoteButtonLabels[student.certificationLevel] || 'Aprobar';

                            return hasNext ? (
                                <button
                                    onClick={() => handlePromote(student)}
                                    className={styles.actionBtnApprove}
                                    disabled={!promotable}
                                >
                                    {label}
                                </button>
                            ) : (
                                <button className={styles.actionBtnApprove} disabled style={{ opacity: 0.5 }}>
                                    Certificación Completa
                                </button>
                            );
                        })()}
                    </div>

                    {/* Mensaje de requisitos faltantes */}
                    {(() => {
                        const hasNext = !!stageById[student.certificationLevel]?.next;
                        if (!hasNext) return null;
                        const reasons = getBlockedReasons(student);
                        if (reasons.length === 0) return null;
                        return (
                            <div className={styles.promotionBlockedMsg}>
                                <AlertTriangle size={14} />
                                <span>{reasons.join(' · ')}</span>
                            </div>
                        );
                    })()}
                </div>
            </div>
        </>
    );
}
