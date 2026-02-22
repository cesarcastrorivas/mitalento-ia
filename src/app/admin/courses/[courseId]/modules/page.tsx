'use client';

import { useEffect, useState, useRef, use } from 'react';
import {
    collection,
    query,
    where,
    getDocs,
    getDoc,
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
import { Module, Course } from '@/types';
import { FileText, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Plus,
    Pencil,
    Trash2,
    Play,
    Video,
    Lightbulb,
    FileVideo,
    UploadCloud,
    CheckCircle2
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { Switch } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';

export default function CourseModulesPage({ params }: { params: Promise<{ courseId: string }> }) {
    const { courseId } = use(params);
    const { user } = useAuth();
    const router = useRouter();

    const [course, setCourse] = useState<Course | null>(null);
    const [modules, setModules] = useState<Module[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingModule, setEditingModule] = useState<Module | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        videoUrl: '',
        videoContext: '',
        order: 1,
        isActive: true,
        requiredWatchPercentage: 80,
        passingScore: 70,
        transcription: '',
    });

    useEffect(() => {
        if (courseId) {
            loadData();
        }
    }, [courseId]);

    const loadData = async () => {
        try {
            // Cargar curso
            const courseDoc = await getDoc(doc(db, 'courses', courseId));
            if (courseDoc.exists()) {
                setCourse({ id: courseDoc.id, ...courseDoc.data() } as Course);
            } else {
                alert('Curso no encontrado');
                router.push('/admin/courses');
                return;
            }

            // Cargar módulos del curso
            const q = query(
                collection(db, 'modules'),
                where('courseId', '==', courseId),
                orderBy('order', 'asc')
            );
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

    const handleTranscribe = async () => {
        if (!formData.videoUrl) {
            alert('Primero debes subir un video para generar la transcripción.');
            return;
        }

        setIsTranscribing(true);
        try {
            const response = await fetch('/api/transcribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    videoUrl: formData.videoUrl,
                    videoTitle: formData.title || 'Video del Módulo',
                }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error);
            }

            setFormData(prev => ({ ...prev, transcription: data.text }));
        } catch (error) {
            console.error('Error generating transcription:', error);
            alert('Error al generar la transcripción. Por favor intenta de nuevo.');
        } finally {
            setIsTranscribing(false);
        }
    };

    const handleSubmit = async () => {
        if (!formData.title || !formData.videoUrl) {
            alert('Por favor completa el título y sube un video');
            return;
        }
        if (!formData.transcription.trim()) {
            alert('La transcripción es obligatoria. Genera la transcripción con IA y revísala antes de guardar.');
            return;
        }
        setIsSubmitting(true);

        try {
            if (editingModule) {
                // Actualizar módulo existente
                await updateDoc(doc(db, 'modules', editingModule.id), {
                    ...formData,
                    updatedAt: Timestamp.now(),
                    // courseId no cambia
                });
            } else {
                // Crear nuevo módulo
                await addDoc(collection(db, 'modules'), {
                    ...formData,
                    courseId, // Asignar al curso actual
                    createdAt: Timestamp.now(),
                    createdBy: user?.uid,
                });
            }

            setShowModal(false);
            resetForm();
            loadData();
        } catch (error: unknown) {
            console.error('Error saving module:', error);
            const firebaseError = error as { code?: string; message?: string };
            alert(`Error al guardar el módulo: ${firebaseError.message || 'Error desconocido'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (module: Module) => {
        setEditingModule(module);
        setFormData({
            title: module.title,
            description: module.description,
            videoUrl: module.videoUrl,
            videoContext: module.videoContext || '',
            order: module.order,
            isActive: module.isActive,
            requiredWatchPercentage: module.requiredWatchPercentage,
            passingScore: module.passingScore,
            transcription: module.transcription || '',
        });
        setShowModal(true);
    };

    const handleDelete = async (moduleId: string) => {
        if (!confirm('¿Estás seguro de eliminar este módulo?')) return;

        try {
            await deleteDoc(doc(db, 'modules', moduleId));
            loadData();
        } catch (error) {
            console.error('Error deleting module:', error);
            alert('Error al eliminar el módulo');
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            videoUrl: '',
            videoContext: '',
            order: modules.length + 1,
            isActive: true,
            requiredWatchPercentage: 80,
            passingScore: 70,
            transcription: '',
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
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!course) return null;

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Breadcrumb & Header */}
            <div>
                <Link
                    href={`/admin/paths/${course.pathId}`}
                    className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-purple-600 transition-colors mb-4 group"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    <span>Volver al Curso</span>
                </Link>

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-2">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{course.title}</h1>
                        <p className="text-slate-500 text-lg">Gestión de Módulos y Videos</p>
                    </div>
                    <Button onClick={openNewModuleModal} leftIcon={<Plus size={20} />} className="shadow-lg shadow-purple-500/25">
                        Nuevo Módulo
                    </Button>
                </div>
            </div>

            {modules.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-16 bg-white rounded-3xl border border-slate-200 shadow-sm text-center">
                    <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mb-6 text-purple-200">
                        <Video size={40} className="text-purple-500" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Sin módulos aún</h3>
                    <p className="text-slate-500 max-w-md mx-auto mb-8">
                        Este curso no tiene contenido. Comienza creando el primer módulo de video.
                    </p>
                    <Button onClick={openNewModuleModal} leftIcon={<Plus size={20} />}>
                        Crear primer módulo
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {modules.map((module) => (
                        <div key={module.id} className="group bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col md:flex-row gap-6">
                            {/* Video Preview */}
                            <div className="w-full md:w-64 aspect-video bg-slate-900 rounded-xl overflow-hidden relative shrink-0">
                                <video
                                    src={module.videoUrl}
                                    className="w-full h-full object-cover opacity-80"
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white">
                                        <Play size={20} fill="currentColor" />
                                    </div>
                                </div>
                                <div className="absolute top-2 left-2">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${module.isActive ? 'bg-emerald-500/90 text-white' : 'bg-slate-500/90 text-white'}`}>
                                        {module.isActive ? 'Activo' : 'Inactivo'}
                                    </span>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0 py-1">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <span className="text-xs font-semibold tracking-wider text-purple-600 uppercase mb-1 block">
                                            Módulo {module.order}
                                        </span>
                                        <h3 className="text-lg font-bold text-slate-900 mb-2">{module.title}</h3>
                                        <p className="text-slate-600 text-sm line-clamp-2 mb-4">
                                            {module.description}
                                        </p>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleEdit(module)}
                                            className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                        >
                                            <Pencil size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(module.id)}
                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 mt-auto pt-2">
                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                        <div className="flex flex-col">
                                            <span className="text-xs text-slate-400">Puntuación mín.</span>
                                            <span className="font-semibold text-slate-700">{module.passingScore}%</span>
                                        </div>
                                    </div>
                                    <div className="w-px h-8 bg-slate-200" />
                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                        <div className="flex flex-col">
                                            <span className="text-xs text-slate-400">Video req.</span>
                                            <span className="font-semibold text-slate-700">{module.requiredWatchPercentage}%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingModule ? 'Editar Módulo' : 'Nuevo Módulo'}
                subtitle="Sube tu video y configura los requisitos de aprobación."
                maxWidth="xl"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setShowModal(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSubmit} isLoading={isSubmitting || isUploading} disabled={isUploading || !formData.transcription.trim()}>
                            {editingModule ? 'Guardar Cambios' : 'Crear Módulo'}
                        </Button>
                    </>
                }
            >
                <div className="space-y-6">
                    {/* Basic Info: Title & Order */}
                    <div className="flex flex-col md:flex-row gap-5">
                        <div className="flex-1">
                            <Input
                                label="Título del Módulo"
                                value={formData.title}
                                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="Ej: Análisis de Mercado"
                                required
                            />
                        </div>
                        <div className="md:w-32">
                            <Input
                                label="Orden"
                                type="number"
                                value={formData.order}
                                onChange={e => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 1 }))}
                                min={1}
                            />
                        </div>
                    </div>

                    <TextArea
                        label="Descripción"
                        value={formData.description}
                        onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Resumen del contenido del video..."
                        rows={2}
                        required
                    />

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left Column: Video */}
                        <div className="space-y-4">
                            <label className="text-sm font-medium text-slate-700 block">Video del Módulo</label>
                            {formData.videoUrl ? (
                                <div className="group relative bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                                    <video src={formData.videoUrl} className="w-full aspect-video object-cover" controls />
                                    <div className="p-3 flex justify-between items-center bg-white border-t border-slate-100">
                                        <span className="text-xs text-emerald-600 font-medium flex items-center gap-1.5">
                                            <CheckCircle2 size={14} />
                                            Video cargado
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, videoUrl: '' }))}
                                            className="text-xs text-red-500 hover:text-red-700 font-medium hover:underline"
                                        >
                                            Cambiar video
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer h-full flex flex-col items-center justify-center min-h-[200px] ${isUploading ? 'border-purple-400 bg-purple-50/50' : 'border-slate-300 hover:border-purple-400 hover:bg-purple-50/10'}`}
                                >
                                    {isUploading ? (
                                        <div className="w-full max-w-[200px]">
                                            <div className="w-12 h-12 mx-auto mb-3 relative flex items-center justify-center">
                                                <div className="absolute inset-0 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin" />
                                            </div>
                                            <p className="text-purple-700 font-medium text-sm mb-2 text-center">Subiendo video...</p>
                                            <div className="w-full h-1.5 bg-purple-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-purple-600 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm text-purple-600 border border-slate-100 group-hover:scale-110 transition-transform">
                                                <UploadCloud size={24} />
                                            </div>
                                            <h4 className="text-slate-900 font-medium text-sm mb-1">Subir Video MP4</h4>
                                            <p className="text-slate-400 text-xs">Máx. 500MB</p>
                                        </>
                                    )}
                                    <input
                                        type="file"
                                        accept="video/mp4,video/*"
                                        ref={fileInputRef}
                                        onChange={(e) => e.target.files && handleVideoUpload(e.target.files[0])}
                                        hidden
                                    />
                                </div>
                            )}
                        </div>

                        {/* Right Column: AI & Transcription */}
                        <div className="space-y-4 flex flex-col">
                            <div className="flex-1 space-y-2">
                                <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                    <Lightbulb size={16} className="text-amber-500" />
                                    Contexto para IA
                                </label>
                                <TextArea
                                    value={formData.videoContext}
                                    onChange={e => setFormData(prev => ({ ...prev, videoContext: e.target.value }))}
                                    placeholder="Puntos clave para generar el quiz..."
                                    rows={3}
                                    className="bg-amber-50/30 focus:bg-white text-sm"
                                />
                            </div>

                            <div className="flex-1 space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                        <FileText size={16} className="text-purple-600" />
                                        Transcripción
                                    </label>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        onClick={handleTranscribe}
                                        disabled={!formData.videoUrl || isTranscribing}
                                        leftIcon={isTranscribing ? <div className="animate-spin rounded-full h-3 w-3 border-2 border-purple-600 border-t-transparent" /> : <Wand2 size={12} />}
                                    >
                                        {isTranscribing ? 'Generando...' : 'Generar'}
                                    </Button>
                                </div>
                                <TextArea
                                    value={formData.transcription}
                                    onChange={e => setFormData(prev => ({ ...prev, transcription: e.target.value }))}
                                    placeholder="Texto del video..."
                                    rows={4}
                                    className="font-mono text-xs leading-relaxed"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Requirements Footer Section */}
                    <div className="bg-slate-50 rounded-xl p-5 border border-slate-100">
                        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <CheckCircle2 size={16} className="text-slate-400" />
                            Configuración de Aprobación
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                            {/* Watch % */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-medium text-slate-500">Video Requerido</span>
                                    <span className="text-sm font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm">
                                        {formData.requiredWatchPercentage}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={formData.requiredWatchPercentage}
                                    onChange={(e) => setFormData(prev => ({ ...prev, requiredWatchPercentage: parseInt(e.target.value) }))}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                />
                            </div>

                            {/* Passing Score */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-medium text-slate-500">Nota Mínima</span>
                                    <span className="text-sm font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm">
                                        {formData.passingScore}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={formData.passingScore}
                                    onChange={(e) => setFormData(prev => ({ ...prev, passingScore: parseInt(e.target.value) }))}
                                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                />
                            </div>

                            {/* Active Switch */}
                            <div className="flex justify-end border-l border-slate-200 pl-8">
                                <Switch
                                    label="Módulo Activo"
                                    description="Visible para estudiantes"
                                    checked={formData.isActive}
                                    onChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
