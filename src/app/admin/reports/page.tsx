'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import {
    collection, getDocs, query, where, orderBy, limit,
    startAfter, Timestamp, DocumentSnapshot
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, Module, QuizSession } from '@/types';
import { FileText, Users, CheckCircle, Search, Eye, X, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 50;

interface ExamSession extends QuizSession {
    studentName: string;
    moduleName: string;
}

export default function ExamReportsPage() {
    const [sessions, setSessions] = useState<ExamSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSession, setSelectedSession] = useState<ExamSession | null>(null);
    const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);

    // Lookup maps loaded once — bounded by team/content size
    const usersMapRef = useRef<Map<string, string>>(new Map());
    const modulesMapRef = useRef<Map<string, string>>(new Map());
    // Firestore cursor for pagination
    const lastDocRef = useRef<DocumentSnapshot | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const buildSessionQuery = (cursor: DocumentSnapshot | null) => {
        const ninetyDaysAgo = Timestamp.fromDate(
            new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        );
        const base = query(
            collection(db, 'quiz_sessions'),
            where('completedAt', '>=', ninetyDaysAgo),
            orderBy('completedAt', 'desc'),
            limit(PAGE_SIZE)
        );
        return cursor ? query(base, startAfter(cursor)) : base;
    };

    const enrichSessions = (snap: DocumentSnapshot[]): ExamSession[] =>
        snap.map(docSnap => {
            const data = docSnap.data() as QuizSession;
            return {
                ...data,
                id: docSnap.id,
                studentName: usersMapRef.current.get(data.userId) || 'Unknown Student',
                moduleName: modulesMapRef.current.get(data.moduleId) || 'Unknown Module',
            };
        });

    const loadData = async () => {
        try {
            // Load users and modules once — these are bounded collections
            const [usersSnap, modulesSnap] = await Promise.all([
                getDocs(collection(db, 'users')),
                getDocs(collection(db, 'modules')),
            ]);

            usersSnap.docs.forEach(doc => {
                const data = doc.data() as User;
                usersMapRef.current.set(doc.id, data.displayName || 'Unknown');
            });
            modulesSnap.docs.forEach(doc => {
                const data = doc.data() as Module;
                modulesMapRef.current.set(doc.id, data.title || 'Unknown');
            });

            // First page of quiz sessions
            const sessionsSnap = await getDocs(buildSessionQuery(null));

            lastDocRef.current = sessionsSnap.docs[sessionsSnap.docs.length - 1] ?? null;
            setHasMore(sessionsSnap.docs.length === PAGE_SIZE);
            setSessions(enrichSessions(sessionsSnap.docs));

        } catch (error) {
            console.error('Error loading reports data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadMore = async () => {
        if (!lastDocRef.current || loadingMore) return;
        setLoadingMore(true);
        try {
            const snap = await getDocs(buildSessionQuery(lastDocRef.current));
            lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
            setHasMore(snap.docs.length === PAGE_SIZE);
            setSessions(prev => [...prev, ...enrichSessions(snap.docs)]);
        } catch (error) {
            console.error('Error loading more sessions:', error);
        } finally {
            setLoadingMore(false);
        }
    };

    const stats = useMemo(() => {
        const total = sessions.length;
        if (total === 0) return { total: 0, avgScore: 0, approvalRate: 0 };
        const passedCount = sessions.filter(s => s.passed).length;
        const totalScore = sessions.reduce((sum, s) => sum + s.score, 0);
        return {
            total,
            avgScore: Math.round(totalScore / total),
            approvalRate: Math.round((passedCount / total) * 100)
        };
    }, [sessions]);

    const filteredSessions = useMemo(() => {
        if (!searchQuery.trim()) return sessions;
        const lowerQ = searchQuery.toLowerCase();
        return sessions.filter(s =>
            s.studentName.toLowerCase().includes(lowerQ) ||
            s.moduleName.toLowerCase().includes(lowerQ)
        );
    }, [sessions, searchQuery]);

    const getScoreColorInfo = (score: number) => {
        if (score >= 80) return { bg: 'bg-emerald-50 text-emerald-600', border: 'border-emerald-200' };
        if (score >= 60) return { bg: 'bg-amber-50 text-amber-600', border: 'border-amber-200' };
        return { bg: 'bg-rose-50 text-rose-600', border: 'border-rose-200' };
    };

    const formatDate = (ts?: Timestamp) => {
        if (!ts) return 'N/A';
        return ts.toDate().toLocaleDateString('es-MX', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="space-y-8 animate-fade-in pb-12">
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                        <FileText className="w-8 h-8 text-[#135bec]" />
                        Reportes
                    </h1>
                    <p className="text-slate-500 mt-2 text-base font-medium">Monitorea exámenes y certificados emitidos.</p>
                </div>
            </header>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-[24px] p-6 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)] border border-slate-100 flex items-center gap-5 transition-transform hover:scale-[1.02]">
                    <div className="w-14 h-14 rounded-[16px] bg-[#135bec]/10 flex items-center justify-center shrink-0">
                        <FileText className="w-7 h-7 text-[#135bec]" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-semibold uppercase tracking-wide">Total Evaluaciones</p>
                        <p className="text-3xl font-extrabold text-slate-900 mt-1">{stats.total}</p>
                    </div>
                </div>

                <div className="bg-white rounded-[24px] p-6 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)] border border-slate-100 flex items-center gap-5 transition-transform hover:scale-[1.02]">
                    <div className="w-14 h-14 rounded-[16px] bg-indigo-50 flex items-center justify-center shrink-0">
                        <Users className="w-7 h-7 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-semibold uppercase tracking-wide">Puntaje Promedio</p>
                        <p className="text-3xl font-extrabold text-slate-900 mt-1">{stats.avgScore}%</p>
                    </div>
                </div>

                <div className="bg-white rounded-[24px] p-6 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)] border border-slate-100 flex items-center gap-5 transition-transform hover:scale-[1.02]">
                    <div className="w-14 h-14 rounded-[16px] bg-emerald-50 flex items-center justify-center shrink-0">
                        <CheckCircle className="w-7 h-7 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-semibold uppercase tracking-wide">Tasa de Aprobación</p>
                        <p className="text-3xl font-extrabold text-slate-900 mt-1">{stats.approvalRate}%</p>
                    </div>
                </div>
            </div>

            {/* Search and Table */}
            <div className="bg-white rounded-[24px] shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)] border border-slate-100 overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white">
                    <h2 className="text-xl font-bold text-slate-800">Registro de Sesiones</h2>
                    <div className="relative w-full sm:w-96">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por estudiante o módulo..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-2.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200/80 rounded-full focus:ring-4 focus:ring-[#135bec]/10 focus:border-[#135bec] text-sm text-slate-800 placeholder:text-slate-400 outline-none transition-all shadow-sm"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left text-sm text-slate-700 whitespace-nowrap">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-100 tracking-wider">
                            <tr>
                                <th scope="col" className="px-6 py-4 font-bold">Estudiante</th>
                                <th scope="col" className="px-6 py-4 font-bold max-w-xs truncate">Módulo</th>
                                <th scope="col" className="px-6 py-4 font-bold text-center">Puntaje</th>
                                <th scope="col" className="px-6 py-4 font-bold text-center">Estado</th>
                                <th scope="col" className="px-6 py-4 font-bold">Fecha</th>
                                <th scope="col" className="px-6 py-4 font-bold text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center text-slate-500">
                                        <div className="flex justify-center items-center gap-3">
                                            <div className="w-6 h-6 border-2 border-[#135bec] border-t-transparent rounded-full animate-spin"></div>
                                            <span className="font-medium">Cargando datos...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredSessions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center">
                                        <div className="flex justify-center items-center mb-4 text-slate-300">
                                            <Search size={32} />
                                        </div>
                                        <p className="text-slate-500 font-medium">No se encontraron sesiones que coincidan con la búsqueda.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredSessions.map((session) => {
                                    const scoreColors = getScoreColorInfo(session.score);
                                    return (
                                        <tr key={session.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                            <td className="px-6 py-4 font-semibold text-slate-800">{session.studentName}</td>
                                            <td className="px-6 py-4 text-slate-600 max-w-[200px] truncate" title={session.moduleName}>{session.moduleName}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border border-transparent ${scoreColors.bg}`}>
                                                    {session.score}%
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${session.passed
                                                    ? 'bg-emerald-50 text-emerald-600'
                                                    : 'bg-rose-50 text-rose-600'
                                                    }`}>
                                                    {session.passed ? 'Aprobado' : 'Reprobado'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 text-xs font-medium">
                                                {formatDate(session.completedAt || session.startedAt)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => {
                                                        setSelectedSession(session);
                                                        setActiveQuestionIdx(0);
                                                    }}
                                                    className="inline-flex items-center justify-center gap-2 px-5 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm font-semibold text-[#135bec] hover:bg-[#135bec] hover:text-white hover:border-transparent transition-all shadow-sm focus:outline-none"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                    Detalles
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Load More footer */}
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <p className="text-xs text-slate-400 font-medium">
                        Mostrando {filteredSessions.length} de {sessions.length} registros cargados · últimos 90 días
                    </p>
                    {hasMore && (
                        <button
                            onClick={loadMore}
                            disabled={loadingMore}
                            className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold text-[#135bec] border border-[#135bec]/20 hover:bg-[#135bec] hover:text-white hover:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loadingMore ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                    Cargando...
                                </>
                            ) : (
                                `Cargar más (${PAGE_SIZE} por página)`
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Detail Modal */}
            {selectedSession && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col shadow-2xl ring-1 ring-slate-900/5 animate-scale-in">

                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-white relative z-20 shrink-0">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-800 mb-1">Detalle de Evaluación</h2>
                                <p className="text-slate-500 text-sm flex items-center flex-wrap gap-2 font-medium">
                                    <span className="text-slate-700">{selectedSession.studentName}</span>
                                    <span className="text-slate-300">•</span>
                                    <span className="max-w-md truncate" title={selectedSession.moduleName}>{selectedSession.moduleName}</span>
                                    <span className="text-slate-300">•</span>
                                    <span>{formatDate(selectedSession.completedAt || selectedSession.startedAt)}</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-5">
                                <div className="text-right">
                                    <div className={`text-2xl font-extrabold ${getScoreColorInfo(selectedSession.score).bg.replace('bg-', 'text-').split(' ')[1]}`}>
                                        {selectedSession.score}%
                                    </div>
                                    <div className={`text-xs font-bold uppercase tracking-widest ${selectedSession.passed ? 'text-emerald-600' : 'text-rose-600'}`}>
                                        {selectedSession.passed ? 'Aprobado' : 'Reprobado'}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedSession(null)}
                                    className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors focus:outline-none"
                                    title="Cerrar"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body: Two-column layout */}
                        <div className="flex flex-1 overflow-hidden bg-slate-50">

                            {/* Left Sidebar: Question Navigation */}
                            <div className="w-full max-w-[280px] bg-white border-r border-slate-100 overflow-y-auto flex flex-col hidden md:flex">
                                <div className="p-5 border-b border-slate-100 bg-white sticky top-0 z-10">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                        Navegación
                                    </h3>
                                </div>
                                <div className="p-4 space-y-1.5 custom-scrollbar">
                                    {selectedSession.questions.map((q, idx) => {
                                        const answer = selectedSession.answers.find(a => a.questionId === q.id);
                                        const isCorrect = answer ? answer.isCorrect : false;
                                        const isActive = idx === activeQuestionIdx;

                                        return (
                                            <button
                                                key={q.id}
                                                onClick={() => setActiveQuestionIdx(idx)}
                                                className={`w-full text-left px-4 py-3.5 rounded-2xl flex items-center justify-between transition-all outline-none border ${isActive
                                                    ? 'bg-[#135bec]/5 border-[#135bec]/20'
                                                    : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-100'
                                                    }`}
                                            >
                                                <span className={`text-sm font-semibold ${isActive ? 'text-[#135bec]' : 'text-slate-600'}`}>
                                                    Pregunta {idx + 1}
                                                </span>
                                                <div className={`w-2.5 h-2.5 rounded-full shadow-sm ${isCorrect ? 'bg-emerald-500' : 'bg-rose-500'}`} title={isCorrect ? 'Correcta' : 'Incorrecta'} />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Right Area: Detail View */}
                            <div className="flex-1 flex flex-col min-w-0 bg-slate-50 relative">

                                {/* Scrollable Content */}
                                <div className="flex-1 overflow-y-auto p-6 md:p-10 custom-scrollbar">
                                    {(() => {
                                        const question = selectedSession.questions[activeQuestionIdx];
                                        if (!question) return null;

                                        const answer = selectedSession.answers.find(a => a.questionId === question.id);
                                        const selectedIndex = answer ? answer.selectedIndex : -1;
                                        const isCorrect = answer ? answer.isCorrect : false;

                                        return (
                                            <div className="max-w-3xl mx-auto pb-24">
                                                {/* Mobile Question Identifier */}
                                                <div className="md:hidden flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                                                    <span className="text-sm font-semibold text-slate-500">
                                                        Pregunta {activeQuestionIdx + 1} de {selectedSession.questions.length}
                                                    </span>
                                                    <div className={`px-2.5 py-1 rounded-full text-xs font-bold ${isCorrect ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                        {isCorrect ? 'Correcta' : 'Incorrecta'}
                                                    </div>
                                                </div>

                                                {/* Question Text */}
                                                <div className="flex gap-5 mb-10">
                                                    <div className={`hidden md:flex flex-shrink-0 w-12 h-12 rounded-[16px] items-center justify-center font-bold text-lg shadow-sm ${isCorrect ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                                                        {activeQuestionIdx + 1}
                                                    </div>
                                                    <h3 className="text-xl md:text-2xl font-bold text-slate-800 leading-relaxed pt-1.5">
                                                        {question.text}
                                                    </h3>
                                                </div>

                                                {/* Options */}
                                                <div className="space-y-4 md:pl-[68px]">
                                                    {question.options.map((opt, optIdx) => {
                                                        const isUserSelection = selectedIndex === optIdx;
                                                        const isActualCorrect = question.correctIndex === optIdx;

                                                        let optionStyle = "border-slate-200 bg-white text-slate-700";
                                                        let labelStyle = "bg-slate-100 text-slate-500";

                                                        if (isUserSelection && isActualCorrect) {
                                                            optionStyle = "border-emerald-200 bg-emerald-50/50 text-emerald-900 ring-2 ring-emerald-500/20 shadow-sm";
                                                            labelStyle = "bg-emerald-500 text-white shadow-sm";
                                                        } else if (isUserSelection && !isActualCorrect) {
                                                            optionStyle = "border-rose-200 bg-rose-50/50 text-rose-900 ring-2 ring-rose-500/20 shadow-sm";
                                                            labelStyle = "bg-rose-500 text-white shadow-sm";
                                                        } else if (!isUserSelection && isActualCorrect) {
                                                            optionStyle = "border-emerald-200 bg-white border-dashed text-emerald-800";
                                                            labelStyle = "bg-emerald-100 text-emerald-700";
                                                        }

                                                        return (
                                                            <div key={optIdx} className={`group flex items-center gap-4 p-5 rounded-2xl border ${optionStyle} transition-all duration-200 relative`}>
                                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${labelStyle}`}>
                                                                    {String.fromCharCode(65 + optIdx)}
                                                                </div>
                                                                <span className="text-base font-medium flex-1">{opt}</span>

                                                                {isActualCorrect && isUserSelection && (
                                                                    <div className="flex shrink-0 items-center justify-center bg-emerald-500 rounded-full w-7 h-7 shadow-sm">
                                                                        <CheckCircle className="w-4 h-4 text-white" />
                                                                    </div>
                                                                )}
                                                                {isActualCorrect && !isUserSelection && (
                                                                    <div className="flex shrink-0 items-center justify-center bg-emerald-50 rounded-full w-7 h-7 border border-emerald-100">
                                                                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                                                                    </div>
                                                                )}
                                                                {isUserSelection && !isActualCorrect && (
                                                                    <div className="flex shrink-0 items-center justify-center bg-rose-500 rounded-full w-7 h-7 shadow-sm">
                                                                        <X className="w-4 h-4 text-white" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Explanation */}
                                                {question.explanation && (
                                                    <div className="mt-8 md:pl-[68px]">
                                                        <div className="p-6 rounded-2xl bg-[#135bec]/5 border border-[#135bec]/10">
                                                            <div className="flex items-center gap-2.5 mb-3 text-[#135bec]">
                                                                <FileText className="w-5 h-5" />
                                                                <strong className="text-sm font-bold uppercase tracking-widest">Explicación</strong>
                                                            </div>
                                                            <p className="text-slate-700 font-medium leading-relaxed">
                                                                {question.explanation}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>

                                {/* Bottom Navigation Ribbon inside the Detail Pane */}
                                <div className="p-5 bg-white border-t border-slate-100 flex justify-between items-center shrink-0 relative z-10">
                                    <button
                                        onClick={() => setActiveQuestionIdx(prev => Math.max(0, prev - 1))}
                                        disabled={activeQuestionIdx === 0}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        Anterior
                                    </button>
                                    <span className="text-sm font-bold text-slate-400 hidden sm:inline-block tracking-wide">
                                        {activeQuestionIdx + 1} / {selectedSession.questions.length}
                                    </span>
                                    <button
                                        onClick={() => setActiveQuestionIdx(prev => Math.min(selectedSession.questions.length - 1, prev + 1))}
                                        disabled={activeQuestionIdx === selectedSession.questions.length - 1}
                                        className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold text-white bg-[#135bec] hover:bg-[#0f4ac0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-[0_4px_14px_0_rgba(19,91,236,0.25)] hover:shadow-[0_6px_20px_0_rgba(19,91,236,0.35)] active:scale-95"
                                    >
                                        Siguiente
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
