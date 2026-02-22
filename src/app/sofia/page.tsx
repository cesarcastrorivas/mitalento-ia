'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Send, Bot, User as UserIcon, Sparkles, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
    role: 'user' | 'model';
    content: string;
}

export default function SofiaPage() {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', content: '¡Hola! Soy SofIA, tu asistente de Inteligencia Artificial en Urbanity. ¿En qué puedo ayudarte hoy con tus estudios o ventas?' }
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
        <div className="flex flex-col h-[calc(100vh-80px)] max-w-3xl mx-auto px-3 py-4 font-sans">

            {/* ── Header ── */}
            <header className="flex items-center gap-3.5 mb-6 px-1">
                <div className="relative">
                    <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-md"
                        style={{ background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)' }}
                    >
                        <span className="text-white text-lg font-bold">S</span>
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold text-gray-900">SofIA</h1>
                        <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[9px] font-semibold uppercase tracking-wide">Pro</span>
                    </div>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">Asistente de IA · En línea</p>
                </div>
            </header>

            {/* ── Chat Container ── */}
            <div className="flex-1 overflow-hidden flex flex-col rounded-3xl bg-white shadow-md">

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4 scroll-smooth" style={{ scrollbarWidth: 'thin' }}>
                    {messages.map((msg, index) => (
                        <div
                            key={index}
                            className={`flex items-end gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                            style={{ animation: `fadeSlideIn 0.35s ease-out ${index * 0.05}s both` }}
                        >
                            {/* Avatar */}
                            {msg.role === 'model' ? (
                                <div
                                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-sm"
                                    style={{ background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)' }}
                                >
                                    <Bot size={14} className="text-white" />
                                </div>
                            ) : (
                                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-gray-300 text-gray-600">
                                    <UserIcon size={14} />
                                </div>
                            )}

                            {/* Bubble */}
                            <div
                                className={`max-w-[75%] px-4 py-2.5 text-sm leading-relaxed ${msg.role === 'user'
                                    ? 'rounded-2xl rounded-br-sm text-white'
                                    : 'rounded-2xl rounded-bl-sm text-gray-800'
                                    }`}
                                style={{
                                    background: msg.role === 'user'
                                        ? 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)'
                                        : '#F5F5F5',
                                    boxShadow: msg.role === 'user'
                                        ? '0 1px 3px rgba(99, 102, 241, 0.2)'
                                        : 'none',
                                }}
                            >
                                <ReactMarkdown
                                    components={{
                                        // @ts-ignore
                                        strong: ({ node, ...props }) => (
                                            <strong className={`font-semibold ${msg.role === 'user' ? 'text-white' : 'text-indigo-600'}`} {...props} />
                                        ),
                                        // @ts-ignore
                                        ul: ({ node, ...props }) => <ul className="list-disc pl-4 space-y-0.5 my-1" {...props} />,
                                        // @ts-ignore
                                        ol: ({ node, ...props }) => <ol className="list-decimal pl-4 space-y-0.5 my-1" {...props} />,
                                        // @ts-ignore
                                        li: ({ node, ...props }) => <li className="pl-0.5" {...props} />,
                                        // @ts-ignore
                                        p: ({ node, ...props }) => <p className="mb-1 last:mb-0" {...props} />,
                                    }}
                                >
                                    {msg.content}
                                </ReactMarkdown>
                            </div>
                        </div>
                    ))}

                    {/* Skeleton loading */}
                    {isLoading && (
                        <div className="flex items-end gap-2.5" style={{ animation: 'fadeSlideIn 0.3s ease-out both' }}>
                            <div
                                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-sm"
                                style={{ background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)' }}
                            >
                                <Bot size={14} className="text-white" />
                            </div>
                            <div className="rounded-2xl rounded-bl-sm px-4 py-3 bg-gray-100 w-44">
                                <div className="space-y-2 animate-pulse">
                                    <div className="h-2 bg-gray-300/70 rounded-full w-[90%]" />
                                    <div className="h-2 bg-gray-300/50 rounded-full w-full" />
                                    <div className="h-2 bg-gray-300/50 rounded-full w-[65%]" />
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* ── Input Area ── */}
                <div className="border-t border-gray-100 px-4 py-3.5 bg-gray-50/40">
                    <div className="flex items-center gap-2 bg-white rounded-2xl border border-gray-200 pl-4 pr-1.5 py-1.5 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all duration-200">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Escribe tu mensaje..."
                            className="flex-1 text-sm text-gray-800 placeholder:text-gray-400 resize-none focus:outline-none bg-transparent leading-relaxed"
                            rows={1}
                            style={{ maxHeight: '120px' }}
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={!input.trim() || isLoading}
                            className={`
                                w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200
                                ${!input.trim() || isLoading
                                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-md active:scale-95'
                                }
                            `}
                        >
                            {isLoading
                                ? <Loader2 size={16} className="animate-spin" />
                                : <Send size={16} />
                            }
                        </button>
                    </div>
                    <p className="text-center text-[10px] text-gray-400 mt-2.5 tracking-wide">
                        SofIA Pro · Gemini 2.0 Flash
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
            `}</style>
        </div>
    );
}
