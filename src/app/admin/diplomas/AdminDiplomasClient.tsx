'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { GraduationCap, Search, Download, Inbox } from 'lucide-react';
import AdminPageHeader from '@/components/AdminPageHeader';

export interface DiplomaRow {
    id: string;
    userId: string;
    userName: string;
    email: string;
    photoURL?: string;
    issuedAt: number | null;
    score: number;
    verificationCode: string;
    pathTitle: string;
}

interface Props {
    rows: DiplomaRow[];
}

function formatDate(ms: number | null): string {
    if (!ms) return '—';
    return new Date(ms).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

export default function AdminDiplomasClient({ rows }: Props) {
    const [q, setQ] = useState('');
    const [notice, setNotice] = useState<string>('');

    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        if (!term) return rows;
        return rows.filter(r =>
            r.userName.toLowerCase().includes(term) ||
            r.email.toLowerCase().includes(term) ||
            r.verificationCode.toLowerCase().includes(term)
        );
    }, [rows, q]);

    const handleDownload = (row: DiplomaRow) => {
        setNotice(`Diseño del diploma pendiente. Disponible cuando se reciba el modelo oficial de Urbanity Academy. (Código ${row.verificationCode})`);
        window.setTimeout(() => setNotice(''), 4000);
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <AdminPageHeader
                title="Diplomas Élite"
                subtitle="Analítica · Asesores certificados"
                icon={<GraduationCap size={22} />}
            />

            {/* Search */}
            <div className="relative max-w-sm mb-5">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                    type="text"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar por nombre, email o código..."
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-full text-sm bg-white outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 shadow-sm"
                />
            </div>

            {notice && (
                <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-semibold">
                    {notice}
                </div>
            )}

            {/* Summary */}
            <div className="mb-6 flex items-center gap-2 text-sm text-slate-600">
                <span className="font-bold text-slate-900 text-base">{filtered.length}</span>
                <span>{filtered.length === 1 ? 'asesor certificado' : 'asesores certificados'}</span>
                {q && <span className="text-slate-400">(filtrado de {rows.length})</span>}
            </div>

            {filtered.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
                    <Inbox size={40} className="mx-auto text-slate-300 mb-3" />
                    <h3 className="text-slate-700 font-bold mb-1">
                        {rows.length === 0 ? 'Aún no hay asesores certificados' : 'Sin resultados'}
                    </h3>
                    <p className="text-sm text-slate-500">
                        {rows.length === 0
                            ? 'Cuando un asesor complete la Ruta Élite (checklist 4/4 y puntaje ≥ 80%) aparecerá aquí automáticamente.'
                            : 'Prueba con otro nombre, email o código de verificación.'}
                    </p>
                </div>
            ) : (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left px-5 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Asesor</th>
                                    <th className="text-left px-5 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Fecha de culminación</th>
                                    <th className="text-left px-5 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Puntaje</th>
                                    <th className="text-left px-5 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Código</th>
                                    <th className="text-right px-5 py-3 font-bold text-slate-600 text-xs uppercase tracking-wider">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(row => {
                                    const initial = row.userName?.charAt(0).toUpperCase() || '?';
                                    return (
                                        <tr key={row.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full overflow-hidden relative border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: '#D4AF37' }}>
                                                        {row.photoURL ? (
                                                            <Image src={row.photoURL} alt={row.userName} fill className="object-cover" sizes="40px" />
                                                        ) : (
                                                            <span className="font-bold text-slate-600 bg-slate-100 w-full h-full flex items-center justify-center">{initial}</span>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-slate-900 truncate">{row.userName}</p>
                                                        <p className="text-xs text-slate-500 truncate">{row.email || '—'}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-slate-700 whitespace-nowrap">{formatDate(row.issuedAt)}</td>
                                            <td className="px-5 py-4">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700">
                                                    {row.score}%
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 font-mono text-xs text-slate-500">{row.verificationCode}</td>
                                            <td className="px-5 py-4 text-right">
                                                <button
                                                    onClick={() => handleDownload(row)}
                                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#D4AF37] hover:bg-[#B8941F] text-white text-xs font-bold transition shadow-sm"
                                                    title="Descargar diploma en PDF"
                                                >
                                                    <Download size={14} />
                                                    Descargar PDF
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
