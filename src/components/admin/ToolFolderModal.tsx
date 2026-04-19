'use client';

import { useEffect, useState } from 'react';
import {
    addDoc,
    collection,
    doc,
    setDoc,
    Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type { ToolFolder } from '@/types';
import { XCircle } from 'lucide-react';

interface ToolFolderModalProps {
    open: boolean;
    onClose: () => void;
    parentId: string | null;
    editing?: ToolFolder | null;
    onSaved: () => void;
    siblingFolders?: ToolFolder[];
}

export default function ToolFolderModal({
    open,
    onClose,
    parentId,
    editing,
    onSaved,
    siblingFolders = [],
}: ToolFolderModalProps) {
    const { user } = useAuth();
    const [name, setName] = useState('');
    const [icon, setIcon] = useState('📁');
    const [order, setOrder] = useState(1);
    const [isActive, setIsActive] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        if (editing) {
            setName(editing.name);
            setIcon(editing.icon || '📁');
            setOrder(editing.order || 1);
            setIsActive(editing.isActive);
        } else {
            const peers = siblingFolders.filter((f) => f.parentId === parentId);
            const nextOrder = peers.length
                ? Math.max(...peers.map((f) => f.order || 0)) + 1
                : 1;
            setName('');
            setIcon('📁');
            setOrder(nextOrder);
            setIsActive(true);
        }
    }, [open, editing, parentId, siblingFolders]);

    if (!open) return null;

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        const trimmed = name.trim();
        if (!trimmed) return;

        setSaving(true);
        try {
            const payload = {
                name: trimmed.slice(0, 50),
                icon: icon || '📁',
                parentId,
                order,
                isActive,
                updatedAt: Timestamp.now(),
                updatedBy: user.uid,
            };

            if (editing) {
                await setDoc(doc(db, 'tool_folders', editing.id), payload, { merge: true });
            } else {
                await addDoc(collection(db, 'tool_folders'), {
                    ...payload,
                    createdAt: Timestamp.now(),
                    createdBy: user.uid,
                });
            }
            onSaved();
            onClose();
        } catch (err) {
            console.error('Error guardando carpeta:', err);
            alert('Error guardando la carpeta');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 top-16 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[calc(100vh-88px)]">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h2 className="text-xl font-bold text-[#60356a]">
                        {editing ? 'Editar Carpeta' : 'Nueva Carpeta'}
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <XCircle size={24} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto">
                    <div>
                        <label className="block text-sm font-semibold text-[#60356a] mb-1.5">
                            Nombre
                        </label>
                        <input
                            type="text"
                            required
                            maxLength={50}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ej: Plantillas de Ventas"
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#60356a]/20 focus:border-[#60356a] outline-none text-[#60356a]"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                            {name.length}/50 caracteres
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-[#60356a] mb-1.5">
                                Icono (emoji)
                            </label>
                            <input
                                type="text"
                                value={icon}
                                onChange={(e) => setIcon(e.target.value)}
                                maxLength={4}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#60356a]/20 outline-none text-center text-xl"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-[#60356a] mb-1.5">
                                Orden
                            </label>
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

                    <label className="inline-flex items-center cursor-pointer gap-3">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={isActive}
                            onChange={(e) => setIsActive(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-slate-200 rounded-full peer-checked:bg-emerald-500 relative after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
                        <span className="text-sm font-medium text-slate-700">Carpeta visible</span>
                    </label>

                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving || !name.trim()}
                            className="px-5 py-2.5 bg-[#60356a] text-white font-medium hover:bg-[#834f8f] rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Guardando...</span>
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
