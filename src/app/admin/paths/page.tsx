'use client';

import { useState, useEffect } from 'react';
import { FIXED_PATHS } from '@/lib/constants';
import { db } from '@/lib/firebase';
import { LearningPath, CertificationLevel } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import {
    collection,
    query,
    orderBy,
    getDocs,
    doc,
    setDoc,
    deleteDoc,
    Timestamp
} from 'firebase/firestore';
import {
    BookOpen,
    Search,
    Filter,
    Plus,
    Edit2,
    Trash2,
    XCircle,
    Shield
} from 'lucide-react';

export default function PathsPage() {
    const { user } = useAuth();
    const [dynamicPaths, setDynamicPaths] = useState<LearningPath[]>([]);
    const [loading, setLoading] = useState(true);

    // UI States
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingPath, setEditingPath] = useState<LearningPath | null>(null);
    const [saving, setSaving] = useState(false);

    // Form Data
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        icon: '📚',
        order: 99,
        isActive: true,
        certificationLevel: 'none' as CertificationLevel,
    });

    useEffect(() => {
        loadDynamicPaths();
    }, []);

    const loadDynamicPaths = async () => {
        try {
            setLoading(true);
            const q = query(collection(db, 'learning_paths'), orderBy('order', 'asc'));
            const snapshot = await getDocs(q);
            const loaded = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as LearningPath));
            setDynamicPaths(loaded);
        } catch (error) {
            console.error('Error loading dynamic paths:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (path?: LearningPath) => {
        if (path) {
            setEditingPath(path);
            setFormData({
                title: path.title,
                description: path.description,
                icon: path.icon || '📚',
                order: path.order || 99,
                isActive: path.isActive,
                certificationLevel: path.certificationLevel || 'none',
            });
        } else {
            setEditingPath(null);
            setFormData({
                title: '',
                description: '',
                icon: '📚',
                order: Math.max(...[...FIXED_PATHS, ...dynamicPaths].map(p => p.order || 0)) + 1,
                isActive: true,
                certificationLevel: 'none',
            });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingPath(null);
    };

    const handleSavePath = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        try {
            setSaving(true);
            const pathData = {
                ...formData,
                updatedAt: Timestamp.now(),
                updatedBy: user.uid,
            };

            if (editingPath) {
                await setDoc(doc(db, 'learning_paths', editingPath.id), pathData, { merge: true });
            } else {
                const newId = `path-${Date.now()}`;
                await setDoc(doc(db, 'learning_paths', newId), {
                    ...pathData,
                    createdAt: Timestamp.now(),
                    createdBy: user.uid,
                });
            }

            await loadDynamicPaths();
            handleCloseModal();
        } catch (error) {
            console.error('Error saving path:', error);
            alert('Error guardando la ruta');
        } finally {
            setSaving(false);
        }
    };

    const handleDeletePath = async (pathId: string) => {
        if (!confirm('¿Estás seguro de eliminar esta ruta especializada? Los cursos alojados en ella quedarán huérfanos.')) return;

        try {
            await deleteDoc(doc(db, 'learning_paths', pathId));
            await loadDynamicPaths();
        } catch (error) {
            console.error('Error deleting path:', error);
            alert('Error eliminando la ruta');
        }
    };

    // Fusión de rutas fijas y dinámicas
    const allPaths = [...FIXED_PATHS, ...dynamicPaths].sort((a, b) => (a.order || 99) - (b.order || 99));

    const filteredPaths = allPaths.filter(path =>
        path.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        path.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isFixedPath = (pathId: string) => FIXED_PATHS.some(fp => fp.id === pathId);

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            {/* Header with Actions */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Rutas de Aprendizaje</h1>
                    <p className="text-slate-500 mt-2 text-base font-medium">Define el mapa de conocimientos para tu equipo.</p>
                </div>
            </div>

            {/* Search & Actions */}
            <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="flex-1 w-full relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search size={20} className="text-slate-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar rutas..."
                        className="w-full pl-11 pr-4 py-3 bg-white/70 backdrop-blur-md border border-slate-200/80 rounded-full focus:ring-4 focus:ring-[#135bec]/10 focus:border-[#135bec] text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center justify-center w-full md:w-auto gap-2 px-6 py-3 bg-[#135bec] text-white font-semibold hover:bg-[#0f4ac0] rounded-full transition-all duration-300 shadow-[0_4px_14px_0_rgba(19,91,236,0.25)] hover:shadow-[0_6px_20px_0_rgba(19,91,236,0.35)] active:scale-95 shrink-0"
                >
                    <Plus size={20} strokeWidth={2.5} />
                    <span>Nueva Ruta Especializada</span>
                </button>
            </div>

            {/* List View - Premium UI */}
            <div className="grid grid-cols-1 gap-5">
                {filteredPaths.map((path) => {
                    const esFija = isFixedPath(path.id);

                    // Determinar estilos visuales basados en el nivel
                    let levelStyles = {
                        bg: 'bg-slate-50',
                        text: 'text-slate-600',
                        border: 'border-slate-200',
                        iconBg: 'bg-slate-50',
                        label: 'Sin Nivel'
                    };

                    if (path.certificationLevel === 'fundamental') {
                        levelStyles = {
                            bg: 'bg-emerald-50/80',
                            text: 'text-emerald-700',
                            border: 'border-emerald-200/60',
                            iconBg: 'bg-emerald-50 text-emerald-600',
                            label: 'Fundamental'
                        };
                    } else if (path.certificationLevel === 'professional') {
                        levelStyles = {
                            bg: 'bg-amber-50/80',
                            text: 'text-amber-700',
                            border: 'border-amber-200/60',
                            iconBg: 'bg-amber-100 text-amber-600',
                            label: 'Profesional'
                        };
                    } else if (path.certificationLevel === 'elite') {
                        levelStyles = {
                            bg: 'bg-rose-50/80',
                            text: 'text-rose-700',
                            border: 'border-rose-200/60',
                            iconBg: 'bg-rose-50 text-rose-600',
                            label: 'Élite'
                        };
                    }

                    return (
                        <div
                            key={path.id}
                            className="group relative bg-white rounded-[24px] p-6 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.12)] border border-slate-100 transition-all duration-400 ease-out"
                        >
                            <div className="flex flex-col md:flex-row items-start md:items-center gap-6 relative z-10 w-full">
                                {/* Icon Container */}
                                <div className={`shrink-0 w-16 h-16 rounded-[18px] flex items-center justify-center text-3xl transition-transform duration-300 group-hover:scale-105 ${levelStyles.iconBg}`}>
                                    {path.icon}
                                </div>

                                {/* Main Content */}
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                    <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                                        <h3 className="text-[1.15rem] font-bold text-slate-800 tracking-tight leading-tight">
                                            {path.title}
                                        </h3>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border ${levelStyles.bg} ${levelStyles.text} ${levelStyles.border}`}>
                                            {levelStyles.label}
                                        </span>
                                        {esFija && (
                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100/80 text-slate-500 text-[10px] font-bold tracking-wide uppercase border border-slate-200/60">
                                                <Shield size={10} className="text-slate-400" />
                                                Obligatoria
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-slate-500 text-sm leading-relaxed mb-4 md:mb-0 max-w-2xl line-clamp-2">
                                        {path.description}
                                    </p>
                                </div>

                                {/* Meta & Actions */}
                                <div className="flex flex-col md:flex-row items-start md:items-center gap-5 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100 shrink-0">
                                    <div className="flex items-center gap-4">
                                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                                            Orden: {path.order}
                                        </span>
                                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${path.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-500'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${path.isActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-400'}`}></span>
                                            {path.isActive ? 'Activa' : 'Inactiva'}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                                        {!esFija && (
                                            <div className="flex items-center gap-1 mr-1">
                                                <button
                                                    onClick={() => handleOpenModal(path)}
                                                    className="p-2.5 text-slate-400 hover:text-[#135bec] hover:bg-[#135bec]/5 rounded-xl transition-all"
                                                    title="Editar Ruta"
                                                >
                                                    <Edit2 size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeletePath(path.id)}
                                                    className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                                    title="Eliminar Ruta"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        )}

                                        <Link
                                            href={`/admin/paths/${path.id}`}
                                            className="shrink-0 px-6 py-2.5 bg-slate-50 text-[#135bec] font-semibold hover:bg-[#135bec] hover:text-white rounded-full transition-all duration-300 flex items-center gap-2 border border-[#135bec]/10 hover:border-transparent group/btn active:scale-95"
                                            title="Gestionar Cursos en esta Ruta"
                                        >
                                            <BookOpen size={18} className="transition-transform group-hover/btn:-translate-y-0.5" />
                                            <span>Gestionar</span>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {filteredPaths.length === 0 && (
                    <div className="p-16 text-center text-slate-500 bg-white border border-slate-200 rounded-2xl shadow-sm">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-5 text-slate-300">
                            <Search size={40} />
                        </div>
                        <h3 className="text-xl font-semibold text-slate-900">No se encontraron rutas</h3>
                        <p className="text-slate-500 mt-2">Intenta con otros términos de búsqueda.</p>
                    </div>
                )}
            </div>

            {/* Modal para Crear/Editar Ruta Opcional */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h2 className="text-xl font-bold text-slate-800">
                                {editingPath ? 'Editar Ruta Especializada' : 'Nueva Ruta Especializada'}
                            </h2>
                            <button
                                onClick={handleCloseModal}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <form id="path-form" onSubmit={handleSavePath} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Título de la Ruta</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                                        value={formData.title}
                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                        placeholder="Ej: Marketing Digital Avanzado"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Descripción</label>
                                    <textarea
                                        required
                                        rows={3}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none resize-none"
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Breve descripción de los objetivos de esta especialización..."
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Icono (Emoji)</label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-center text-xl"
                                            value={formData.icon}
                                            onChange={e => setFormData({ ...formData, icon: e.target.value })}
                                            placeholder="📚"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Orden de Visualización</label>
                                        <input
                                            type="number"
                                            required
                                            min="4"
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                                            value={formData.order}
                                            onChange={e => setFormData({ ...formData, order: Number(e.target.value) })}
                                        />

                                    </div>
                                </div>



                                <div className="flex items-center gap-3 pt-2">
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={formData.isActive}
                                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                        <span className="ml-3 text-sm font-medium text-slate-700">Ruta Activa y Visible</span>
                                    </label>
                                </div>
                            </form>
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 rounded-b-2xl">
                            <button
                                type="button"
                                onClick={handleCloseModal}
                                className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200/50 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                form="path-form"
                                disabled={saving}
                                className="px-5 py-2.5 bg-indigo-600 text-white font-medium hover:bg-indigo-700 rounded-xl transition-all shadow-sm hover:shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Guardando...</span>
                                    </>
                                ) : (
                                    <span>Guardar Ruta</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
