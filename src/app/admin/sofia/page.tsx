'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Bot, Save, AlertCircle, CheckCircle, Sparkles } from 'lucide-react';
import Toast, { ToastType } from '@/components/Toast';

export default function SofiaKnowledgeBase() {
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

    useEffect(() => {
        loadKnowledgeBase();
    }, []);

    const loadKnowledgeBase = async () => {
        try {
            const docRef = doc(db, 'knowledge_base', 'sofia');
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                setContent(docSnap.data().content || '');
            } else {
                // Default content
                setContent('Eres Bally IA, la asistente de Inteligencia Artificial de Urbanity (Mi Talento). Tu objetivo es ayudar a los estudiantes...');
            }
        } catch (error) {
            console.error('Error loading knowledge base:', error);
            setToast({ message: 'Error al cargar la base de conocimiento', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!content.trim()) {
            setToast({ message: 'El contenido no puede estar vacío', type: 'error' });
            return;
        }

        setSaving(true);
        try {
            await setDoc(doc(db, 'knowledge_base', 'sofia'), {
                content,
                updatedAt: new Date(),
            });
            setToast({ message: 'Base de conocimiento actualizada correctamente', type: 'success' });
        } catch (error) {
            console.error('Error saving knowledge base:', error);
            setToast({ message: 'Error al guardar. Intenta de nuevo.', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    // Context Health Logic
    const getContextHealth = (length: number) => {
        if (length < 2000) return {
            label: 'Crítico',
            color: 'text-red-500',
            bg: 'bg-red-500',
            borderColor: 'border-red-200',
            gradient: 'from-red-500 to-red-600',
            percent: 10,
            message: 'Muy poca información. Bally IA alucinará casi seguro.'
        };
        if (length < 10000) return {
            label: 'Bajo',
            color: 'text-orange-500',
            bg: 'bg-orange-500',
            borderColor: 'border-orange-200',
            gradient: 'from-orange-400 to-orange-500',
            percent: 35,
            message: 'Contexto insuficiente. Se recomienda ampliar a 10k caracteres.'
        };
        if (length < 30000) return {
            label: 'Saludable',
            color: 'text-[var(--success)]',
            bg: 'bg-[var(--success)]',
            borderColor: 'border-green-200',
            gradient: 'from-[#10B981] to-[#059669]', // Emerald 500-600
            percent: 75,
            message: '¡Excelente! Nivel óptimo para buena precisión.'
        };
        return {
            label: 'Robusto',
            color: 'text-purple-600',
            bg: 'bg-purple-600',
            borderColor: 'border-purple-200',
            gradient: 'from-purple-500 to-indigo-600',
            percent: 100,
            message: 'Máxima precisión. Bally IA tiene abundante contexto.'
        };
    };

    const health = getContextHealth(content.length);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-[var(--primary-100)] border-t-[var(--primary-700)] rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20 lg:pb-0">
            <header>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-[var(--primary-100)] text-[var(--primary-700)] rounded-lg">
                        <Bot size={24} />
                    </div>
                    <h1 className="text-display text-[var(--text-primary)] tracking-tight">Base de Conocimiento Bally IA</h1>
                </div>
                <p className="text-[var(--text-secondary)]">
                    Define la información y el contexto que Bally IA utilizará para responder a los estudiantes.
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Editor Column */}
                <div className="lg:col-span-2 space-y-4">



                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[800px] relative transition-all duration-200 hover:shadow-md">

                        {/* Editor Toolbar / Header */}
                        <div className="bg-gray-50 border-b border-gray-100 p-3 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="flex gap-1.5 px-2">
                                    <div className="w-3 h-3 rounded-full bg-red-400/80"></div>
                                    <div className="w-3 h-3 rounded-full bg-amber-400/80"></div>
                                    <div className="w-3 h-3 rounded-full bg-green-400/80"></div>
                                </div>
                                <div className="h-4 w-px bg-gray-300 mx-2"></div>
                                <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
                                    <Sparkles size={12} className="text-purple-500" />
                                    Editor de Sistema
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <span className="text-[10px] font-medium text-gray-400 bg-white border border-gray-200 px-2 py-1 rounded-md shadow-sm">
                                    Markdown Soportado
                                </span>
                            </div>
                        </div>

                        {/* Editor Area */}
                        <div className="relative flex-grow bg-white group">
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                className="w-full h-full p-8 resize-none outline-none text-gray-800 leading-8 font-mono text-[13px] bg-transparent focus:bg-gray-50/30 transition-colors custom-scrollbar z-10 relative selection:bg-purple-100 selection:text-purple-900"
                                placeholder="# Identidad del Asistente..."
                                spellCheck={false}
                            />

                            {/* Subtle line numbers decoration (Visual only, simple guide) */}
                            <div className="absolute top-8 left-3 bottom-8 w-6 flex flex-col items-center pt-1 gap-[2rem] opacity-20 pointer-events-none select-none hidden sm:flex">
                                <span className="text-[10px] font-mono">1</span>
                                <span className="text-[10px] font-mono">5</span>
                                <span className="text-[10px] font-mono">10</span>
                                <span className="text-[10px] font-mono">15</span>
                                <span className="text-[10px] font-mono">20</span>
                            </div>
                        </div>

                        {/* Sticky Action Footer */}
                        <div className="p-4 bg-white/80 backdrop-blur-md border-t border-gray-100 flex justify-between items-center absolute bottom-0 left-0 right-0 z-20">
                            <div className="text-xs text-gray-400 font-medium pl-2">
                                {saving ? 'Guardando cambios...' : 'Cambios sin guardar'}
                            </div>
                            <Button
                                onClick={handleSave}
                                disabled={saving}
                                className="!px-8 !py-2.5 !rounded-lg shadow-lg shadow-purple-500/20 !bg-gray-900 hover:!bg-gray-800 !text-white transition-all transform active:scale-95 flex items-center gap-2 group"
                            >
                                {saving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Guardando...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} className="group-hover:text-purple-300 transition-colors" />
                                        <span>Guardar Configuración</span>
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Sidebar Help */}
                <div className="space-y-6">
                    {/* Thermometer / Health Indicator - Premium UI (Moved to Sidebar) */}
                    <div className={`p-4 rounded-xl border ${health.borderColor} bg-white shadow-sm transition-all duration-300`}>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <span className={`flex items-center justify-center w-8 h-8 rounded-full ${health.bg} bg-opacity-10 ${health.color}`}>
                                    <Sparkles size={16} />
                                </span>
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Salud del Contexto</p>
                                    <p className={`text-sm font-bold ${health.color}`}>{health.label}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-2xl font-bold text-[var(--text-primary)] font-mono tracking-tight">
                                    {content.length.toLocaleString()}
                                </span>
                                <span className="text-xs text-[var(--text-muted)] ml-1">caracteres</span>
                            </div>
                        </div>

                        {/* Progress Bar Container - High Contrast & Optimized UX */}
                        <div className="relative pt-4 pb-2 px-1">

                            {/* The Bar Track */}
                            <div className="relative h-5 bg-gray-100 rounded-full overflow-hidden box-border border border-gray-200">
                                {/* Zone Backgrounds (Subtle hints of regions) */}
                                <div className="absolute inset-0 flex w-full h-full opacity-30">
                                    <div className="w-[25%] bg-red-100 border-r border-dotted border-red-200"></div> {/* 0-10k */}
                                    <div className="w-[50%] bg-orange-50 border-r border-dotted border-orange-200"></div> {/* 10k-30k (50% width because 25+50=75) */}
                                    <div className="flex-1 bg-green-50"></div> {/* 30k+ */}
                                </div>

                                {/* Fill with Shimmer */}
                                <div
                                    className={`absolute top-0 left-0 h-full rounded-full bg-gradient-to-r ${health.gradient} transition-all duration-1000 ease-out shadow-[0_2px_4px_rgba(0,0,0,0.1)] relative z-10 flex items-center justify-end pr-2`}
                                    style={{ width: `${Math.min(Math.max((content.length / 40000) * 100, 2), 100)}%` }} // Scale: 40k = 100%
                                >
                                    {/* Current Value Indicator inside bar if space permits */}
                                    {content.length > 5000 && (
                                        <div className="h-1.5 w-1.5 bg-white rounded-full animate-pulse shadow-sm" />
                                    )}
                                </div>
                            </div>

                            {/* Axis Labels (High Contrast Axis) */}
                            <div className="relative w-full h-8 mt-2 text-[11px] font-bold text-gray-400 select-none font-mono">
                                {/* Start */}
                                <div className="absolute left-0 top-0 transform -translate-x-0 flex flex-col items-center">
                                    <div className="w-0.5 h-1.5 bg-gray-300 mb-1"></div>
                                    <span className="text-gray-500">0</span>
                                </div>

                                {/* 10k Mark (25%) */}
                                <div className={`absolute left-[25%] top-0 transform -translate-x-1/2 flex flex-col items-center transition-colors duration-300 ${content.length >= 10000 ? 'text-emerald-600' : ''}`}>
                                    <div className={`w-0.5 h-2 mb-1 ${content.length >= 10000 ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                                    <span>10k</span>
                                </div>

                                {/* 30k Mark (75%) */}
                                <div className={`absolute left-[75%] top-0 transform -translate-x-1/2 flex flex-col items-center transition-colors duration-300 ${content.length >= 30000 ? 'text-purple-600' : ''}`}>
                                    <div className={`w-0.5 h-2 mb-1 ${content.length >= 30000 ? 'bg-purple-500' : 'bg-gray-300'}`}></div>
                                    <span>30k</span>
                                </div>

                                {/* Max (40k) */}
                                <div className="absolute right-0 top-0 transform translate-x-0 flex flex-col items-center">
                                    <div className="w-0.5 h-1.5 bg-gray-300 mb-1"></div>
                                    <span>40k+</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-1 flex items-start gap-3 bg-[var(--bg-surface)] p-3 rounded-lg border border-gray-100">
                            <div className={`mt-0.5 p-1 rounded-full ${health.bg} bg-opacity-10 shrink-0`}>
                                <CheckCircle size={16} className={health.color} />
                            </div>
                            <div>
                                <p className={`text-sm font-bold ${health.color} mb-0.5`}>{health.message}</p>
                                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                                    {content.length < 10000
                                        ? "El modelo necesita más hechos y reglas para no inventar respuestas."
                                        : "Nivel de contexto adecuado para respuestas precisas."}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-[var(--primary-50)] to-white p-6 rounded-2xl border border-[var(--primary-100)] shadow-sm">
                        <h3 className="font-bold text-[var(--primary-800)] mb-4 flex items-center gap-2">
                            <AlertCircle size={18} />
                            Tips de Configuración
                        </h3>
                        <ul className="space-y-4 text-sm text-[var(--text-secondary)]">
                            <li className="flex gap-3 items-start">
                                <div className="min-w-[6px] h-[6px] rounded-full bg-[var(--primary-400)] mt-1.5" />
                                <p><strong>Estructura tu contenido:</strong> Usa Markdown (# Títulos, - Listas) para que el modelo entienda la jerarquía.</p>
                            </li>
                            <li className="flex gap-3 items-start">
                                <div className="min-w-[6px] h-[6px] rounded-full bg-[var(--primary-400)] mt-1.5" />
                                <p><strong>Volumen Ideal:</strong> Entre 10k y 30k caracteres reduces drásticamente las alucinaciones.</p>
                            </li>
                            <li className="flex gap-3 items-start">
                                <div className="min-w-[6px] h-[6px] rounded-full bg-[var(--primary-400)] mt-1.5" />
                                <p><strong>Facts:</strong> Incluye listas de precios, fechas exactas y nombres oficiales para que no tenga que inventarlos.</p>
                            </li>
                            <li className="flex gap-3 items-start">
                                <div className="min-w-[6px] h-[6px] rounded-full bg-[var(--primary-400)] mt-1.5" />
                                <p><strong>Seguridad:</strong> Instruye explícitamente qué NO decir (ej. "No prometas rentabilidad garantizada").</p>
                            </li>
                        </ul>
                    </div>


                </div>
            </div>

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
}
