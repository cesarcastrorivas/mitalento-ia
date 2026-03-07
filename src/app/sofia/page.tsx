'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Send, Bot, User as UserIcon, Sparkles, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
    role: 'user' | 'model';
    content: string;
}

const TypewriterMessage = ({ content, isUser }: { content: string, isUser: boolean }) => {
    const [displayedContent, setDisplayedContent] = useState(isUser ? content : '');

    useEffect(() => {
        if (isUser) {
            setDisplayedContent(content);
            return;
        }

        let i = 0;
        const speed = 12; // ms per char for a fast smooth effect
        const timer = setInterval(() => {
            if (i < content.length) {
                setDisplayedContent(content.substring(0, i + 1));
                i++;
            } else {
                clearInterval(timer);
            }
        }, speed);

        return () => clearInterval(timer);
    }, [content, isUser]);

    return (
        <ReactMarkdown
            components={{
                // @ts-ignore
                strong: ({ node, ...props }) => (
                    <strong className={`font-semibold ${isUser ? 'text-white' : 'text-indigo-600'}`} {...props} />
                ),
                // @ts-ignore
                ul: ({ node, ...props }) => <ul className="list-disc pl-4 space-y-0.5 my-1" {...props} />,
                // @ts-ignore
                ol: ({ node, ...props }) => <ol className="list-decimal pl-4 space-y-0.5 my-1" {...props} />,
                // @ts-ignore
                li: ({ node, ...props }) => <li className="pl-0.5" {...props} />,
                // @ts-ignore
                p: ({ node, ...props }) => <p className="mb-1 last:mb-0 min-h-[1.5rem]" {...props} />,
            }}
        >
            {displayedContent}
        </ReactMarkdown>
    );
};


export default function SofiaPage() {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', content: '¡Hola! Soy Bally IA, tu asistente de Inteligencia Artificial en Urbanity. ¿En qué puedo ayudarte hoy con tus estudios o ventas?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        }
    }, [input]);

    const handleSendMessage = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    history: messages.map(m => ({ role: m.role === 'model' ? 'model' : 'user', content: m.content }))
                }),
            });

            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            setMessages(prev => [...prev, { role: 'model', content: data.response }]);
        } catch (error) {
            console.error('Error sending message:', error);
            setMessages(prev => [...prev, { role: 'model', content: 'Lo siento, tuve un problema al procesar tu mensaje. ¿Podrías intentarlo de nuevo?' }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return (
        <div className="fixed inset-0 flex flex-col bg-bg-main overflow-hidden font-sans">
            <div className="flex flex-col h-full w-full max-w-3xl mx-auto pb-[calc(env(safe-area-inset-bottom,0px)+64px)] md:pb-[calc(env(safe-area-inset-bottom,0px)+80px)]">
                {/* ── Header Premium ── */}
                <header className="shrink-0 flex items-center gap-4 mt-safe pt-4 md:pt-6 mb-2 px-4 md:px-2 py-3 bg-white/60 backdrop-blur-xl border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.04)] rounded-b-3xl md:rounded-3xl sticky top-0 z-20 transition-all select-none">
                    <div className="relative shrink-0 ml-2">
                        <div
                            className="w-12 h-12 rounded-full flex items-center justify-center shadow-sm"
                            style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid rgba(255,255,255,0.8)' }}
                        >
                            <Sparkles size={22} className="text-indigo-500" />
                        </div>
                        <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-white shadow-sm" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-[19px] font-bold text-gray-900 tracking-tight font-sans">Bally IA</h1>
                            <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-sm">Pro</span>
                        </div>
                        <p className="text-[13px] text-gray-500 font-medium mt-0.5">Asistente de IA · En línea</p>
                    </div>
                </header>

                {/* ── Chat Container ── */}
                <div className="flex-1 overflow-hidden flex flex-col relative z-0">
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-2 space-y-6 scroll-smooth custom-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
                        {messages.map((msg, index) => (
                            <div
                                key={index}
                                className={`flex items-end gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                                style={{ animation: `fadeSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.05}s both` }}
                            >
                                {/* Avatar */}
                                {msg.role === 'model' && (
                                    <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border border-white/50 select-none"
                                        style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}
                                    >
                                        <Sparkles size={14} className="text-indigo-500" />
                                    </div>
                                )}

                                {/* Bubble */}
                                <div
                                    className={`max-w-[85%] md:max-w-[80%] px-5 py-3.5 text-[15px] leading-relaxed relative select-none ${msg.role === 'user'
                                        ? 'rounded-[24px] rounded-br-[8px] text-white'
                                        : 'rounded-[24px] rounded-bl-[8px] text-gray-800'
                                        }`}
                                    style={{
                                        background: msg.role === 'user'
                                            ? 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)'
                                            : '#ffffff',
                                        boxShadow: msg.role === 'user'
                                            ? '0 4px 12px rgba(99, 102, 241, 0.25)'
                                            : '0 4px 16px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
                                        border: msg.role === 'model' ? '1px solid rgba(0,0,0,0.02)' : 'none',
                                    }}
                                >
                                    <div className="select-text">
                                        <TypewriterMessage content={msg.content} isUser={msg.role === 'user'} />
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Skeleton loading */}
                        {isLoading && (
                            <div className="flex items-end gap-3" style={{ animation: 'fadeSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both' }}>
                                <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border border-white/50 select-none"
                                    style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}
                                >
                                    <Sparkles size={14} className="text-indigo-500" />
                                </div>
                                <div className="rounded-[24px] rounded-bl-[8px] px-5 py-4 bg-white shadow-[0_4px_16px_rgba(0,0,0,0.04)] border border-[rgba(0,0,0,0.02)] w-48">
                                    <div className="space-y-2.5 animate-pulse">
                                        <div className="h-2 bg-gray-200 rounded-full w-[90%]" />
                                        <div className="h-2 bg-gray-200 rounded-full w-full" />
                                        <div className="h-2 bg-gray-200 rounded-full w-[65%]" />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} className="h-4 md:h-8" />
                    </div>

                    {/* ── Input Area Premium ── */}
                    <div className="shrink-0 pt-2 pb-2 md:pb-4 px-4 relative z-10 bg-gradient-to-t from-[var(--bg-main)] via-[var(--bg-main)] to-transparent">
                        <div className="flex items-end gap-2 bg-white rounded-[32px] shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-[rgba(0,0,0,0.04)] pl-5 pr-2 py-2 focus-within:shadow-[0_8px_32px_rgba(99,102,241,0.16)] focus-within:border-indigo-100 transition-all duration-300">
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Escribe tu mensaje..."
                                className="flex-1 my-2.5 text-[16px] text-gray-800 placeholder:text-gray-400 placeholder:font-light resize-none focus:outline-none bg-transparent leading-relaxed custom-scrollbar touch-manipulation"
                                rows={1}
                                style={{ maxHeight: '120px' }}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={!input.trim() || isLoading}
                                className={`
                                    w-11 h-11 md:w-12 md:h-12 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 transform touch-manipulation
                                    ${!input.trim() || isLoading
                                        ? 'bg-gray-100 text-gray-300 cursor-not-allowed scale-95'
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 active:scale-95'
                                    }
                                `}
                            >
                                {isLoading
                                    ? <Loader2 size={18} className="animate-spin" />
                                    : <Send size={18} className="translate-x-[1px] translate-y-[-1px]" />
                                }
                            </button>
                        </div>
                        <p className="text-center text-[11px] text-gray-400 mt-3 md:mt-4 tracking-wide font-medium opacity-70 select-none pb-1">
                            Bally es una IA y puede cometer errores.
                        </p>
                    </div>
                </div>

                {/* Keyframe animation */}
                <style jsx>{`
                    @keyframes fadeSlideIn {
                        from {
                            opacity: 0;
                            transform: translateY(8px);
                        }
                        to {
                            opacity: 1;
                            transform: translateY(0);
                        }
                    }
                    /* SafeArea support for older iOS */
                    .mt-safe {
                        margin-top: env(safe-area-inset-top, 0px);
                    }
                `}</style>
            </div>
        </div>
    );
}
