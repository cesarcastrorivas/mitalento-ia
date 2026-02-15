'use client';

import { useEffect, useState } from 'react';
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
import { db } from '@/lib/firebase';
import { LearningPath } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import {
    Plus,
    BookOpen,
    Pencil,
    Trash2,
    Search,
    Filter,
    LayoutGrid,
    List as ListIcon
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { Switch } from '@/components/ui/Switch';
import { EmojiPicker } from '@/components/ui/EmojiPicker';
import { Button } from '@/components/ui/Button';

export default function PathsPage() {
    const { user } = useAuth();
    const [paths, setPaths] = useState<LearningPath[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingPath, setEditingPath] = useState<LearningPath | null>(null);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchTerm, setSearchTerm] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        icon: '🎓',
        order: 1,
        isActive: true,
    });

    useEffect(() => {
        loadPaths();
    }, []);

    const loadPaths = async () => {
        try {
            const q = query(collection(db, 'learning_paths'), orderBy('order', 'asc'));
            const snapshot = await getDocs(q);
            const pathsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as LearningPath));
            setPaths(pathsData);
        } catch (error) {
            console.error('Error loading paths:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!formData.title || !formData.description) return;
        setIsSubmitting(true);

        try {
            if (editingPath) {
                await updateDoc(doc(db, 'learning_paths', editingPath.id), {
                    ...formData,
                });
            } else {
                if (!user?.uid) {
                    alert('Error: No hay usuario autenticado para crear la ruta');
                    return;
                }
                const newOrder = paths.length > 0 ? Math.max(...paths.map(p => p.order)) + 1 : 1;
                await addDoc(collection(db, 'learning_paths'), {
                    ...formData,
                    order: formData.order || newOrder,
                    createdAt: Timestamp.now(),
                    createdBy: user.uid,
                });
            }

            setShowModal(false);
            resetForm();
            loadPaths();
        } catch (error: any) {
            console.error('Error saving path:', error);
            alert(`Error al guardar la ruta: ${error.message || 'Error desconocido'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEdit = (path: LearningPath) => {
        setEditingPath(path);
        setFormData({
            title: path.title,
            description: path.description,
            icon: path.icon || '🎓',
            order: path.order,
            isActive: path.isActive,
        });
        setShowModal(true);
    };

    const handleDelete = async (pathId: string) => {
        if (!confirm('¿Estás seguro de eliminar esta ruta? Se perderán las asociaciones con cursos.')) return;

        try {
            await deleteDoc(doc(db, 'learning_paths', pathId));
            loadPaths();
        } catch (error) {
            console.error('Error deleting path:', error);
            alert('Error al eliminar la ruta');
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            icon: '🎓',
            order: paths.length + 1,
            isActive: true,
        });
        setEditingPath(null);
    };

    const openNewPathModal = () => {
        resetForm();
        setShowModal(true);
    };

    const filteredPaths = paths.filter(path =>
        path.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        path.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header with Actions */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Rutas de Aprendizaje</h1>
                    <p className="text-slate-500 mt-2 text-lg">Gestiona los caminos profesionales y sus contenidos</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden md:flex bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <LayoutGrid size={20} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-slate-100 text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <ListIcon size={20} />
                        </button>
                    </div>
                    <Button onClick={openNewPathModal} leftIcon={<Plus size={20} />} className="shadow-lg shadow-purple-500/25">
                        Nueva Ruta
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 bg-white p-2 text-sm rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex-1 flex items-center gap-3 px-4">
                    <Search size={20} className="text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar rutas..."
                        className="flex-1 bg-transparent border-none focus:ring-0 text-base placeholder:text-slate-400 py-2 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-[1px] h-8 bg-slate-200"></div>
                <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors">
                    <Filter size={18} />
                    <span>Filtros</span>
                </button>
            </div>

            {/* Grid View */}
            {viewMode === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPaths.map((path) => (
                        <div key={path.id} className="group card-premium relative overflow-hidden flex flex-col h-full bg-white">
                            <div className="absolute top-4 right-4 z-10">
                            </div>

                            <div className="p-6 flex-1">
                                <div className="flex items-start gap-4 mb-4">
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 flex items-center justify-center text-3xl shadow-inner border border-white/50 group-hover:scale-110 transition-transform duration-300">
                                        {path.icon}
                                    </div>
                                    <div className="flex-1 min-w-0 pt-1">
                                        <h3 className="font-bold text-lg text-slate-900 truncate">{path.title}</h3>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${path.isActive
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                : 'bg-slate-50 text-slate-600 border-slate-100'
                                                }`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${path.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                                {path.isActive ? 'Activa' : 'Inactiva'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <p className="text-sm text-slate-600 mb-2 line-clamp-3 leading-relaxed">
                                    {path.description}
                                </p>
                            </div>

                            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center gap-3">
                                <Link
                                    href={`/admin/paths/${path.id}`}
                                    className="flex-1 flex items-center justify-center py-2 px-4 bg-white hover:bg-purple-600 text-slate-700 hover:text-white rounded-lg text-sm font-medium transition-all border border-slate-200 hover:border-purple-600 shadow-sm group/btn"
                                >
                                    <BookOpen size={16} className="mr-2 text-slate-400 group-hover/btn:text-white/80 transition-colors" />
                                    Gestionar
                                </Link>
                                <div className="flex items-center border-l border-slate-200 pl-3 gap-1">
                                    <button
                                        onClick={(e) => { e.preventDefault(); handleEdit(path); }}
                                        className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                        title="Editar"
                                    >
                                        <Pencil size={18} />
                                    </button>
                                    <button
                                        onClick={(e) => { e.preventDefault(); handleDelete(path.id); }}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Eliminar"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Add New Card */}
                    <button
                        onClick={openNewPathModal}
                        className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 transition-all group h-full min-h-[300px]"
                    >
                        <div className="w-16 h-16 rounded-full bg-slate-50 group-hover:bg-purple-100 flex items-center justify-center text-slate-400 group-hover:text-purple-600 transition-colors mb-4 shadow-sm">
                            <Plus size={32} />
                        </div>
                        <span className="text-base font-semibold text-slate-600 group-hover:text-purple-700">Crear Nueva Ruta</span>
                        <span className="text-sm text-slate-400 mt-1">Define un nuevo camino de aprendizaje</span>
                    </button>
                </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    {filteredPaths.map((path, index) => (
                        <div key={path.id} className={`flex items-center p-5 hover:bg-slate-50 transition-colors ${index !== filteredPaths.length - 1 ? 'border-b border-slate-100' : ''}`}>
                            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl mr-5">
                                {path.icon}
                            </div>
                            <div className="flex-1 min-w-0 grid grid-cols-12 gap-6 items-center">
                                <div className="col-span-5">
                                    <h3 className="font-semibold text-slate-900 truncate text-base">{path.title}</h3>
                                    <p className="text-sm text-slate-500 truncate mt-0.5">{path.description}</p>
                                </div>
                                <div className="col-span-2">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${path.isActive
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                        : 'bg-slate-50 text-slate-600 border-slate-100'
                                        }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${path.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                                        {path.isActive ? 'Activa' : 'Inactiva'}
                                    </span>
                                </div>
                                <div className="col-span-2 text-sm text-slate-500 font-medium">
                                    Orden: {path.order}
                                </div>
                                <div className="col-span-3 flex items-center justify-end gap-2">
                                    <Link
                                        href={`/admin/paths/${path.id}`}
                                        className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                        title="Ver Cursos"
                                    >
                                        <BookOpen size={20} />
                                    </Link>
                                    <button
                                        onClick={() => handleEdit(path)}
                                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                    >
                                        <Pencil size={20} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(path.id)}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={20} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {filteredPaths.length === 0 && (
                        <div className="p-12 text-center text-slate-500">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                <Search size={32} />
                            </div>
                            <h3 className="text-lg font-medium text-slate-900">No se encontraron rutas</h3>
                            <p className="text-slate-500 mt-1">Intenta con otros términos de búsqueda.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Premium Modal */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title={editingPath ? 'Editar Ruta de Aprendizaje' : 'Nueva Ruta de Aprendizaje'}
                subtitle="Define los detalles básicos para este camino profesional."
                maxWidth="2xl"
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setShowModal(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSubmit} isLoading={isSubmitting}>
                            {editingPath ? 'Guardar Cambios' : 'Crear Ruta'}
                        </Button>
                    </>
                }
            >
                <div className="space-y-6">
                    {/* Header: Title & Order */}
                    <div className="flex flex-col md:flex-row gap-5">
                        <div className="flex-1">
                            <Input
                                label="Título de la Ruta"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                placeholder="Ej: Asesor Inmobiliario"
                                required
                            />
                        </div>
                        <div className="md:w-32">
                            <Input
                                label="Orden"
                                type="number"
                                value={formData.order}
                                onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                                placeholder="1"
                                min={1}
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <TextArea
                        label="Descripción"
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Describe el objetivo y alcance de esta ruta..."
                        rows={3}
                        required
                    />

                    {/* Bottom Grid: Icon & Config */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                        {/* Left: Icon Picker */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 block">Icono Representativo</label>
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 h-full flex items-center justify-center min-h-[140px]">
                                <EmojiPicker
                                    value={formData.icon}
                                    onChange={(emoji) => setFormData({ ...formData, icon: emoji })}
                                />
                            </div>
                        </div>

                        {/* Right: Configuration Box */}
                        <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 h-full flex flex-col justify-center">
                            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <LayoutGrid size={16} className="text-slate-400" />
                                Configuración
                            </h3>

                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-700">Ruta Activa</p>
                                    <p className="text-xs text-slate-500 mt-0.5">Controla la visibilidad.</p>
                                </div>
                                <Switch
                                    checked={formData.isActive}
                                    onChange={(checked) => setFormData({ ...formData, isActive: checked })}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
