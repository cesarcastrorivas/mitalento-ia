'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Send, Bot, User as UserIcon, Sparkles, Loader2, ArrowLeft } from 'lucide-react';
import styles from './page.module.css'; // We'll create this or use inline styles if valid
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

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

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

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
        <div className="flex flex-col h-[calc(100vh-80px)] max-w-4xl mx-auto px-4 py-6">
            {/* Header */}
            <header className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[var(--primary-600)] to-[var(--primary-800)] flex items-center justify-center text-white shadow-lg shadow-[rgba(124,58,237,0.2)]">
                    <Sparkles size={20} />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold text-[var(--text-primary)]">SofIA</h1>
                        <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                    </div>
                </div>
            </header>

            {/* Chat Area */}
            <div
                className="flex-1 overflow-hidden flex flex-col relative"
                style={{
                    background: 'rgba(255, 255, 255, 0.70)',
                    backdropFilter: 'blur(12px)',
                    borderRadius: '2rem',
                    border: '1px solid rgba(255, 255, 255, 0.5)',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
                }}
            >
                <div className="absolute inset-0 bg-gradient-to-b from-[var(--primary-50)]/30 to-transparent pointer-events-none" />

                {/* Messages List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar relative z-10">
                    {messages.map((msg, index) => (
                        <div
                            key={index}
                            className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                        >
                            <div className={`
                                w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm
                                ${msg.role === 'user'
                                    ? 'bg-[var(--primary-100)] text-[var(--primary-700)]'
                                    : 'bg-[var(--primary-600)] text-white'
                                }
                            `}>
                                {msg.role === 'user' ? <UserIcon size={16} /> : <Bot size={16} />}
                            </div>

                            <div
                                className={`
                                    max-w-[80%] rounded-2xl px-5 py-3.5 text-[16px] leading-relaxed shadow-sm
                                    ${msg.role === 'user'
                                        ? 'text-white rounded-tr-sm'
                                        : 'text-[var(--text-primary)] rounded-tl-sm'
                                    }
                                `}
                                style={{
                                    backgroundColor: msg.role === 'user' ? 'var(--primary-600)' : '#F8F9FC',
                                    border: 'none'
                                }}
                            >
                                {msg.content}
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-2">
                            <div className="w-8 h-8 rounded-full bg-[var(--primary-600)] text-white flex items-center justify-center shrink-0 mt-1 shadow-sm">
                                <Bot size={16} />
                            </div>
                            <div
                                className="rounded-2xl rounded-tl-sm p-4 shadow-sm flex items-center gap-2"
                                style={{ backgroundColor: '#F8F9FC', border: 'none' }}
                            >
                                <span className="w-2 h-2 bg-[var(--primary-400)] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                <span className="w-2 h-2 bg-[var(--primary-400)] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                <span className="w-2 h-2 bg-[var(--primary-400)] rounded-full animate-bounce"></span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white/40 backdrop-blur-md relative z-20">
                    <div className="flex gap-2 items-end max-w-3xl mx-auto">
                        <div
                            className="relative flex-1 bg-white/80 hover:bg-white transition-all duration-300 rounded-[1.5rem]"
                            style={{
                                boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
                                border: '1px solid rgba(229, 231, 235, 0.5)',
                                padding: '0px',
                                outline: 'none !important'
                            }}
                        >
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Escribe tu pregunta aquí..."
                                className="w-full max-h-[120px] min-h-[56px] py-4 px-5 bg-transparent text-[16px] text-[var(--text-primary)] placeholder:text-gray-400 resize-none custom-scrollbar focus:ring-0 focus:outline-none focus:border-none active:outline-none active:border-none"
                                style={{
                                    outline: 'none !important',
                                    border: 'none !important',
                                    boxShadow: 'none !important',
                                    backgroundColor: 'transparent !important'
                                }}
                                rows={1}
                            />
                        </div>
                        <Button
                            onClick={handleSendMessage}
                            disabled={!input.trim() || isLoading}
                            className={`
                                !h-[56px] !w-[56px] !p-0 rounded-full flex items-center justify-center shrink-0 transition-all duration-300
                                ${!input.trim() || isLoading
                                    ? 'opacity-40 scale-90 cursor-not-allowed bg-gray-200 text-gray-400'
                                    : '!bg-[var(--primary-600)] hover:!bg-[var(--primary-700)] text-white shadow-lg shadow-[rgba(124,58,237,0.3)] hover:scale-105 active:scale-95'
                                }
                            `}
                        >
                            {isLoading ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} className="ml-0.5 mt-0.5" />}
                        </Button>
                    </div>
                    <p className="text-center text-[10px] text-[var(--text-muted)] mt-2 opacity-60">
                        SofIA puede cometer errores. Verifica la información importante.
                    </p>
                </div>
            </div>
        </div>
    );
}
