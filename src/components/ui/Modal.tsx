'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
};

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    subtitle,
    children,
    footer,
    maxWidth = 'lg',
}) => {
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
            style={{ animation: 'modal-overlay-in 200ms ease-out forwards' }}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-md" />

            {/* Modal */}
            <div
                className={`relative bg-white rounded-2xl ${maxWidthClasses[maxWidth]} w-full shadow-2xl ring-1 ring-slate-900/5 overflow-hidden`}
                style={{ animation: 'modal-content-in 250ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Purple accent line */}
                <div className="h-1 w-full bg-gradient-to-r from-purple-600 via-violet-500 to-indigo-500" />

                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900 tracking-tight">{title}</h2>
                        {subtitle && (
                            <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 -m-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body - Increased max height and added better scrolling padding */}
                <div className="px-6 py-5 max-h-[75vh] min-h-[40vh] overflow-y-auto overflow-x-hidden space-y-5 custom-scrollbar">
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-3">
                        {footer}
                    </div>
                )}
            </div>

            <style jsx global>{`
                @keyframes modal-overlay-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes modal-content-in {
                    from {
                        opacity: 0;
                        transform: scale(0.95) translateY(8px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
                
                /* Estilos personalizados para el scrollbar dentro del modal */
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #cbd5e1;
                    border-radius: 20px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: #94a3b8;
                }
            `}</style>
        </div>
    );
};
