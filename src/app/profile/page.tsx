'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import styles from './page.module.css';
import { Camera, Mail, Shield, Calendar, CheckCircle, MessageSquare } from 'lucide-react';
import Image from 'next/image';
import Toast, { ToastType } from '@/components/Toast';

export default function ProfilePage() {
    const { user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    // supervisorFeedback comes from the user profile already loaded in AuthContext — no extra Firestore read needed
    const feedback: string = (user as any)?.supervisorFeedback || '';

    if (!user) return null;

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file
        if (!file.type.startsWith('image/')) {
            setToast({ message: 'Por favor selecciona una imagen válida', type: 'error' });
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setToast({ message: 'La imagen no puede superar 5MB', type: 'error' });
            return;
        }

        setUploading(true);
        try {
            const storageRef = ref(storage, `avatars/${user.uid}/profile.${file.name.split('.').pop()}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);

            // Update Firestore user document
            await updateDoc(doc(db, 'users', user.uid), {
                photoURL: downloadURL,
            });

            setPhotoURL(downloadURL);
            setToast({ message: '¡Foto actualizada correctamente!', type: 'success' });
        } catch (error: any) {
            console.error('Error uploading photo:', error);
            const errorMessage = error?.code ? `Error: ${error.code}` : 'Error al subir la foto.';
            setToast({ message: errorMessage, type: 'error' });
        } finally {
            setUploading(false);
        }
    };

    const getInitial = () => {
        return user.displayName?.charAt(0).toUpperCase() || 'U';
    };

    const memberSince = user.createdAt?.toDate().toLocaleDateString('es-PE', {
        year: 'numeric',
        month: 'long',
    }) || 'N/A';

    return (
        <div className={styles.page}>
            <div className={styles.container}>
                {/* Profile Header */}
                <div className={styles.profileHeader}>
                    <div className={styles.avatarSection}>
                        <div className={styles.avatarContainer} style={{ position: 'relative', overflow: 'hidden' }}>
                            {photoURL ? (
                                <Image src={photoURL} alt="Avatar" fill className="object-cover" sizes="150px" />
                            ) : (
                                <span className={styles.avatarInitial}>{getInitial()}</span>
                            )}
                            <button
                                className={styles.cameraBtn}
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                            >
                                {uploading ? (
                                    <div className={styles.miniSpinner} />
                                ) : (
                                    <Camera size={16} />
                                )}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoUpload}
                                className={styles.fileInput}
                            />
                        </div>

                        <h1 className={styles.userName}>{user.displayName}</h1>
                        <span className={styles.userRole}>Estudiante</span>
                    </div>

                    {toast && (
                        <Toast
                            message={toast.message}
                            type={toast.type}
                            onClose={() => setToast(null)}
                        />
                    )}
                </div>

                {/* Info Cards */}
                <div className={styles.infoSection}>
                    <h2 className={styles.sectionTitle}>Información de la Cuenta</h2>

                    <div className={styles.infoList}>
                        <div className={styles.infoItem}>
                            <div className={styles.infoIcon}>
                                <Mail size={18} />
                            </div>
                            <div className={styles.infoContent}>
                                <span className={styles.infoLabel}>Correo electrónico</span>
                                <span className={styles.infoValue}>{user.email}</span>
                            </div>
                        </div>

                        <div className={styles.infoItem}>
                            <div className={styles.infoIcon}>
                                <Shield size={18} />
                            </div>
                            <div className={styles.infoContent}>
                                <span className={styles.infoLabel}>Estado</span>
                                <span className={styles.infoValue}>
                                    <span className={styles.statusDot} />
                                    Activo
                                </span>
                            </div>
                        </div>

                        <div className={styles.infoItem}>
                            <div className={styles.infoIcon}>
                                <Calendar size={18} />
                            </div>
                            <div className={styles.infoContent}>
                                <span className={styles.infoLabel}>Miembro desde</span>
                                <span className={styles.infoValue}>{memberSince}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Supervisor Feedback */}
                {feedback && (
                    <div className={styles.infoSection}>
                        <h2 className={styles.sectionTitle}>
                            <MessageSquare size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
                            Retroalimentación del Supervisor
                        </h2>
                        <div style={{
                            background: 'rgba(99, 102, 241, 0.05)',
                            border: '1px solid rgba(99, 102, 241, 0.15)',
                            borderRadius: '14px',
                            padding: '1.25rem',
                            color: '#374151',
                            fontSize: '0.9rem',
                            lineHeight: '1.6',
                            whiteSpace: 'pre-wrap',
                        }}>
                            {feedback}
                        </div>
                    </div>
                )}

                {/* Paths Count */}
                {user.assignedPathIds && user.assignedPathIds.length > 0 && (
                    <div className={styles.pathsCard}>
                        <div className={styles.pathsNumber}>{user.assignedPathIds.length}</div>
                        <div className={styles.pathsLabel}>
                            {user.assignedPathIds.length === 1 ? 'Ruta asignada' : 'Rutas asignadas'}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
