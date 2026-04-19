'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    collection,
    onSnapshot,
    orderBy,
    query,
    where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type { Tool, ToolFolder } from '@/types';
import FolderTile from '@/components/tools/FolderTile';
import ToolTile from '@/components/tools/ToolTile';
import ToolGrid from '@/components/tools/ToolGrid';
import ToolViewer from '@/components/tools/ToolViewer';
import { Wrench, Search, ArrowLeft, Home } from 'lucide-react';

interface NavState {
    level: 0 | 1 | 2;
    currentId: string | null;
    parentId: string | null;
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

export default function StudentToolsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [tools, setTools] = useState<Tool[]>([]);
    const [folders, setFolders] = useState<ToolFolder[]>([]);
    const [loading, setLoading] = useState(true);
    const [nav, setNav] = useState<NavState>(ROOT_NAV);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTool, setActiveTool] = useState<Tool | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/');
        } else if (!authLoading && user && user.role === 'admin') {
            router.push('/admin/tools');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (!user) return;
        const unsubTools = onSnapshot(
            query(
                collection(db, 'tools'),
                where('isActive', '==', true),
                orderBy('order', 'asc'),
            ),
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
            query(
                collection(db, 'tool_folders'),
                where('isActive', '==', true),
                orderBy('order', 'asc'),
            ),
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
    }, [user]);

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
            return {
                folders: folders.filter((f) => f.parentId === null),
                tools: tools.filter((t) => t.category === 'root'),
            };
        }
        const subfolders =
            nav.level === 1 ? folders.filter((f) => f.parentId === nav.currentId) : [];
        const folderTools = tools.filter((t) => t.category === `folder_${nav.currentId}`);
        return { folders: subfolders, tools: folderTools };
    }, [searchQuery, nav, tools, folders]);

    const countInFolder = (folderId: string): number => {
        const subCount = folders.filter((f) => f.parentId === folderId).length;
        const toolCount = tools.filter((t) => t.category === `folder_${folderId}`).length;
        return subCount + toolCount;
    };

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

    if (authLoading || !user) {
        return (
            <div className="flex items-center justify-center min-h-[100dvh]">
                <div className="w-10 h-10 border-4 border-[#60356a]/20 border-t-[#60356a] rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-[100dvh] bg-gradient-to-b from-surface to-slate-50 pt-20 sm:pt-24 pb-28 md:pb-16 px-4 md:pl-28 md:pr-8">
            <div className="max-w-6xl mx-auto space-y-5 animate-fade-in">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#f5a944] text-white flex items-center justify-center shadow-[0_4px_14px_rgba(245,169,68,0.3)]">
                        <Wrench size={22} />
                    </div>
                    <div>
                        <h2 className="text-xs text-[#60356a]/70 font-bold uppercase tracking-widest">Recursos</h2>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#60356a] leading-tight">Herramientas</h1>
                    </div>
                </div>

                {/* Breadcrumbs */}
                <div className="flex items-center gap-2 text-sm flex-wrap">
                    <button
                        onClick={() => setNav(ROOT_NAV)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-full transition ${
                            nav.level === 0
                                ? 'bg-[#60356a] text-white font-bold'
                                : 'bg-white border border-slate-200 text-slate-600 hover:text-[#60356a] hover:border-[#60356a]/40'
                        }`}
                    >
                        <Home size={14} />
                        <span>Inicio</span>
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
                        className="w-full pl-10 pr-4 py-2.5 bg-white/80 backdrop-blur-md border border-slate-200/80 rounded-xl focus:ring-4 focus:ring-[#60356a]/10 focus:border-[#60356a] text-sm text-[#60356a] placeholder:text-slate-400 outline-none shadow-sm"
                    />
                </div>

                {loadError && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800">
                        <p className="font-bold">No se pudieron cargar las herramientas.</p>
                        <p className="mt-1 text-red-700">
                            Código: <code className="bg-red-100 px-1.5 py-0.5 rounded text-xs">{loadError}</code>
                        </p>
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center items-center min-h-[300px]">
                        <div className="w-10 h-10 border-4 border-[#60356a]/20 border-t-[#60356a] rounded-full animate-spin" />
                    </div>
                ) : view.folders.length === 0 && view.tools.length === 0 ? (
                    <div className="p-12 sm:p-16 text-center text-slate-500 bg-white border border-slate-200 rounded-2xl shadow-sm">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                            <Wrench size={32} />
                        </div>
                        <h3 className="text-lg sm:text-xl font-semibold text-slate-900">
                            {searchQuery ? 'Sin resultados' : 'Aún no hay herramientas'}
                        </h3>
                        <p className="text-slate-500 mt-2 text-sm">
                            {searchQuery
                                ? 'Prueba con otros términos.'
                                : 'Vuelve pronto — tu equipo pronto publicará recursos aquí.'}
                        </p>
                    </div>
                ) : (
                    <ToolGrid>
                        {view.folders.map((f) => (
                            <FolderTile
                                key={f.id}
                                folder={f}
                                count={countInFolder(f.id)}
                                onOpen={openFolder}
                            />
                        ))}
                        {view.tools.map((t) => (
                            <ToolTile key={t.id} tool={t} onOpen={setActiveTool} />
                        ))}
                    </ToolGrid>
                )}
            </div>

            <ToolViewer tool={activeTool} onClose={() => setActiveTool(null)} />
        </div>
    );
}
