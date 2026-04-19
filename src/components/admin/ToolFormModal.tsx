'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    addDoc,
    collection,
    doc,
    setDoc,
    Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { uploadTool, TOOL_MAX_MB, TOOL_ACCEPT } from '@/lib/tool-upload';
import type { Tool, ToolType, ToolFolder } from '@/types';
import {
    XCircle,
    Play,
    Volume2,
    Image as ImageIcon,
    FileText,
    ClipboardCopy,
    UploadCloud,
} from 'lucide-react';

interface ToolFormModalProps {
    open: boolean;
    onClose: () => void;
    folders: ToolFolder[];
    defaultCategory: string;
    editing?: Tool | null;
    onSaved: () => void;
    siblingTools?: Tool[];
}

const TYPE_TABS: { type: ToolType; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { type: 'video',  label: 'Video',  icon: Play },
    { type: 'audio',  label: 'Audio',  icon: Volume2 },
    { type: 'image',  label: 'Imagen', icon: ImageIcon },
    { type: 'pdf',    label: 'PDF',    icon: FileText },
    { type: 'script', label: 'Script', icon: ClipboardCopy },
];

function buildCategoryOptions(folders: ToolFolder[]) {
    const byParent = new Map<string | null, ToolFolder[]>();
    folders.forEach((f) => {
        const list = byParent.get(f.parentId) || [];
        list.push(f);
        byParent.set(f.parentId, list);
    });

    const options: { value: string; label: string }[] = [{ value: 'root', label: 'Raíz' }];
    const roots = (byParent.get(null) || []).sort((a, b) => a.order - b.order);
    for (const root of roots) {
        options.push({ value: `folder_${root.id}`, label: root.name });
        const subs = (byParent.get(root.id) || []).sort((a, b) => a.order - b.order);
        for (const sub of subs) {
            options.push({ value: `folder_${sub.id}`, label: `${root.name} → ${sub.name}` });
        }
    }
    return options;
}

export default function ToolFormModal({
    open,
    onClose,
    folders,
    defaultCategory,
    editing,
    onSaved,
    siblingTools = [],
}: ToolFormModalProps) {
    const { user } = useAuth();
    const [type, setType] = useState<ToolType>('video');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('root');
    const [order, setOrder] = useState(1);
    const [isActive, setIsActive] = useState(true);
    const [scriptContent, setScriptContent] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [progress, setProgress] = useState(0);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const categoryOptions = useMemo(() => buildCategoryOptions(folders), [folders]);

    useEffect(() => {
        if (!open) return;
        if (editing) {
            setType(editing.type);
            setTitle(editing.title);
            setDescription(editing.description || '');
            setCategory(editing.category || 'root');
            setOrder(editing.order || 1);
            setIsActive(editing.isActive);
            setScriptContent(editing.type === 'script' ? editing.url : '');
            setFile(null);
        } else {
            const peers = siblingTools.filter((t) => t.category === defaultCategory);
            const nextOrder = peers.length
                ? Math.max(...peers.map((t) => t.order || 0)) + 1
                : 1;
            setType('video');
            setTitle('');
            setDescription('');
            setCategory(defaultCategory);
            setOrder(nextOrder);
            setIsActive(true);
            setScriptContent('');
            setFile(null);
        }
        setProgress(0);
        setError(null);
    }, [open, editing, defaultCategory, siblingTools]);

    if (!open) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (type === 'script') return;

        const kind = type as Exclude<ToolType, 'script'>;
        const allowedMimes = TOOL_ACCEPT[kind].split(',').map((m) => m.trim());
        const typeLabel = TYPE_TABS.find((t) => t.type === kind)?.label ?? kind;

        // Poka-yoke: el tipo seleccionado debe coincidir con el MIME del archivo.
        // El atributo `accept` solo filtra el diálogo del SO; el usuario puede saltárselo
        // eligiendo "Todos los archivos". Validamos explícitamente para evitar que se suba
        // un PDF como "Imagen" y reviente browser-image-compression con un error genérico.
        if (!allowedMimes.includes(f.type)) {
            const ext = f.name.includes('.') ? f.name.split('.').pop()!.toUpperCase() : f.type || 'desconocido';
            const friendly: Record<Exclude<ToolType, 'script'>, string> = {
                video: 'un video MP4',
                audio: 'un audio MP3',
                image: 'una imagen JPG, PNG o WebP',
                pdf: 'un PDF',
            };
            setError(
                `Tipo seleccionado "${typeLabel}" pero el archivo es ${ext}. Cambia la pestaña de tipo o sube ${friendly[kind]}.`,
            );
            e.target.value = '';
            setFile(null);
            return;
        }

        const maxMB = TOOL_MAX_MB[kind];
        if (f.size > maxMB * 1024 * 1024) {
            setError(`El archivo pesa ${(f.size / 1024 / 1024).toFixed(1)}MB. Máximo permitido: ${maxMB}MB.`);
            e.target.value = '';
            return;
        }
        setError(null);
        setFile(f);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (!title.trim()) return;

        setSaving(true);
        setError(null);
        try {
            const now = Timestamp.now();
            const basePayload = {
                title: title.trim(),
                description: description.trim() || undefined,
                type,
                category,
                order,
                isActive,
                updatedAt: now,
                updatedBy: user.uid,
            };

            if (editing) {
                // Si es script: actualizar contenido. Si es binario y no hay file nuevo,
                // conservar url/file*. Si hay file nuevo, subir antes de escribir.
                let patch: Record<string, unknown> = { ...basePayload };

                if (type === 'script') {
                    patch = {
                        ...patch,
                        url: scriptContent,
                        fileName: undefined,
                        fileSize: scriptContent.length,
                        mimeType: 'text/plain',
                    };
                } else if (file) {
                    const up = await uploadTool(
                        file,
                        editing.id,
                        type as Exclude<ToolType, 'script'>,
                        setProgress,
                    );
                    patch = {
                        ...patch,
                        url: up.url,
                        fileName: up.fileName,
                        fileSize: up.fileSize,
                        mimeType: up.mimeType,
                        duration: up.duration ?? null,
                    };
                }

                await setDoc(doc(db, 'tools', editing.id), patch, { merge: true });
            } else {
                // Crear: primero el doc para obtener ID, luego subir archivo, luego actualizar.
                if (type === 'script') {
                    await addDoc(collection(db, 'tools'), {
                        ...basePayload,
                        url: scriptContent,
                        fileSize: scriptContent.length,
                        mimeType: 'text/plain',
                        createdAt: now,
                        createdBy: user.uid,
                    });
                } else {
                    if (!file) {
                        setError('Selecciona un archivo para subir.');
                        setSaving(false);
                        return;
                    }
                    const newRef = await addDoc(collection(db, 'tools'), {
                        ...basePayload,
                        url: '',
                        createdAt: now,
                        createdBy: user.uid,
                    });
                    const up = await uploadTool(
                        file,
                        newRef.id,
                        type as Exclude<ToolType, 'script'>,
                        setProgress,
                    );
                    await setDoc(
                        doc(db, 'tools', newRef.id),
                        {
                            url: up.url,
                            fileName: up.fileName,
                            fileSize: up.fileSize,
                            mimeType: up.mimeType,
                            duration: up.duration ?? null,
                        },
                        { merge: true },
                    );
                }
            }

            onSaved();
            onClose();
        } catch (err) {
            console.error('Error guardando tool:', err);
            setError('Error guardando la herramienta. Revisa la consola.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 top-16 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[calc(100vh-88px)]">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h2 className="text-xl font-bold text-[#60356a]">
                        {editing ? 'Editar Herramienta' : 'Nueva Herramienta'}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <XCircle size={24} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto">
                    {/* Tabs */}
                    <div>
                        <label className="block text-sm font-semibold text-[#60356a] mb-2">Tipo</label>
                        <div className="grid grid-cols-5 gap-1.5">
                            {TYPE_TABS.map(({ type: t, label, icon: Icon }) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => {
                                        if (editing) return; // no cambiar tipo al editar
                                        setType(t);
                                        setFile(null);
                                        setProgress(0);
                                    }}
                                    disabled={!!editing}
                                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all ${
                                        type === t
                                            ? 'bg-[#60356a] text-white border-[#60356a]'
                                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-[#60356a]/40'
                                    } ${editing ? 'opacity-60 cursor-not-allowed' : ''}`}
                                >
                                    <Icon size={18} />
                                    <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
                                </button>
                            ))}
                        </div>
                        {editing && (
                            <p className="text-[10px] text-slate-400 mt-1">
                                No se puede cambiar el tipo al editar.
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-[#60356a] mb-1.5">Título</label>
                        <input
                            type="text"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#60356a]/20 focus:border-[#60356a] outline-none text-[#60356a]"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-[#60356a] mb-1.5">Descripción</label>
                        <textarea
                            rows={2}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#60356a]/20 outline-none resize-none text-slate-600"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-[#60356a] mb-1.5">Categoría</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#60356a]/20 outline-none text-slate-600"
                            >
                                {categoryOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-[#60356a] mb-1.5">Orden</label>
                            <input
                                type="number"
                                min={1}
                                value={order}
                                onChange={(e) => setOrder(Number(e.target.value))}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#60356a]/20 outline-none text-slate-600"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">
                                Menor número aparece primero
                            </p>
                        </div>
                    </div>

                    {/* Contenido dinámico según tipo */}
                    {type === 'script' ? (
                        <div>
                            <label className="block text-sm font-semibold text-[#60356a] mb-1.5">
                                Contenido (texto para copiar)
                            </label>
                            <textarea
                                required
                                rows={6}
                                value={scriptContent}
                                onChange={(e) => setScriptContent(e.target.value)}
                                placeholder="Pega aquí el prompt, plantilla de mensaje o script..."
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#60356a]/20 outline-none resize-y text-slate-700 font-mono text-sm"
                            />
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-semibold text-[#60356a] mb-1.5">
                                Archivo ({TOOL_MAX_MB[type as Exclude<ToolType, 'script'>]}MB máx)
                            </label>
                            <label className="flex items-center justify-center gap-2 py-6 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-[#60356a]/60 hover:bg-slate-50 transition">
                                <UploadCloud size={20} className="text-slate-400" />
                                <span className="text-sm text-slate-600">
                                    {file ? file.name : editing ? 'Reemplazar archivo' : 'Seleccionar archivo'}
                                </span>
                                <input
                                    type="file"
                                    accept={TOOL_ACCEPT[type as Exclude<ToolType, 'script'>]}
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                            </label>
                            {progress > 0 && progress < 100 && (
                                <div className="mt-2 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                    <div
                                        className="h-full bg-[#60356a] transition-all"
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    <label className="inline-flex items-center cursor-pointer gap-3">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={isActive}
                            onChange={(e) => setIsActive(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-slate-200 rounded-full peer-checked:bg-emerald-500 relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
                        <span className="text-sm font-medium text-slate-700">Activa y visible</span>
                    </label>

                    {error && (
                        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="px-5 py-2.5 bg-[#60356a] text-white font-medium hover:bg-[#834f8f] rounded-xl transition-all disabled:opacity-60 flex items-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>{progress > 0 && progress < 100 ? `Subiendo ${progress.toFixed(0)}%` : 'Guardando...'}</span>
                                </>
                            ) : (
                                <span>Guardar</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
