'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/Button';
import { Bot, Save, AlertCircle, Sparkles, ChevronDown, ChevronUp, Building2, Target, MessageSquareText, ShieldAlert, User } from 'lucide-react';
import Toast, { ToastType } from '@/components/Toast';
import AdminPageHeader from '@/components/AdminPageHeader';

// Doc id legacy: Bally IA se llamaba SofIA antes. Se conserva 'sofia' para no migrar
// datos en Firestore. Ver LENGUAJE_UBICUO.md (sección "Términos deprecados").
const BALLY_KB_DOC_ID = 'sofia';

// ─── Types ────────────────────────────────────────────────────────────────────
interface KnowledgeBase {
    identity: string;
    projectData: string;
    salesPitch: string;
    faq: string;
    restrictions: string;
}

interface SectionConfig {
    key: keyof KnowledgeBase;
    title: string;
    icon: React.ReactNode;
    description: string;
    placeholder: string;
    minSuggested: number;
    required: boolean;
    color: string;
}

// ─── Section definitions ──────────────────────────────────────────────────────
const SECTIONS: SectionConfig[] = [
    {
        key: 'identity',
        title: 'Identidad y Rol',
        icon: <User size={16} />,
        description: 'Define quien es Bally IA, su tono y personalidad base. Las instrucciones de formato de respuesta son automaticas y no necesitan estar aqui.',
        placeholder: `Eres Bally IA, la asistente de inteligencia artificial de [Nombre Empresa]. Tu objetivo es ayudar a los asesores comerciales con informacion precisa del proyecto.

Personalidad:
- Profesional pero cercana
- Responde con datos concretos
- Si no sabes algo, dilo honestamente`,
        minSuggested: 200,
        required: false,
        color: 'purple',
    },
    {
        key: 'projectData',
        title: 'Datos del Proyecto',
        icon: <Building2 size={16} />,
        description: 'Informacion factual: nombre, ubicacion, metrajes, precios, financiamiento, cronograma. Esta es la seccion MAS IMPORTANTE.',
        placeholder: `# Proyecto Casuarinas de Lurin

## Ubicacion
Sur de Lima, frente a la urbanizacion Praderas de Lurin.
- Cerca de: Estacion central del Tren de Cercanias, Macropolis
- Futuro Metro (5 min)

## Tipos de Lotes
- Lote Estandar: 90m2 - 120m2
- Lote Premium: 150m2 - 200m2

## Precios
- Desde S/ 85,000 (lote estandar 90m2)
- Hasta S/ 180,000 (lote premium 200m2)
- Cuota inicial: desde S/ 8,500 (10%)
- Financiamiento directo hasta 60 meses

## Cronograma
- Inicio de obra: Marzo 2025
- Entrega Etapa 1: Diciembre 2026`,
        minSuggested: 2000,
        required: true,
        color: 'blue',
    },
    {
        key: 'salesPitch',
        title: 'Argumentario de Ventas',
        icon: <Target size={16} />,
        description: 'Diferenciadores, ventajas competitivas, objeciones comunes con sus respuestas, y frases de cierre.',
        placeholder: `# Diferenciadores Clave
- Unico proyecto con acceso directo al Tren de Cercanias
- Areas verdes de 5,000 m2
- Club house con piscina incluido en mantenimiento

# Objeciones Comunes

## "Lurin esta muy lejos"
Respuesta: Con el Tren de Cercanias llegas al centro de Lima en 35 min. Ademas, el Metro llegara en 2027 a 5 min del proyecto.

## "Es muy caro"
Respuesta: El m2 en Lurin esta a S/944, mientras que en zonas cercanas como Pachacamac esta a S/1,200. Es una inversion con plusvalia garantizada por las obras de transporte.

## "No confio en preventa"
Respuesta: Tenemos carta fianza bancaria con [Banco]. Tu dinero esta protegido.

# Frases de Cierre
- "Los precios de preventa se ajustan cada 45 dias. Hoy es el mejor momento."
- "Puedo separarte el lote con solo S/500 de apartado."`,
        minSuggested: 1500,
        required: false,
        color: 'emerald',
    },
    {
        key: 'faq',
        title: 'Preguntas Frecuentes',
        icon: <MessageSquareText size={16} />,
        description: 'Preguntas que los asesores reciben constantemente, con respuestas exactas.',
        placeholder: `## Puedo construir inmediatamente?
Si, los lotes de la Etapa 1 ya cuentan con habilitacion urbana completa.

## Que incluye el mantenimiento?
- Seguridad 24/7 con camaras
- Areas verdes
- Iluminacion de calles
- Club house y piscina
- Costo: S/150 mensual

## Aceptan credito hipotecario?
Si, trabajamos con BCP, Interbank y BBVA. Tambien ofrecemos financiamiento directo.

## Cual es el proceso de compra?
1. Separacion con S/500
2. Firma de contrato (7 dias)
3. Pago de cuota inicial (30 dias)
4. Cuotas mensuales segun plan elegido`,
        minSuggested: 1000,
        required: false,
        color: 'amber',
    },
    {
        key: 'restrictions',
        title: 'Restricciones y Limites',
        icon: <ShieldAlert size={16} />,
        description: 'Reglas que Bally IA NUNCA debe romper. Que no debe decir, que no debe prometer.',
        placeholder: `- NUNCA prometas rentabilidad garantizada o porcentajes de plusvalia exactos
- NUNCA des informacion de precios que no este en tu base de conocimiento
- NUNCA hables mal de la competencia directamente
- Si no tienes la informacion, responde: "No tengo ese dato exacto, pero tu asesor lo puede confirmar."
- NO compartas datos internos de la empresa (margenes, costos reales, comisiones)
- SIEMPRE recomienda agendar una visita presencial para cerrar la venta`,
        minSuggested: 200,
        required: false,
        color: 'red',
    },
];

const DEFAULT_KB: KnowledgeBase = {
    identity: '',
    projectData: '',
    salesPitch: '',
    faq: '',
    restrictions: '',
};

// ─── Color utilities ──────────────────────────────────────────────────────────
function getSectionColorClasses(color: string) {
    const map: Record<string, { bg: string; border: string; text: string; iconBg: string; ring: string }> = {
        purple: { bg: 'bg-[#60356a]/5', border: 'border-[#60356a]/20', text: 'text-[#4a2852]', iconBg: 'bg-[#60356a]/10', ring: 'ring-[#60356a]/30' },
        blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', iconBg: 'bg-blue-100', ring: 'ring-blue-300' },
        emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', iconBg: 'bg-emerald-100', ring: 'ring-emerald-300' },
        amber: { bg: 'bg-[#f5a944]/10', border: 'border-[#f5a944]/30', text: 'text-[#c47e25]', iconBg: 'bg-[#f5a944]/20', ring: 'ring-[#f5a944]/50' },
        red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', iconBg: 'bg-red-100', ring: 'ring-red-300' },
    };
    return map[color] || map.purple;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function BallyKnowledgeBase() {
    const [kb, setKb] = useState<KnowledgeBase>(DEFAULT_KB);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        identity: true,
        projectData: true,
        salesPitch: true,
        faq: true,
        restrictions: true,
    });

    useEffect(() => {
        loadKnowledgeBase();
    }, []);

    const loadKnowledgeBase = async () => {
        try {
            const docRef = doc(db, 'knowledge_base', BALLY_KB_DOC_ID);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();

                // MIGRATION: If old format (single 'content' field), put it in projectData
                if (data.content && !data.identity && !data.projectData) {
                    setKb({
                        ...DEFAULT_KB,
                        projectData: data.content,
                    });
                    setToast({
                        message: 'Contenido migrado automaticamente del formato anterior. Revisa las secciones y guarda.',
                        type: 'info' as ToastType,
                    });
                } else {
                    setKb({
                        identity: data.identity || '',
                        projectData: data.projectData || '',
                        salesPitch: data.salesPitch || '',
                        faq: data.faq || '',
                        restrictions: data.restrictions || '',
                    });
                }
            }
        } catch (error) {
            console.error('Error loading knowledge base:', error);
            setToast({ message: 'Error al cargar la base de conocimiento', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        // Validate required fields
        if (!kb.projectData.trim()) {
            setToast({ message: 'La seccion "Datos del Proyecto" es obligatoria. No puede estar vacia.', type: 'error' });
            return;
        }

        setSaving(true);
        try {
            await setDoc(doc(db, 'knowledge_base', BALLY_KB_DOC_ID), {
                identity: kb.identity,
                projectData: kb.projectData,
                salesPitch: kb.salesPitch,
                faq: kb.faq,
                restrictions: kb.restrictions,
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

    const updateField = useCallback((key: keyof KnowledgeBase, value: string) => {
        setKb(prev => ({ ...prev, [key]: value }));
    }, []);

    const toggleSection = (key: string) => {
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // ─── Context Health Logic ─────────────────────────────────────────────────
    const totalChars = Object.values(kb).reduce((sum, val) => sum + val.length, 0);

    // Scale: 15k = 100% (optimal target). Beyond 15k the bar stays full.
    const TARGET_CHARS = 15000;

    const getContextHealth = (length: number) => {
        const percent = Math.min(Math.max((length / TARGET_CHARS) * 100, 2), 100);

        if (length < 2000) return {
            label: 'Critico',
            color: 'text-red-500',
            bg: 'bg-red-500',
            borderColor: 'border-red-200',
            gradient: 'from-red-500 to-red-600',
            percent,
            message: 'Muy poca informacion. Bally IA alucinara casi seguro.',
            description: 'El modelo necesita mas hechos y reglas para no inventar respuestas.',
        };
        if (length < 5000) return {
            label: 'Bajo',
            color: 'text-[#f5a944]',
            bg: 'bg-[#f5a944]',
            borderColor: 'border-[#f5a944]/30',
            gradient: 'from-[#f5a944]/90 to-[#f5a944]',
            percent,
            message: 'Contexto insuficiente. Completa al menos los datos del proyecto.',
            description: 'Agrega precios, metrajes y ubicacion para reducir alucinaciones.',
        };
        if (length < 8000) return {
            label: 'Aceptable',
            color: 'text-yellow-600',
            bg: 'bg-yellow-500',
            borderColor: 'border-yellow-200',
            gradient: 'from-yellow-400 to-yellow-500',
            percent,
            message: 'Aceptable. Agrega argumentario y FAQ para mejor precision.',
            description: 'El bot puede responder consultas basicas pero le falta contexto de ventas.',
        };
        if (length <= 15000) return {
            label: 'Optimo',
            color: 'text-emerald-600',
            bg: 'bg-emerald-500',
            borderColor: 'border-emerald-200',
            gradient: 'from-emerald-500 to-emerald-600',
            percent,
            message: 'Nivel optimo. Precision alta para consultas de asesores.',
            description: 'Rango ideal: buena precision sin costos excesivos por request.',
        };
        return {
            label: 'Excedido',
            color: 'text-[#e09536]',
            bg: 'bg-[#f5a944]',
            borderColor: 'border-[#f5a944]/30',
            gradient: 'from-[#f5a944] to-[#f5a944]',
            percent: 100,
            message: 'Excede el rango recomendado. Revisa contenido redundante.',
            description: 'Mas de 15k chars aumenta costos sin mejorar precision significativamente.',
        };
    };

    const health = getContextHealth(totalChars);

    // ─── Loading state ────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-[var(--primary-100)] border-t-[var(--primary-700)] rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-4 lg:space-y-6 pb-28 lg:pb-0">
            <AdminPageHeader
                title="Bally IA Knowledge"
                subtitle="Define el contexto que Bally IA usa para responder a los asesores"
                icon={<Bot size={18} />}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ─── Editor Column (Sections) ─────────────────────────────────── */}
                <div className="lg:col-span-2 space-y-4">
                    {SECTIONS.map((section) => {
                        const colors = getSectionColorClasses(section.color);
                        const isExpanded = expandedSections[section.key];
                        const charCount = kb[section.key].length;
                        const isBelowMin = charCount > 0 && charCount < section.minSuggested;
                        const isEmpty = charCount === 0;

                        return (
                            <div
                                key={section.key}
                                className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden ${
                                    section.required && isEmpty
                                        ? 'border-red-300 shadow-sm shadow-red-100'
                                        : 'border-gray-200 shadow-sm hover:shadow-md'
                                }`}
                            >
                                {/* Section Header (Clickable) */}
                                <button
                                    onClick={() => toggleSection(section.key)}
                                    className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-gray-50/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${colors.iconBg} ${colors.text} flex-shrink-0`}>
                                            {section.icon}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-bold text-gray-800 truncate">
                                                    {section.title}
                                                </h3>
                                                {section.required && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-500 bg-red-50 px-1.5 py-0.5 rounded flex-shrink-0">
                                                        Requerido
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-400 truncate mt-0.5 hidden sm:block">
                                                {charCount > 0
                                                    ? `${charCount.toLocaleString()} caracteres`
                                                    : 'Sin contenido'}
                                                {section.minSuggested > 0 && ` / min. sugerido: ${section.minSuggested.toLocaleString()}`}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {/* Status dot */}
                                        <div className={`w-2 h-2 rounded-full ${
                                            isEmpty
                                                ? section.required ? 'bg-red-400' : 'bg-gray-300'
                                                : isBelowMin
                                                    ? 'bg-[#f5a944]/90'
                                                    : 'bg-emerald-400'
                                        }`} />
                                        {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                                    </div>
                                </button>

                                {/* Section Body (Expandable) */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 space-y-3">
                                        {/* Description */}
                                        <p className="text-xs text-gray-500 leading-relaxed pl-1">
                                            {section.description}
                                        </p>

                                        {/* Textarea */}
                                        <div className="relative">
                                            <textarea
                                                value={kb[section.key]}
                                                onChange={(e) => updateField(section.key, e.target.value)}
                                                className={`w-full p-4 rounded-lg border bg-gray-50/50 text-gray-800 leading-7 font-mono text-[13px] outline-none resize-none transition-all duration-200 focus:bg-white focus:ring-2 ${colors.ring} focus:border-transparent custom-scrollbar selection:bg-[#60356a]/10 selection:text-[#4a2852]`}
                                                placeholder={section.placeholder}
                                                spellCheck={false}
                                                rows={Math.max(6, Math.min(16, Math.ceil(kb[section.key].length / 80)))}
                                            />
                                        </div>

                                        {/* Footer info */}
                                        <div className="flex items-center justify-between px-1">
                                            <span className="text-[11px] text-gray-400 font-mono">
                                                {charCount.toLocaleString()} chars
                                            </span>
                                            {isBelowMin && (
                                                <span className="text-[11px] text-[#e09536] font-medium">
                                                    Sugerido: min. {section.minSuggested.toLocaleString()} caracteres
                                                </span>
                                            )}
                                            {section.required && isEmpty && (
                                                <span className="text-[11px] text-red-500 font-medium">
                                                    Esta seccion es obligatoria
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* ─── Save Button (Sticky on mobile) ──────────────────────────── */}
                    <div className="fixed bottom-0 left-0 right-0 lg:static bg-white/90 backdrop-blur-md border-t lg:border-t-0 border-gray-200 p-4 lg:p-0 z-30 lg:z-auto">
                        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
                            <div className="text-xs text-gray-400 font-medium hidden lg:block">
                                {saving ? 'Guardando cambios...' : `${totalChars.toLocaleString()} caracteres en total`}
                            </div>
                            <Button
                                onClick={handleSave}
                                disabled={saving}
                                className="!px-8 !py-2.5 !rounded-lg shadow-lg shadow-[#834f8f]/20 !bg-gray-900 hover:!bg-gray-800 !text-white transition-all transform active:scale-95 flex items-center gap-2 group w-full lg:w-auto"
                            >
                                {saving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Guardando...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} className="group-hover:text-[#60356a]/30 transition-colors" />
                                        <span>Guardar Configuracion</span>
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* ─── Sidebar ──────────────────────────────────────────────────── */}
                <div className="space-y-6">
                    {/* Health Indicator */}
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
                                    {totalChars.toLocaleString()}
                                </span>
                                <span className="text-xs text-[var(--text-muted)] ml-1">chars</span>
                            </div>
                        </div>

                        {/* Progress Bar — Scale: 0 to 15k (optimal target) */}
                        <div className="relative pt-4 pb-2 px-1">
                            <div className="relative h-5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                                {/* Zone backgrounds: 0-2k critical | 2k-5k low | 5k-8k acceptable | 8k-15k optimal */}
                                <div className="absolute inset-0 flex w-full h-full opacity-30">
                                    <div className="w-[13%] bg-red-100 border-r border-dotted border-red-200"></div>
                                    <div className="w-[20%] bg-[#f5a944]/10 border-r border-dotted border-[#f5a944]/30"></div>
                                    <div className="w-[20%] bg-yellow-50 border-r border-dotted border-yellow-200"></div>
                                    <div className="flex-1 bg-emerald-50"></div>
                                </div>
                                <div
                                    className={`absolute top-0 left-0 h-full rounded-full bg-gradient-to-r ${health.gradient} transition-all duration-1000 ease-out shadow-[0_2px_4px_rgba(0,0,0,0.1)] flex items-center justify-end pr-2`}
                                    style={{ width: `${Math.min(Math.max(health.percent, 2), 100)}%` }}
                                >
                                    {totalChars > 3000 && (
                                        <div className="h-1.5 w-1.5 bg-white rounded-full animate-pulse shadow-sm" />
                                    )}
                                </div>
                            </div>

                            {/* Axis Labels — 0, 5k, 8k, 15k */}
                            <div className="relative w-full h-8 mt-2 text-[10px] font-bold text-gray-400 select-none font-mono">
                                <div className="absolute left-0 top-0 flex flex-col items-center">
                                    <div className="w-0.5 h-1.5 bg-gray-300 mb-0.5"></div>
                                    <span>0</span>
                                </div>
                                <div className={`absolute left-[33%] top-0 transform -translate-x-1/2 flex flex-col items-center ${totalChars >= 5000 ? 'text-[#f5a944]' : ''}`}>
                                    <div className={`w-0.5 h-2 mb-0.5 ${totalChars >= 5000 ? 'bg-[#f5a944]/90' : 'bg-gray-300'}`}></div>
                                    <span>5k</span>
                                </div>
                                <div className={`absolute left-[53%] top-0 transform -translate-x-1/2 flex flex-col items-center ${totalChars >= 8000 ? 'text-yellow-600' : ''}`}>
                                    <div className={`w-0.5 h-2 mb-0.5 ${totalChars >= 8000 ? 'bg-yellow-500' : 'bg-gray-300'}`}></div>
                                    <span>8k</span>
                                </div>
                                <div className={`absolute right-0 top-0 flex flex-col items-center ${totalChars >= 15000 ? 'text-emerald-600' : ''}`}>
                                    <div className={`w-0.5 h-2 mb-0.5 ${totalChars >= 15000 ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                                    <span>15k</span>
                                </div>
                            </div>
                        </div>

                        {/* Health message */}
                        <div className="mt-1 flex items-start gap-3 bg-[var(--bg-surface)] p-3 rounded-lg border border-gray-100">
                            <div className={`mt-0.5 p-1 rounded-full ${health.bg} bg-opacity-10 shrink-0`}>
                                <Sparkles size={14} className={health.color} />
                            </div>
                            <div>
                                <p className={`text-sm font-bold ${health.color} mb-0.5`}>{health.message}</p>
                                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{health.description}</p>
                            </div>
                        </div>
                    </div>

                    {/* Section completeness */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Completitud por Seccion</h3>
                        <div className="space-y-2.5">
                            {SECTIONS.map((section) => {
                                const chars = kb[section.key].length;
                                const status = chars === 0
                                    ? section.required ? 'empty-required' : 'empty'
                                    : chars < section.minSuggested
                                        ? 'low'
                                        : 'ok';

                                return (
                                    <div key={section.key} className="flex items-center gap-2.5">
                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                            status === 'empty-required' ? 'bg-red-400'
                                                : status === 'empty' ? 'bg-gray-300'
                                                    : status === 'low' ? 'bg-[#f5a944]/90'
                                                        : 'bg-emerald-400'
                                        }`} />
                                        <span className="text-xs text-gray-600 flex-1 truncate">{section.title}</span>
                                        <span className="text-[11px] font-mono text-gray-400 flex-shrink-0">
                                            {chars > 0 ? `${(chars / 1000).toFixed(1)}k` : '--'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Tips */}
                    <div className="bg-gradient-to-br from-[var(--primary-50)] to-white p-5 rounded-xl border border-[var(--primary-100)] shadow-sm">
                        <h3 className="font-bold text-[var(--primary-800)] mb-3 flex items-center gap-2 text-sm">
                            <AlertCircle size={16} />
                            Tips de Configuracion
                        </h3>
                        <ul className="space-y-3 text-xs text-[var(--text-secondary)]">
                            <li className="flex gap-2.5 items-start">
                                <div className="min-w-[5px] h-[5px] rounded-full bg-[var(--primary-400)] mt-1.5" />
                                <p><strong>Prioriza datos concretos:</strong> Precios, metrajes, fechas y nombres exactos evitan que el bot invente.</p>
                            </li>
                            <li className="flex gap-2.5 items-start">
                                <div className="min-w-[5px] h-[5px] rounded-full bg-[var(--primary-400)] mt-1.5" />
                                <p><strong>Meta: llenar la barra hasta 15k.</strong> Suficiente para precision alta sin costos excesivos.</p>
                            </li>
                            <li className="flex gap-2.5 items-start">
                                <div className="min-w-[5px] h-[5px] rounded-full bg-[var(--primary-400)] mt-1.5" />
                                <p><strong>Usa Markdown:</strong> Titulos (#), listas (-) y negritas (**) ayudan al modelo a entender la jerarquia.</p>
                            </li>
                            <li className="flex gap-2.5 items-start">
                                <div className="min-w-[5px] h-[5px] rounded-full bg-[var(--primary-400)] mt-1.5" />
                                <p><strong>Objeciones:</strong> Incluir "pregunta + respuesta ideal" es lo que mas impacto tiene en la calidad del bot.</p>
                            </li>
                            <li className="flex gap-2.5 items-start">
                                <div className="min-w-[5px] h-[5px] rounded-full bg-[var(--primary-400)] mt-1.5" />
                                <p><strong>Cache de 5 min:</strong> Los cambios tardan hasta 5 minutos en reflejarse en el chat.</p>
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
