'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    collection,
    onSnapshot,
    orderBy,
    query,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Tool, ToolFolder } from '@/types';
import AdminPageHeader from '@/components/AdminPageHeader';
import FolderTile from '@/components/tools/FolderTile';
import ToolTile from '@/components/tools/ToolTile';
import ToolGrid from '@/components/tools/ToolGrid';
import ToolFolderModal from '@/components/admin/ToolFolderModal';
import ToolFormModal from '@/components/admin/ToolFormModal';
import { countCascade, deleteFolderCascade, deleteTool } from '@/lib/tool-upload';
import {
    Wrench,
    Plus,
    FolderPlus,
    Search,
    ArrowLeft,
    Home,
    XCircle,
} from 'lucide-react';

interface NavState {
    level: 0 | 1 | 2;
    currentId: string | null; // folder id en nivel 1/2; null en nivel 0
    parentId: string | null;  // folder padre cuando estamos en nivel 2
    currentLabel: string | null;
    parentLabel: string | null;
}

const ROOT_NAV: NavState = {
    level: 0,
    currentId: null,
    parentId: null,
    currentLabel: null,
    parentLabel: null,
};

export default function AdminToolsPage() {
    const [tools, setTools] = useState<Tool[]>([]);
    const [folders, setFolders] = useState<ToolFolder[]>([]);
    const [loading, setLoading] = useState(true);
    const [nav, setNav] = useState<NavState>(ROOT_NAV);
    const [searchQuery, setSearchQuery] = useState('');

    const [folderModalOpen, setFolderModalOpen] = useState(false);
    const [editingFolder, setEditingFolder] = useState<ToolFolder | null>(null);

    const [toolModalOpen, setToolModalOpen] = useState(false);
    const [editingTool, setEditingTool] = useState<Tool | null>(null);

    const [deleteConfirm, setDeleteConfirm] = useState<
        | { kind: 'tool'; tool: Tool }
        | { kind: 'folder'; folder: ToolFolder; count: { folders: number; tools: number } }
        | null
    >(null);
    const [deleting, setDeleting] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        const unsubTools = onSnapshot(
            query(collection(db, 'tools'), orderBy('order', 'asc')),
            (snap) => {
                setTools(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Tool)));
                setLoading(false);
                setLoadError(null);
            },
            (err) => {
                console.error('tools snapshot error:', err);
                setLoadError(err.code || err.message || 'Error leyendo herramientas');
                setLoading(false);
            },
        );
        const unsubFolders = onSnapshot(
            query(collection(db, 'tool_folders'), orderBy('order', 'asc')),
            (snap) => {
                setFolders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ToolFolder)));
            },
            (err) => {
                console.error('tool_folders snapshot error:', err);
                setLoadError(err.code || err.message || 'Error leyendo carpetas');
            },
        );
        return () => {
            unsubTools();
            unsubFolders();
        };
    }, []);

    // Derivar vista actual
    const view = useMemo(() => {
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchTools = tools.filter(
                (t) =>
                    t.title.toLowerCase().includes(q) ||
                    (t.description || '').toLowerCase().includes(q),
            );
            return { folders: [] as ToolFolder[], tools: matchTools };
        }

        if (nav.level === 0) {
            const roots = folders.filter((f) => f.parentId === null);
            return { folders: roots, tools: tools.filter((t) => t.category === 'root') };
        }

        // nivel 1 o 2: mostrar subcarpetas (solo nivel 1) + tools de este folder
        const subfolders =
            nav.level === 1
                ? folders.filter((f) => f.parentId === nav.currentId)
                : [];
        const folderTools = tools.filter(
            (t) => t.category === `folder_${nav.currentId}`,
        );
        return { folders: subfolders, tools: folderTools };
    }, [searchQuery, nav, tools, folders]);

    const countInFolder = (folderId: string): number => {
        const subCount = folders.filter((f) => f.parentId === folderId).length;
        const toolCount = tools.filter((t) => t.category === `folder_${folderId}`).length;
        return subCount + toolCount;
    };

    const countAtRoot = (): number => tools.filter((t) => t.category === 'root').length;

    const openFolder = (folderId: string) => {
        const folder = folders.find((f) => f.id === folderId);
        if (!folder) return;
        if (nav.level === 0) {
            setNav({
                level: 1,
                currentId: folder.id,
                parentId: null,
                currentLabel: folder.name,
                parentLabel: null,
            });
        } else if (nav.level === 1) {
            setNav({
                level: 2,
                currentId: folder.id,
                parentId: nav.currentId,
                currentLabel: folder.name,
                parentLabel: nav.currentLabel,
            });
        }
    };

    const goBack = () => {
        if (nav.level === 2 && nav.parentId) {
            setNav({
                level: 1,
                currentId: nav.parentId,
                parentId: null,
                currentLabel: nav.parentLabel,
                parentLabel: null,
            });
        } else {
            setNav(ROOT_NAV);
        }
    };

    const handleDeleteTool = async () => {
        if (!deleteConfirm || deleteConfirm.kind !== 'tool') return;
        setDeleting(true);
        try {
            await deleteTool(deleteConfirm.tool.id);
            setDeleteConfirm(null);
        } catch (err) {
            console.error(err);
            alert('Error eliminando la herramienta');
        } finally {
            setDeleting(false);
        }
    };

    const handleDeleteFolder = async () => {
        if (!deleteConfirm || deleteConfirm.kind !== 'folder') return;
        setDeleting(true);
        try {
            await deleteFolderCascade(deleteConfirm.folder.id);
            setDeleteConfirm(null);
            // Si estábamos dentro del folder borrado, volver a raíz
            if (nav.currentId === deleteConfirm.folder.id || nav.parentId === deleteConfirm.folder.id) {
                setNav(ROOT_NAV);
            }
        } catch (err) {
            console.error(err);
            alert('Error eliminando la carpeta');
        } finally {
            setDeleting(false);
        }
    };

    const requestDeleteFolder = async (folder: ToolFolder) => {
        const count = await countCascade(folder.id);
        setDeleteConfirm({ kind: 'folder', folder, count });
    };

    // Smart default para categoría al crear tool
    const defaultCategory = nav.level === 0 ? 'root' : `folder_${nav.currentId}`;

    // Parent id para nueva subcarpeta
    const canCreateFolder = nav.level <= 1; // nivel 0 o 1
    const folderParentId = nav.level === 0 ? null : nav.currentId;

    return (
        <div className="space-y-6 lg:space-y-8 animate-fade-in pb-12">
            <AdminPageHeader
                title="Herramientas"
                subtitle="Recursos centrales para todos los alumnos"
                icon={<Wrench size={20} />}
                action={
                    <div className="flex items-center gap-2">
                        {canCreateFolder && (
                            <button
                                onClick={() => {
                                    setEditingFolder(null);
                                    setFolderModalOpen(true);
                                }}
                                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#60356a]/20 text-[#60356a] font-semibold hover:bg-[#60356a]/5 rounded-xl text-xs sm:text-sm sm:px-4 sm:py-2.5 transition-all active:scale-95"
                            >
                                <FolderPlus size={16} strokeWidth={2.5} />
                                <span className="hidden sm:inline">Nueva Carpeta</span>
                            </button>
                        )}
                        <button
                            onClick={() => {
                                setEditingTool(null);
                                setToolModalOpen(true);
                            }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-[#f5a944] text-white font-semibold hover:bg-[#f5a944]/90 rounded-xl text-xs sm:text-sm sm:px-4 sm:py-2.5 transition-all shadow-[0_2px_8px_rgba(245,169,68,0.3)] active:scale-95"
                        >
                            <Plus size={16} strokeWidth={2.5} />
                            <span className="hidden sm:inline">Nueva Herramienta</span>
                            <span className="sm:hidden">Nueva</span>
                        </button>
                    </div>
                }
            />

            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-sm">
                <button
                    onClick={() => setNav(ROOT_NAV)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full transition ${
                        nav.level === 0
                            ? 'bg-[#60356a] text-white font-bold'
                            : 'bg-white border border-slate-200 text-slate-600 hover:text-[#60356a] hover:border-[#60356a]/40'
                    }`}
                >
                    <Home size={14} />
                    <span>Raíz</span>
                </button>
                {nav.level >= 1 && (
                    <>
                        <span className="text-slate-300">/</span>
                        <button
                            onClick={() =>
                                nav.level === 2 && nav.parentId
                                    ? setNav({
                                          level: 1,
                                          currentId: nav.parentId,
                                          parentId: null,
                                          currentLabel: nav.parentLabel,
                                          parentLabel: null,
                                      })
                                    : null
                            }
                            className={`px-3 py-1.5 rounded-full ${
                                nav.level === 1
                                    ? 'bg-[#60356a] text-white font-bold'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:text-[#60356a]'
                            }`}
                        >
                            {nav.level === 2 ? nav.parentLabel : nav.currentLabel}
                        </button>
                    </>
                )}
                {nav.level === 2 && (
                    <>
                        <span className="text-slate-300">/</span>
                        <span className="px-3 py-1.5 rounded-full bg-[#60356a] text-white font-bold">
                            {nav.currentLabel}
                        </span>
                    </>
                )}
                {nav.level > 0 && (
                    <button
                        onClick={goBack}
                        className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-full text-slate-500 hover:text-[#60356a] hover:bg-slate-100"
                    >
                        <ArrowLeft size={14} /> Volver
                    </button>
                )}
            </div>

            {/* Search */}
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Search size={16} className="text-slate-400" />
                </div>
                <input
                    type="text"
                    placeholder="Buscar herramientas..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white/70 backdrop-blur-md border border-slate-200/80 rounded-xl focus:ring-4 focus:ring-[#60356a]/10 focus:border-[#60356a] text-sm text-[#60356a] placeholder:text-slate-400 outline-none shadow-sm"
                />
            </div>

            {/* Load error banner */}
            {loadError && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
                    <p className="font-bold">No se pudieron cargar las herramientas.</p>
                    <p className="mt-1 text-red-700">
                        Código: <code className="bg-red-100 px-1.5 py-0.5 rounded text-xs">{loadError}</code>
                    </p>
                    <p className="mt-2 text-red-700">
                        Si es <code>permission-denied</code>, despliega las reglas de Firestore con:
                        {' '}
                        <code className="bg-red-100 px-1.5 py-0.5 rounded text-xs">firebase deploy --only firestore:rules,storage</code>
                    </p>
                </div>
            )}

            {/* Loading */}
            {loading ? (
                <div className="flex justify-center items-center min-h-[300px]">
                    <div className="w-10 h-10 border-4 border-[#60356a]/20 border-t-[#60356a] rounded-full animate-spin" />
                </div>
            ) : view.folders.length === 0 && view.tools.length === 0 ? (
                <div className="p-16 text-center text-slate-500 bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-5 text-slate-300">
                        <Wrench size={40} />
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900">
                        {searchQuery ? 'Sin resultados' : 'Aún no hay herramientas aquí'}
                    </h3>
                    <p className="text-slate-500 mt-2 text-sm">
                        {searchQuery
                            ? 'Prueba con otros términos.'
                            : 'Crea una carpeta o una herramienta para empezar.'}
                    </p>
                </div>
            ) : (
                <ToolGrid>
                    {view.folders.map((f) => (
                        <FolderTile
                            key={f.id}
                            folder={f}
                            count={countInFolder(f.id)}
                            canEdit
                            onOpen={openFolder}
                            onEdit={(folder) => {
                                setEditingFolder(folder);
                                setFolderModalOpen(true);
                            }}
                            onDelete={requestDeleteFolder}
                        />
                    ))}
                    {view.tools.map((t) => (
                        <ToolTile
                            key={t.id}
                            tool={t}
                            canEdit
                            onOpen={(tool) => {
                                setEditingTool(tool);
                                setToolModalOpen(true);
                            }}
                            onEdit={(tool) => {
                                setEditingTool(tool);
                                setToolModalOpen(true);
                            }}
                            onDelete={(tool) => setDeleteConfirm({ kind: 'tool', tool })}
                        />
                    ))}
                </ToolGrid>
            )}

            {/* Modales */}
            <ToolFolderModal
                open={folderModalOpen}
                onClose={() => setFolderModalOpen(false)}
                parentId={editingFolder ? editingFolder.parentId : folderParentId}
                editing={editingFolder}
                onSaved={() => {}}
                siblingFolders={folders}
            />
            <ToolFormModal
                open={toolModalOpen}
                onClose={() => setToolModalOpen(false)}
                folders={folders}
                defaultCategory={defaultCategory}
                editing={editingTool}
                onSaved={() => {}}
                siblingTools={tools}
            />

            {/* Confirm delete */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-red-600">Confirmar eliminación</h2>
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <XCircle size={22} />
                            </button>
                        </div>
                        <div className="p-6 space-y-3 text-slate-600 text-sm">
                            {deleteConfirm.kind === 'tool' ? (
                                <p>
                                    Se eliminará la herramienta <strong>&ldquo;{deleteConfirm.tool.title}&rdquo;</strong>
                                    {deleteConfirm.tool.type !== 'script' && ' y su archivo asociado'}. Esta acción no se puede deshacer.
                                </p>
                            ) : (
                                <>
                                    <p>
                                        Se eliminará la carpeta <strong>&ldquo;{deleteConfirm.folder.name}&rdquo;</strong> y todo su contenido:
                                    </p>
                                    <ul className="list-disc list-inside text-xs text-slate-500">
                                        <li>
                                            {deleteConfirm.count.folders}{' '}
                                            {deleteConfirm.count.folders === 1 ? 'carpeta' : 'carpetas'} (incluyendo esta)
                                        </li>
                                        <li>
                                            {deleteConfirm.count.tools}{' '}
                                            {deleteConfirm.count.tools === 1 ? 'herramienta' : 'herramientas'} y sus archivos
                                        </li>
                                    </ul>
                                    <p className="text-red-600 text-xs">Esta acción no se puede deshacer.</p>
                                </>
                            )}
                        </div>
                        <div className="px-6 py-4 bg-slate-50 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                disabled={deleting}
                                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-xl"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={
                                    deleteConfirm.kind === 'tool' ? handleDeleteTool : handleDeleteFolder
                                }
                                disabled={deleting}
                                className="px-4 py-2 bg-red-600 text-white font-medium hover:bg-red-700 rounded-xl disabled:opacity-60 flex items-center gap-2"
                            >
                                {deleting && (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                )}
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
