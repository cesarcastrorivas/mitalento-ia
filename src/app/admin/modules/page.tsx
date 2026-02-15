'use client';

import { useEffect, useState, useRef } from 'react';
import {
    collection,
    query,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    orderBy,
    Timestamp
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Module } from '@/types';
import styles from './page.module.css';

export default function ModulesPage() {
    const { user } = useAuth();
    const [modules, setModules] = useState<Module[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingModule, setEditingModule] = useState<Module | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        courseId: 'temp-default-course', // TODO: Reemplazar con selector de curso real
        videoUrl: '',
        videoContext: '',
        order: 1,
        isActive: true,
        requiredWatchPercentage: 80,
        passingScore: 70,
    });

    useEffect(() => {
        loadModules();
    }, []);

    const loadModules = async () => {
        try {
            const q = query(collection(db, 'modules'), orderBy('order', 'asc'));
            const snapshot = await getDocs(q);
            const modulesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Module));
            setModules(modulesData);
        } catch (error) {
            console.error('Error loading modules:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleVideoUpload = async (file: File) => {
        if (!file || !file.type.includes('video')) {
            alert('Por favor selecciona un archivo de video válido');
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        const storageRef = ref(storage, `videos/${Date.now()}-${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
            },
            (error) => {
                console.error('Upload error:', error);
                alert('Error al subir el video');
                setIsUploading(false);
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                setFormData(prev => ({ ...prev, videoUrl: downloadURL }));
                setIsUploading(false);
            }
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.videoUrl) {
            alert('Por favor sube un video');
            return;
        }

        try {
            if (editingModule) {
                // Actualizar módulo existente
                await updateDoc(doc(db, 'modules', editingModule.id), {
                    ...formData,
                    updatedAt: Timestamp.now(),
                });
            } else {
                // Crear nuevo módulo
                await addDoc(collection(db, 'modules'), {
                    ...formData,
                    createdAt: Timestamp.now(),
                    createdBy: user?.uid,
                });
            }

            setShowModal(false);
            resetForm();
            loadModules();
        } catch (error: unknown) {
            console.error('Error saving module:', error);
            const firebaseError = error as { code?: string; message?: string };
            alert(`Error al guardar el módulo: ${firebaseError.message || 'Error desconocido'}`);
        }
    };

    const handleEdit = (module: Module) => {
        setEditingModule(module);
        setFormData({
            title: module.title,
            description: module.description,
            courseId: module.courseId || 'temp-default-course',
            videoUrl: module.videoUrl,
            videoContext: module.videoContext || '',
            order: module.order,
            isActive: module.isActive,
            requiredWatchPercentage: module.requiredWatchPercentage,
            passingScore: module.passingScore,
        });
        setShowModal(true);
    };

    const handleDelete = async (moduleId: string) => {
        if (!confirm('¿Estás seguro de eliminar este módulo?')) return;

        try {
            await deleteDoc(doc(db, 'modules', moduleId));
            loadModules();
        } catch (error) {
            console.error('Error deleting module:', error);
            alert('Error al eliminar el módulo');
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            courseId: 'temp-default-course',
            videoUrl: '',
            videoContext: '',
            order: modules.length + 1,
            isActive: true,
            requiredWatchPercentage: 80,
            passingScore: 70,
        });
        setEditingModule(null);
        setUploadProgress(0);
    };

    const openNewModuleModal = () => {
        resetForm();
        setShowModal(true);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center" style={{ minHeight: '50vh' }}>
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1>Módulos de Entrenamiento</h1>
                    <p>Gestiona los videos y contenido de capacitación</p>
                </div>
                <button onClick={openNewModuleModal} className="btn btn-primary">
                    ➕ Nuevo Módulo
                </button>
            </header>

            {modules.length === 0 ? (
                <div className="card empty-state">
                    <div className="empty-state-icon">📚</div>
                    <h3 className="empty-state-title">Sin módulos</h3>
                    <p className="empty-state-description">
                        Comienza creando tu primer módulo de entrenamiento
                    </p>
                    <button onClick={openNewModuleModal} className="btn btn-primary mt-4">
                        Crear módulo
                    </button>
                </div>
            ) : (
                <div className={styles.modulesGrid}>
                    {modules.map((module) => (
                        <div key={module.id} className={styles.moduleCard}>
                            <div className={styles.modulePreview}>
                                <video src={module.videoUrl} className={styles.videoPreview} />
                                <span className={`badge ${module.isActive ? 'badge-success' : 'badge-warning'}`}>
                                    {module.isActive ? 'Activo' : 'Inactivo'}
                                </span>
                            </div>
                            <div className={styles.moduleContent}>
                                <span className={styles.moduleOrder}>Módulo {module.order}</span>
                                <h3>{module.title}</h3>
                                <p>{module.description}</p>
                                <div className={styles.moduleStats}>
                                    <span>🎯 {module.passingScore}% para aprobar</span>
                                    <span>👁️ {module.requiredWatchPercentage}% del video</span>
                                </div>
                            </div>
                            <div className={styles.moduleActions}>
                                <button onClick={() => handleEdit(module)} className="btn btn-secondary">
                                    ✏️ Editar
                                </button>
                                <button onClick={() => handleDelete(module.id)} className="btn btn-danger">
                                    🗑️ Eliminar
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal para crear/editar módulo */}
            {showModal && (
                <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>{editingModule ? 'Editar Módulo' : 'Nuevo Módulo'}</h2>
                            <button onClick={() => setShowModal(false)} className={styles.closeBtn}>
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className={styles.form}>
                            <div className="input-group">
                                <label>Título del Módulo</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.title}
                                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                    placeholder="Ej: Introducción al Producto"
                                    required
                                />
                            </div>

                            <div className="input-group">
                                <label>Descripción</label>
                                <textarea
                                    className="input textarea"
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Describe el contenido de este módulo..."
                                    required
                                />
                            </div>

                            <div className="input-group">
                                <label>Video MP4</label>
                                {formData.videoUrl ? (
                                    <div className={styles.videoPreviewContainer}>
                                        <video src={formData.videoUrl} controls className={styles.uploadedVideo} />
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, videoUrl: '' }))}
                                            className="btn btn-secondary"
                                        >
                                            Cambiar video
                                        </button>
                                    </div>
                                ) : (
                                    <div className={styles.uploadArea}>
                                        {isUploading ? (
                                            <div className={styles.uploadProgress}>
                                                <div className="progress-bar">
                                                    <div
                                                        className="progress-bar-fill"
                                                        style={{ width: `${uploadProgress}%` }}
                                                    />
                                                </div>
                                                <span>{Math.round(uploadProgress)}% subido</span>
                                            </div>
                                        ) : (
                                            <>
                                                <input
                                                    type="file"
                                                    accept="video/mp4,video/*"
                                                    ref={fileInputRef}
                                                    onChange={(e) => e.target.files && handleVideoUpload(e.target.files[0])}
                                                    hidden
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="btn btn-secondary"
                                                >
                                                    📹 Seleccionar Video
                                                </button>
                                                <p>Formatos soportados: MP4, WebM, MOV</p>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="input-group">
                                <label>Contexto del Video (para IA)</label>
                                <textarea
                                    className="input textarea"
                                    value={formData.videoContext}
                                    onChange={(e) => setFormData(prev => ({ ...prev, videoContext: e.target.value }))}
                                    placeholder="Describe los puntos clave del video que deben evaluarse..."
                                    rows={4}
                                />
                                <small style={{ color: 'var(--text-muted)' }}>
                                    Este contexto se usa para generar preguntas personalizadas con IA
                                </small>
                            </div>

                            <div className={styles.formRow}>
                                <div className="input-group">
                                    <label>Orden</label>
                                    <input
                                        type="number"
                                        className="input"
                                        value={formData.order}
                                        onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 1 }))}
                                        min={1}
                                    />
                                </div>

                                <div className="input-group">
                                    <label>% Video Requerido</label>
                                    <input
                                        type="number"
                                        className="input"
                                        value={formData.requiredWatchPercentage}
                                        onChange={(e) => setFormData(prev => ({ ...prev, requiredWatchPercentage: parseInt(e.target.value) || 80 }))}
                                        min={0}
                                        max={100}
                                    />
                                </div>

                                <div className="input-group">
                                    <label>Puntuación Mínima</label>
                                    <input
                                        type="number"
                                        className="input"
                                        value={formData.passingScore}
                                        onChange={(e) => setFormData(prev => ({ ...prev, passingScore: parseInt(e.target.value) || 70 }))}
                                        min={0}
                                        max={100}
                                    />
                                </div>
                            </div>

                            <div className={styles.formRow}>
                                <label className={styles.checkbox}>
                                    <input
                                        type="checkbox"
                                        checked={formData.isActive}
                                        onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                                    />
                                    <span>Módulo activo</span>
                                </label>
                            </div>

                            <div className={styles.formActions}>
                                <button type="button" onClick={() => setShowModal(false)} className="btn btn-secondary">
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={isUploading}>
                                    {editingModule ? 'Guardar Cambios' : 'Crear Módulo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
