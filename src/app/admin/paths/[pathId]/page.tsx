'use client';

import { useEffect, useState, useRef, use } from 'react';
import Image from 'next/image';
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
    Timestamp,
} from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { Course, LearningPath } from '@/types';
import { FIXED_PATHS } from '@/lib/constants';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    Plus,
    BookOpen,
    Pencil,
    Trash2,
    MoreVertical,
    Folder,
    ImageIcon,
    LayoutGrid,
    Loader2
} from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { Switch } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';

export default function PathCoursesPage({ params }: { params: Promise<{ pathId: string }> }) {
    const { pathId } = use(params);
    const { user } = useAuth();
    const router = useRouter();

    const [path, setPath] = useState<LearningPath | null>(null);
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingCourse, setEditingCourse] = useState<Course | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formErrors, setFormErrors] = useState<{ title?: string; description?: string }>({});

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        thumbnailUrl: '',
        order: 1,
        isActive: true,
        isOptional: false,
    });

    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (pathId) {
            loadData();
        }
    }, [pathId]);

    const handleImageUpload = async (file: File) => {
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Por favor selecciona un archivo de imagen válido');
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        try {
            const storageRef = ref(storage, `course-thumbnails/${Date.now()}-${file.name}`);
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(progress);
                },
                (error) => {
                    console.error('Upload error:', error.code, error.message);
                    alert(`Error al subir la imagen: ${error.code || error.message}`);
                    setIsUploading(false);
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    setFormData(prev => ({ ...prev, thumbnailUrl: downloadURL }));
                    setIsUploading(false);
                }
            );
        } catch (error) {
            console.error('Error initiating upload:', error);
            setIsUploading(false);
        }
    };

    const loadData = async () => {
        try {
            setLoading(true);
            // Cargar datos de la ruta: primero FIXED_PATHS, luego Firestore
            const pathData = FIXED_PATHS.find(p => p.id === pathId);
            if (pathData) {
                setPath(pathData);
            } else {
                const pathDoc = await getDoc(doc(db, 'learning_paths', pathId));
                if (!pathDoc.exists()) {
                    alert('Ruta no encontrada');
                    router.push('/admin/paths');
                    return;
                }
                setPath({ id: pathDoc.id, ...pathDoc.data() } as LearningPath);
            }

            // Cargar cursos de la ruta
            const q = query(
                collection(db, 'courses'),
                where('pathId', '==', pathId),
                orderBy('order', 'asc')
            );
            const snapshot = await getDocs(q);
            const coursesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Course));
            setCourses(coursesData);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        // Validar campos requeridos
        const errors: { title?: string; description?: string } = {};
        if (!formData.title.trim()) errors.title = 'El título es obligatorio';
        if (!formData.description.trim()) errors.description = 'La descripción es obligatoria';

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }

        setFormErrors({});
        setIsSubmitting(true);

        try {
            if (editingCourse) {
                await updateDoc(doc(db, 'courses', editingCourse.id), {
                    ...formData,
                });
            } else {
                await addDoc(collection(db, 'courses'), {
                    ...formData,
                    pathId,
                    createdAt: Timestamp.now(),
                    createdBy: user?.uid,
                });
            }

            setShowModal(false);
            resetForm();
            loadData();
        } catch (error: unknown) {
            const firebaseError = error as { code?: string; message?: string };
            console.error('Error saving course:', firebaseError.code, firebaseError.message);
            alert(`Error al guardar el curso: ${firebaseError.code || firebaseError.message || 'Error desconocido'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (course: Course) => {
        setEditingCourse(course);
        setFormData({
            title: course.title,
            description: course.description,
            thumbnailUrl: course.thumbnailUrl || '',
            order: course.order,
            isActive: course.isActive,
            isOptional: course.isOptional || false,
        });
        setShowModal(true);
    };

    const handleDelete = async (courseId: string) => {
        if (!confirm('¿Estás seguro de eliminar este curso? Se perderán las asociaciones con módulos.')) return;

        try {
            await deleteDoc(doc(db, 'courses', courseId));
            loadData();
        } catch (error) {
            console.error('Error deleting course:', error);
            alert('Error al eliminar el curso');
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            thumbnailUrl: '',
            order: courses.length + 1,
            isActive: true,
            isOptional: false,
        });
        setEditingCourse(null);
        setFormErrors({});
    };

    const openNewCourseModal = () => {
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

    if (!path) return null;

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Breadcrumb & Header */}
            <div>
                <Link
                    href="/admin/paths"
                    className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-purple-600 transition-colors mb-4 group"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    <span>Volver a Rutas</span>
                </Link>

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-2">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center text-3xl shadow-sm border border-slate-100">
                            {path.icon}
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{path.title}</h1>
                            <p className="text-slate-500 text-lg">Gestión de Cursos</p>
                        </div>
                    </div>
                    <Button onClick={openNewCourseModal} leftIcon={<Plus size={20} />} className="shadow-lg shadow-purple-500/25">
                        Nuevo Curso
                    </Button>
                </div>
            </div>

            {/* Courses Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {courses.map((course) => (
                    <div key={course.id} className="group card-premium relative overflow-hidden flex flex-col bg-white">
                        {/* Thumbnail Area */}
                        <div className="relative h-48 bg-slate-100 overflow-hidden border-b border-slate-100">
                            {course.thumbnailUrl ? (
                                <Image
                                    src={course.thumbnailUrl}
                                    alt={course.title}
                                    fill
                                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-300">
                                    <ImageIcon size={48} />
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-60" />

                            {/* Status Badges */}
                            <div className="absolute top-4 left-4 flex gap-2 flex-wrap max-w-[80%]">
                                <span className={`backdrop-blur-md text-white text-xs font-medium px-2.5 py-1 rounded-lg border border-white/20 shadow-sm ${course.isActive ? 'bg-emerald-500/80' : 'bg-slate-500/80'}`}>
                                    {course.isActive ? 'Publicado' : 'Borrador'}
                                </span>
                                <span className="bg-black/30 backdrop-blur-md text-white text-xs font-medium px-2.5 py-1 rounded-lg border border-white/20">
                                    #{course.order}
                                </span>
                                {course.isOptional && (
                                    <span className="bg-blue-500/80 backdrop-blur-md text-white text-xs font-medium px-2.5 py-1 rounded-lg shadow-lg">
                                        Opcional
                                    </span>
                                )}
                            </div>

                            {/* Actions Overlay */}

                        </div>

                        {/* Content */}
                        <div className="p-6 flex-1 flex flex-col">
                            <div className="flex justify-between items-start gap-4 mb-2">
                                <h3 className="font-bold text-xl text-slate-900 line-clamp-2">{course.title}</h3>
                            </div>

                            <p className="text-slate-600 text-sm mb-6 line-clamp-3 leading-relaxed flex-1">
                                {course.description}
                            </p>

                            <div className="flex items-center gap-3 pt-4 border-t border-slate-100 mt-auto">
                                <Link
                                    href={`/admin/courses/${course.id}/modules`}
                                    className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-slate-700 hover:text-white bg-white hover:bg-purple-600 px-4 py-2.5 rounded-lg transition-all border border-slate-200 hover:border-purple-600 shadow-sm group/btn"
                                >
                                    <Folder size={16} className="text-slate-400 group-hover/btn:text-white/90 transition-colors" />
                                    Ver Módulos
                                </Link>
                                <div className="flex items-center gap-1 border-l border-slate-100 pl-3">
                                    <button
                                        onClick={() => handleEdit(course)}
                                        className="p-2.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                        title="Editar Curso"
                                    >
                                        <Pencil size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(course.id)}
                                        className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Eliminar Curso"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Add New Card */}
                <button
                    onClick={openNewCourseModal}
                    className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 transition-all group h-full min-h-[300px]"
                >
                    <div className="w-16 h-16 rounded-full bg-slate-50 group-hover:bg-purple-100 flex items-center justify-center text-slate-400 group-hover:text-purple-600 transition-colors mb-4 shadow-sm">
                        <Plus size={32} />
                    </div>
                    <span className="text-base font-semibold text-slate-600 group-hover:text-purple-700">Crear Nuevo Curso</span>
                    <span className="text-sm text-slate-400 mt-1">Añade contenido a esta ruta</span>
                </button>
            </div>

            {/* Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingCourse ? 'Editar Curso' : 'Nuevo Curso'}
                subtitle={`Añadiendo contenido a: ${path.title}`}
                maxWidth="2xl"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setShowModal(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSubmit} isLoading={isSubmitting}>
                            {editingCourse ? 'Guardar Cambios' : 'Crear Curso'}
                        </Button>
                    </>
                }
            >
                <div className="space-y-6">
                    <div className="space-y-6">
                        {/* Header: Title & Order */}
                        <div className="flex flex-col md:flex-row gap-5">
                            <div className="flex-1">
                                <Input
                                    label="Título del Curso"
                                    value={formData.title}
                                    onChange={e => {
                                        setFormData({ ...formData, title: e.target.value });
                                        if (formErrors.title) setFormErrors(prev => ({ ...prev, title: undefined }));
                                    }}
                                    placeholder="Ej: Fundamentos de Ventas"
                                    required
                                />
                                {formErrors.title && <p className="text-red-500 text-xs mt-1">{formErrors.title}</p>}
                            </div>
                            <div className="md:w-32">
                                <Input
                                    label="Orden"
                                    type="number"
                                    value={formData.order}
                                    onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                                    min={1}
                                />
                            </div>
                        </div>

                        <div>
                            <TextArea
                                label="Descripción"
                                value={formData.description}
                                onChange={e => {
                                    setFormData({ ...formData, description: e.target.value });
                                    if (formErrors.description) setFormErrors(prev => ({ ...prev, description: undefined }));
                                }}
                                placeholder="Describe qué aprenderán los estudiantes..."
                                rows={3}
                                required
                            />
                            {formErrors.description && <p className="text-red-500 text-xs mt-1">{formErrors.description}</p>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                            {/* Image Upload Section */}
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 block">Imagen de Portada</label>
                                {formData.thumbnailUrl ? (
                                    <div className="group relative h-48 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                                        <Image
                                            src={formData.thumbnailUrl}
                                            alt="Preview"
                                            fill
                                            sizes="400px"
                                            className="object-cover transition-transform group-hover:scale-105"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 backdrop-blur-sm">
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                className="p-2 bg-white/90 rounded-lg text-slate-700 hover:text-purple-600 transition-colors shadow-lg"
                                                title="Cambiar imagen"
                                            >
                                                <Pencil size={20} />
                                            </button>
                                            <button
                                                onClick={() => setFormData({ ...formData, thumbnailUrl: '' })}
                                                className="p-2 bg-white/90 rounded-lg text-slate-700 hover:text-red-600 transition-colors shadow-lg"
                                                title="Eliminar imagen"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`relative h-48 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all ${isUploading ? 'border-purple-400 bg-purple-50/30' : 'border-slate-200 hover:border-purple-400 hover:bg-slate-50'}`}
                                    >
                                        {isUploading ? (
                                            <div className="w-full max-w-[150px] text-center">
                                                <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-3" />
                                                <p className="text-sm font-medium text-purple-600">Subiendo...</p>
                                                <p className="text-xs text-purple-400">{Math.round(uploadProgress)}%</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-2xl flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform">
                                                    <ImageIcon size={24} />
                                                </div>
                                                <p className="text-sm font-medium text-slate-600">Sube una imagen</p>
                                                <p className="text-xs text-slate-400 mt-1">PNG, JPG, WebP (Max 2MB)</p>
                                            </>
                                        )}
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                                if (e.target.files?.[0]) handleImageUpload(e.target.files[0]);
                                            }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Configuration Section */}
                            <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 flex flex-col h-full">
                                <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                                    <LayoutGrid size={16} className="text-slate-400" />
                                    Configuración
                                </h3>

                                <div className="space-y-6 flex-1">
                                    <div className="flex items-start gap-3">
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-slate-700">Estado del Curso</p>
                                            <p className="text-xs text-slate-500 mt-0.5">Controla la visibilidad para los estudiantes.</p>
                                        </div>
                                        <Switch
                                            checked={formData.isActive}
                                            onChange={(checked) => setFormData({ ...formData, isActive: checked })}
                                        />
                                    </div>

                                    <div className="w-full h-px bg-slate-200" />

                                    <div className="flex items-start gap-3">
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-slate-700">Requisito</p>
                                            <p className="text-xs text-slate-500 mt-0.5">Si es opcional, no bloquea el avance.</p>
                                        </div>
                                        <Switch
                                            checked={!formData.isOptional}
                                            onChange={(checked) => setFormData({ ...formData, isOptional: !checked })}
                                            label={!formData.isOptional ? "Obligatorio" : "Opcional"}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
