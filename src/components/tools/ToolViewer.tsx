'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { XCircle, Download, Copy, Check, Package, ShieldAlert } from 'lucide-react';
import type { Tool } from '@/types';

function formatFileSize(bytes?: number): string {
    if (!bytes || bytes <= 0) return '';
    const mb = bytes / (1024 * 1024);
    return mb < 1024 ? `${mb.toFixed(0)} MB` : `${(mb / 1024).toFixed(1)} GB`;
}

const PdfReader = dynamic(() => import('./PdfReader'), { ssr: false });

interface ToolViewerProps {
    tool: Tool | null;
    onClose: () => void;
}

function downloadFromUrl(url: string, fileName: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function downloadText(text: string, fileName: string) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    downloadFromUrl(url, fileName);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ToolViewer({ tool, onClose }: ToolViewerProps) {
    const [copied, setCopied] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const [pdfFullScreen, setPdfFullScreen] = useState(false);

    useEffect(() => {
        if (!tool) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [tool, onClose]);

    useEffect(() => {
        if (!tool || tool.type !== 'pdf') {
            setPdfFullScreen(false);
        }
    }, [tool]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 1800);
        return () => clearTimeout(t);
    }, [toast]);

    if (!tool) return null;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(tool.url);
            setCopied(true);
            setToast('Script copiado');
            setTimeout(() => setCopied(false), 1500);
        } catch {
            setToast('No se pudo copiar');
        }
    };

    const handleDownload = () => {
        if (tool.type === 'script') {
            downloadText(tool.url, `${tool.title || 'script'}.txt`);
        } else {
            downloadFromUrl(tool.url, tool.fileName || tool.title);
        }
    };

    const isPdf = tool.type === 'pdf';
    const pdfExpanded = isPdf && pdfFullScreen;

    return (
        <div
            className={`fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[80] flex items-center justify-center ${pdfExpanded ? 'p-0' : 'p-4'}`}
            onClick={onClose}
        >
            <div
                className={`bg-white shadow-2xl w-full overflow-hidden flex flex-col ${
                    pdfExpanded
                        ? 'max-w-none h-full max-h-none rounded-none'
                        : isPdf
                            ? 'max-w-6xl max-h-[96vh] h-[96vh] rounded-2xl'
                            : 'max-w-4xl max-h-[92vh] rounded-2xl'
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                {!isPdf && (
                <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="text-[#60356a] font-bold truncate">{tool.title}</h3>
                        {tool.description && (
                            <p className="text-slate-500 text-xs truncate">{tool.description}</p>
                        )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {tool.type === 'script' ? (
                            <button
                                onClick={handleCopy}
                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#60356a] text-white text-xs font-bold rounded-xl hover:bg-[#834f8f] transition"
                            >
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                {copied ? 'Copiado' : 'Copiar'}
                            </button>
                        ) : null}
                        <button
                            onClick={handleDownload}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#f5a944] text-white text-xs font-bold rounded-xl hover:bg-[#f5a944]/90 transition"
                        >
                            <Download size={14} />
                            Descargar
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg"
                            title="Cerrar"
                        >
                            <XCircle size={22} />
                        </button>
                    </div>
                </div>
                )}

                <div className={`flex-1 overflow-auto ${isPdf ? '' : 'bg-slate-50'}`}>
                    {tool.type === 'video' && (
                        <div className="flex items-center justify-center p-2 bg-black">
                            <video
                                src={tool.url}
                                controls
                                autoPlay
                                className="max-h-[70vh] w-full"
                            />
                        </div>
                    )}
                    {tool.type === 'audio' && (
                        <div className="flex items-center justify-center py-12 px-6">
                            <audio src={tool.url} controls autoPlay className="w-full max-w-xl" />
                        </div>
                    )}
                    {tool.type === 'image' && (
                        <div className="flex items-center justify-center p-4">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={tool.url}
                                alt={tool.title}
                                className="max-h-[76vh] max-w-full object-contain"
                            />
                        </div>
                    )}
                    {tool.type === 'pdf' && (
                        <PdfReader
                            url={tool.url}
                            title={tool.title}
                            onDownload={handleDownload}
                            onClose={onClose}
                            isFullScreen={pdfFullScreen}
                            onToggleFullScreen={() => setPdfFullScreen((v) => !v)}
                        />
                    )}
                    {tool.type === 'script' && (
                        <pre className="p-5 text-sm text-slate-800 font-mono whitespace-pre-wrap break-words bg-white m-4 rounded-xl border border-slate-200 max-h-[76vh] overflow-auto">
                            {tool.url}
                        </pre>
                    )}
                    {tool.type === 'exe' && (
                        <div className="flex flex-col items-center justify-center text-center px-6 py-10 sm:py-14 gap-5">
                            <div className="w-20 h-20 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center shadow-sm">
                                <Package size={42} />
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-xs font-bold uppercase tracking-wider text-sky-700">
                                    Instalador para Windows
                                </p>
                                {tool.fileSize ? (
                                    <p className="text-2xl font-bold text-[#60356a]">
                                        {formatFileSize(tool.fileSize)}
                                    </p>
                                ) : null}
                                {tool.fileName ? (
                                    <p className="text-xs text-slate-500 font-mono break-all">
                                        {tool.fileName}
                                    </p>
                                ) : null}
                            </div>

                            <button
                                onClick={handleDownload}
                                className="inline-flex items-center gap-2 px-6 py-3 bg-[#f5a944] text-white font-bold rounded-xl hover:bg-[#f5a944]/90 transition shadow-[0_4px_14px_rgba(245,169,68,0.35)] active:scale-95"
                            >
                                <Download size={18} />
                                Descargar instalador
                            </button>

                            <div className="max-w-md w-full text-left bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                                <ShieldAlert
                                    size={20}
                                    className="text-amber-600 shrink-0 mt-0.5"
                                />
                                <div className="space-y-1.5 text-sm">
                                    <p className="font-bold text-amber-900">
                                        Aviso de SmartScreen en Windows
                                    </p>
                                    <p className="text-amber-800 leading-relaxed">
                                        Al abrir el instalador, Windows puede mostrar
                                        {' '}
                                        <strong>&ldquo;Windows protegió tu PC&rdquo;</strong>.
                                        Haz click en
                                        {' '}
                                        <strong>Más información</strong>
                                        {' '}→{' '}
                                        <strong>Ejecutar de todas formas</strong>
                                        {' '}
                                        para continuar. Es un aviso normal en instaladores
                                        sin firma comercial.
                                    </p>
                                </div>
                            </div>

                            <p className="text-[11px] text-slate-400 max-w-md">
                                Mantén tu conexión estable mientras descarga. Si se interrumpe,
                                puedes volver a iniciar la descarga sin problema.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {toast && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#60356a] text-white text-sm px-4 py-2 rounded-full shadow-lg z-[90]">
                    {toast}
                </div>
            )}
        </div>
    );
}
