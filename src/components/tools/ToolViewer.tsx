'use client';

import { useEffect, useState } from 'react';
import { XCircle, Download, Copy, Check } from 'lucide-react';
import type { Tool } from '@/types';

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

    useEffect(() => {
        if (!tool) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [tool, onClose]);

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

    return (
        <div
            className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[80] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
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

                <div className="flex-1 overflow-auto bg-slate-50">
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
                        <object
                            data={tool.url}
                            type="application/pdf"
                            className="w-full h-[76vh] bg-white"
                        >
                            <div className="flex flex-col items-center justify-center p-10 text-center gap-3 bg-white">
                                <p className="text-slate-700 text-sm max-w-md">
                                    Tu navegador no puede previsualizar este PDF aquí. Ábrelo en una pestaña nueva o descárgalo.
                                </p>
                                <a
                                    href={tool.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#60356a] text-white text-sm font-bold rounded-xl hover:bg-[#834f8f] transition"
                                >
                                    Abrir en nueva pestaña
                                </a>
                            </div>
                        </object>
                    )}
                    {tool.type === 'script' && (
                        <pre className="p-5 text-sm text-slate-800 font-mono whitespace-pre-wrap break-words bg-white m-4 rounded-xl border border-slate-200 max-h-[76vh] overflow-auto">
                            {tool.url}
                        </pre>
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
