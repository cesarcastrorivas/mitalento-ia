'use client';

import {
    Play,
    Volume2,
    Image as ImageIcon,
    FileText,
    ClipboardCopy,
    MoreVertical,
    Edit2,
    Trash2,
    Package,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { Tool, ToolType } from '@/types';

interface ToolTileProps {
    tool: Tool;
    canEdit?: boolean;
    onOpen: (tool: Tool) => void;
    onEdit?: (tool: Tool) => void;
    onDelete?: (tool: Tool) => void;
}

const TYPE_META: Record<ToolType, { icon: React.ComponentType<{ size?: number }>; label: string; color: string; bg: string }> = {
    video:  { icon: Play,          label: 'Video',      color: 'text-rose-600',    bg: 'bg-rose-50' },
    audio:  { icon: Volume2,       label: 'Audio',      color: 'text-indigo-600',  bg: 'bg-indigo-50' },
    image:  { icon: ImageIcon,     label: 'Imagen',     color: 'text-emerald-600', bg: 'bg-emerald-50' },
    pdf:    { icon: FileText,      label: 'PDF',        color: 'text-amber-600',   bg: 'bg-amber-50' },
    script: { icon: ClipboardCopy, label: 'Script',     color: 'text-[#60356a]',   bg: 'bg-[#60356a]/10' },
    exe:    { icon: Package,       label: 'Instalador', color: 'text-sky-700',     bg: 'bg-sky-50' },
};

export default function ToolTile({ tool, canEdit = false, onOpen, onEdit, onDelete }: ToolTileProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const meta = TYPE_META[tool.type];
    const Icon = meta.icon;

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

    const preview = (tool.type === 'image' && (tool.thumbnailUrl || tool.url));

    return (
        <div
            onClick={() => onOpen(tool)}
            className="group relative bg-white rounded-2xl overflow-hidden shadow-[0_4px_14px_rgba(17,28,45,0.05)] border border-slate-100 hover:shadow-[0_8px_24px_rgba(96,53,106,0.12)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex flex-col"
        >
            <div className={`relative aspect-[4/3] ${meta.bg} flex items-center justify-center`}>
                {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={preview}
                        alt={tool.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                    />
                ) : (
                    <Icon size={42} />
                )}
                <span className={`absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-white/90 ${meta.color} shadow-sm`}>
                    <Icon size={10} /> {meta.label}
                </span>
            </div>
            <div className="p-3">
                <h4 className="text-[#60356a] font-bold text-sm leading-tight line-clamp-2 mb-1">
                    {tool.title}
                </h4>
                {tool.description && (
                    <p className="text-slate-500 text-xs leading-snug line-clamp-2">
                        {tool.description}
                    </p>
                )}
            </div>

            {canEdit && (
                <div ref={menuRef} className="absolute top-2 right-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpen((v) => !v);
                        }}
                        className="p-1.5 text-slate-500 bg-white/90 hover:text-[#60356a] rounded-lg shadow-sm transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
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
                                    onEdit?.(tool);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 text-left"
                            >
                                <Edit2 size={14} /> Editar
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuOpen(false);
                                    onDelete?.(tool);
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
