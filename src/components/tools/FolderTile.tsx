'use client';

import { Folder, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { ToolFolder } from '@/types';

interface FolderTileProps {
    folder: ToolFolder;
    count: number;
    canEdit?: boolean;
    onOpen: (folderId: string) => void;
    onEdit?: (folder: ToolFolder) => void;
    onDelete?: (folder: ToolFolder) => void;
}

export default function FolderTile({
    folder,
    count,
    canEdit = false,
    onOpen,
    onEdit,
    onDelete,
}: FolderTileProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menuOpen) return;
        const handler = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuOpen]);

    return (
        <div
            onClick={() => onOpen(folder.id)}
            className="group relative bg-white rounded-2xl overflow-hidden shadow-[0_4px_14px_rgba(17,28,45,0.05)] border border-slate-100 hover:shadow-[0_8px_24px_rgba(96,53,106,0.12)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex flex-col"
        >
            <div className="relative aspect-[4/3] bg-[#f5a944]/10 flex items-center justify-center">
                {folder.icon ? (
                    <span className="text-6xl leading-none">{folder.icon}</span>
                ) : (
                    <Folder size={56} className="text-[#f5a944]" />
                )}
            </div>
            <div className="p-3">
                <h4 className="text-[#60356a] font-bold text-sm leading-tight line-clamp-2 mb-0.5">
                    {folder.name}
                </h4>
                <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wide">
                    {count} {count === 1 ? 'elemento' : 'elementos'}
                </p>
            </div>

            {canEdit && (
                <div ref={menuRef} className="absolute top-2 right-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpen((v) => !v);
                        }}
                        className="p-1.5 text-slate-400 hover:text-[#60356a] hover:bg-slate-100 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Opciones"
                    >
                        <MoreVertical size={16} />
                    </button>
                    {menuOpen && (
                        <div className="absolute right-0 top-8 w-36 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-20 animate-fade-in">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpen(false);
                                    onEdit?.(folder);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 text-left"
                            >
                                <Edit2 size={14} /> Editar
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpen(false);
                                    onDelete?.(folder);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 text-left"
                            >
                                <Trash2 size={14} /> Eliminar
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
