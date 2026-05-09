'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import {
    Download,
    XCircle,
    ChevronLeft,
    ChevronRight,
    ZoomIn,
    ZoomOut,
    Maximize2,
    Minimize2,
    Loader2,
} from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface PdfReaderProps {
    url: string;
    title: string;
    onDownload: () => void;
    onClose: () => void;
    isFullScreen: boolean;
    onToggleFullScreen: () => void;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
const SCALE_STEP = 0.2;

export default function PdfReader({
    url,
    title,
    onDownload,
    onClose,
    isFullScreen,
    onToggleFullScreen,
}: PdfReaderProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [scale, setScale] = useState<number>(1);
    const [loadError, setLoadError] = useState<boolean>(false);
    const [pageWidth, setPageWidth] = useState<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const fileObject = useMemo(() => ({ url }), [url]);

    useEffect(() => {
        const measure = () => {
            if (!containerRef.current) return;
            const w = containerRef.current.clientWidth;
            setPageWidth(Math.min(w - 32, 900));
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [isFullScreen]);

    const goPrev = useCallback(() => {
        setPageNumber((p) => Math.max(1, p - 1));
    }, []);

    const goNext = useCallback(() => {
        setPageNumber((p) => Math.min(numPages || p, p + 1));
    }, [numPages]);

    const zoomIn = useCallback(() => {
        setScale((s) => Math.min(MAX_SCALE, +(s + SCALE_STEP).toFixed(2)));
    }, []);

    const zoomOut = useCallback(() => {
        setScale((s) => Math.max(MIN_SCALE, +(s - SCALE_STEP).toFixed(2)));
    }, []);

    const resetZoom = useCallback(() => setScale(1), []);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                goPrev();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                goNext();
            } else if (e.key === '+' || (e.key === '=' && e.shiftKey)) {
                e.preventDefault();
                zoomIn();
            } else if (e.key === '-') {
                e.preventDefault();
                zoomOut();
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [goPrev, goNext, zoomIn, zoomOut]);

    const onDocumentLoadSuccess = ({ numPages: n }: { numPages: number }) => {
        setNumPages(n);
        setLoadError(false);
    };

    const onDocumentLoadError = (err: Error) => {
        console.error('PdfReader load error:', err);
        setLoadError(true);
    };

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-white sticky top-0 z-10">
                <div className="min-w-0 flex-1">
                    <h3 className="text-[#60356a] font-bold truncate text-sm sm:text-base">{title}</h3>
                    {numPages > 0 && (
                        <p className="text-slate-500 text-xs">
                            Página {pageNumber} de {numPages}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    <div className="hidden sm:flex items-center gap-1 bg-slate-50 rounded-lg p-1">
                        <button
                            onClick={zoomOut}
                            disabled={scale <= MIN_SCALE}
                            className="p-1.5 text-slate-600 hover:text-[#60356a] disabled:opacity-30 disabled:cursor-not-allowed rounded-md hover:bg-white transition"
                            title="Reducir zoom (-)"
                        >
                            <ZoomOut size={16} />
                        </button>
                        <button
                            onClick={resetZoom}
                            className="px-2 py-1 text-xs font-bold text-slate-600 hover:text-[#60356a] min-w-[44px]"
                            title="Restablecer zoom"
                        >
                            {Math.round(scale * 100)}%
                        </button>
                        <button
                            onClick={zoomIn}
                            disabled={scale >= MAX_SCALE}
                            className="p-1.5 text-slate-600 hover:text-[#60356a] disabled:opacity-30 disabled:cursor-not-allowed rounded-md hover:bg-white transition"
                            title="Aumentar zoom (+)"
                        >
                            <ZoomIn size={16} />
                        </button>
                    </div>
                    <button
                        onClick={onToggleFullScreen}
                        className="hidden sm:inline-flex p-2 text-slate-500 hover:text-[#60356a] hover:bg-slate-50 rounded-lg transition"
                        title={isFullScreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                    >
                        {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                    <button
                        onClick={onDownload}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#f5a944] text-white text-xs font-bold rounded-xl hover:bg-[#f5a944]/90 transition"
                    >
                        <Download size={14} />
                        <span className="hidden sm:inline">Descargar</span>
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

            <div
                ref={containerRef}
                className="flex-1 overflow-auto bg-slate-100 px-2 sm:px-4 py-4 flex flex-col items-center"
            >
                {loadError ? (
                    <div className="w-full flex-1 flex flex-col -mx-2 sm:-mx-4 -my-4">
                        <iframe
                            src={url}
                            title={title}
                            className="w-full flex-1 min-h-[70vh] bg-white border-0"
                        />
                        <p className="text-center text-[11px] text-slate-400 py-2 bg-slate-50">
                            Visor alternativo del navegador.
                        </p>
                    </div>
                ) : (
                    <Document
                        file={fileObject}
                        onLoadSuccess={onDocumentLoadSuccess}
                        onLoadError={onDocumentLoadError}
                        loading={
                            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
                                <Loader2 size={28} className="animate-spin text-[#60356a]" />
                                <p className="text-sm">Cargando PDF…</p>
                            </div>
                        }
                        error={
                            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500 text-sm">
                                Error al cargar el documento.
                            </div>
                        }
                    >
                        {pageWidth > 0 && (
                            <Page
                                pageNumber={pageNumber}
                                width={pageWidth * scale}
                                renderTextLayer={false}
                                renderAnnotationLayer={false}
                                className="shadow-lg rounded-md overflow-hidden bg-white"
                                loading={
                                    <div className="flex items-center justify-center py-20 text-slate-400 text-sm">
                                        Renderizando página…
                                    </div>
                                }
                            />
                        )}
                    </Document>
                )}
            </div>

            {numPages > 1 && !loadError && (
                <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-slate-100 bg-white">
                    <button
                        onClick={goPrev}
                        disabled={pageNumber <= 1}
                        className="p-2 text-slate-600 hover:text-[#60356a] hover:bg-slate-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition"
                        title="Página anterior (←)"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div className="flex items-center gap-1.5 text-sm">
                        <input
                            type="number"
                            min={1}
                            max={numPages}
                            value={pageNumber}
                            onChange={(e) => {
                                const n = parseInt(e.target.value, 10);
                                if (!Number.isNaN(n)) {
                                    setPageNumber(Math.min(Math.max(1, n), numPages));
                                }
                            }}
                            className="w-14 px-2 py-1 text-center font-bold text-[#60356a] bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#60356a]/20 focus:border-[#60356a] outline-none"
                        />
                        <span className="text-slate-500">/ {numPages}</span>
                    </div>
                    <button
                        onClick={goNext}
                        disabled={pageNumber >= numPages}
                        className="p-2 text-slate-600 hover:text-[#60356a] hover:bg-slate-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed transition"
                        title="Página siguiente (→)"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            )}
        </div>
    );
}
