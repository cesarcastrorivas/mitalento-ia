'use client';

import { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, Module, QuizSession, Certificate } from '@/types';
import { FileText, Users, CheckCircle, Search, Eye, X, ChevronLeft, ChevronRight, Award } from 'lucide-react';

interface ExamSession extends QuizSession {
    studentName: string;
    moduleName: string;
}

interface CertificateRow extends Certificate {
    studentName: string;
}

const LEVEL_LABELS: Record<string, string> = {
    fundamental: 'Fundamental',
    professional: 'Profesional',
    elite: 'Élite',
    none: 'Sin Nivel',
};

const LEVEL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    fundamental: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
    professional: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
    elite: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
};

export default function ExamReportsPage() {
    const [sessions, setSessions] = useState<ExamSession[]>([]);
    const [certificates, setCertificates] = useState<CertificateRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSession, setSelectedSession] = useState<ExamSession | null>(null);
    const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
    const [activeTab, setActiveTab] = useState<'exams' | 'certificates'>('exams');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            // Fetch users
            const usersSnap = await getDocs(collection(db, 'users'));
            const usersMap = new Map<string, string>();
            usersSnap.docs.forEach(doc => {
                const data = doc.data() as User;
                usersMap.set(doc.id, data.displayName || 'Unknown');
            });

            // Fetch modules
            const modulesSnap = await getDocs(collection(db, 'modules'));
            const modulesMap = new Map<string, string>();
            modulesSnap.docs.forEach(doc => {
                const data = doc.data() as Module;
                modulesMap.set(doc.id, data.title || 'Unknown');
            });

            // Fetch quiz sessions
            const sessionsSnap = await getDocs(collection(db, 'quiz_sessions'));
            const loadedSessions: ExamSession[] = sessionsSnap.docs.map(doc => {
                const data = doc.data() as QuizSession;
                return {
                    ...data,
                    id: doc.id,
                    studentName: usersMap.get(data.userId) || 'Unknown Student',
                    moduleName: modulesMap.get(data.moduleId) || 'Unknown Module',
                };
            });

            // Sort by completed at descending
            loadedSessions.sort((a, b) => {
                const timeA = a.completedAt ? a.completedAt.toMillis() : a.startedAt.toMillis();
                const timeB = b.completedAt ? b.completedAt.toMillis() : b.startedAt.toMillis();
                return timeB - timeA;
            });

            setSessions(loadedSessions);

            // Fetch certificates
            const certsSnap = await getDocs(collection(db, 'certificates'));
            const loadedCerts: CertificateRow[] = certsSnap.docs.map(doc => {
                const data = doc.data() as Certificate;
                return {
                    ...data,
                    id: doc.id,
                    studentName: usersMap.get(data.userId) || 'Unknown Student',
                };
            });
            loadedCerts.sort((a, b) => {
                const timeA = a.issuedAt ? a.issuedAt.toMillis() : 0;
                const timeB = b.issuedAt ? b.issuedAt.toMillis() : 0;
                return timeB - timeA;
            });
            setCertificates(loadedCerts);

        } catch (error) {
            console.error('Error loading reports data:', error);
        } finally {
            setLoading(false);
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
        if (score >= 80) return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' };
        if (score >= 60) return { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' };
        return { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' };
    };

    const formatDate = (ts?: Timestamp) => {
        if (!ts) return 'N/A';
        return ts.toDate().toLocaleDateString('es-MX', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                    <FileText className="w-8 h-8 text-indigo-500 dark:text-indigo-400" />
                    Reportes
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">Monitorea exámenes y certificados emitidos.</p>
            </header>

            {/* Tab Switcher */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setActiveTab('exams')}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'exams'
                            ? 'bg-indigo-600 text-white shadow-lg'
                            : 'bg-white dark:bg-gray-800/40 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30'
                        }`}
                >
                    <FileText className="w-4 h-4 inline mr-1.5" />Resultados de Exámenes
                </button>
                <button
                    onClick={() => setActiveTab('certificates')}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'certificates'
                            ? 'bg-indigo-600 text-white shadow-lg'
                            : 'bg-white dark:bg-gray-800/40 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30'
                        }`}
                >
                    <Award className="w-4 h-4 inline mr-1.5" />Certificados Emitidos ({certificates.length})
                </button>
            </div>

            {/* ═══ TAB: EXAMS ═══ */}
            {activeTab === 'exams' && (
                <>
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-gray-800/40 backdrop-blur-md border border-gray-200 dark:border-gray-700/50 rounded-2xl p-6 shadow-sm dark:shadow-xl relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 dark:from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                                    <FileText className="w-6 h-6 text-blue-500 dark:text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Evaluaciones</p>
                                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800/40 backdrop-blur-md border border-gray-200 dark:border-gray-700/50 rounded-2xl p-6 shadow-sm dark:shadow-xl relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 dark:from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                                    <Users className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Puntaje Promedio</p>
                                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.avgScore}%</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800/40 backdrop-blur-md border border-gray-200 dark:border-gray-700/50 rounded-2xl p-6 shadow-sm dark:shadow-xl relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 dark:from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                                    <CheckCircle className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Tasa de Aprobación</p>
                                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.approvalRate}%</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Search and Table */}
                    <div className="bg-white dark:bg-gray-800/40 backdrop-blur-md border border-gray-200 dark:border-gray-700/50 rounded-2xl shadow-sm dark:shadow-xl overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700/50 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/50 dark:bg-transparent">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Registro de Sesiones</h2>
                            <div className="relative w-full sm:w-96">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Buscar por estudiante o módulo..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="bg-white dark:bg-gray-900/50 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 p-2.5 transition-colors placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none shadow-sm dark:shadow-none"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700/50">
                                    <tr>
                                        <th scope="col" className="px-6 py-4 font-semibold">Estudiante</th>
                                        <th scope="col" className="px-6 py-4 font-semibold max-w-xs truncate">Módulo</th>
                                        <th scope="col" className="px-6 py-4 font-semibold text-center">Puntaje</th>
                                        <th scope="col" className="px-6 py-4 font-semibold text-center">Estado</th>
                                        <th scope="col" className="px-6 py-4 font-semibold">Fecha</th>
                                        <th scope="col" className="px-6 py-4 font-semibold text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                                <div className="flex justify-center items-center gap-3">
                                                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                                    Cargando datos...
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredSessions.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                                No se encontraron sesiones que coincidan con la búsqueda.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredSessions.map((session) => {
                                            const scoreColors = getScoreColorInfo(session.score);
                                            return (
                                                <tr key={session.id} className="border-b border-gray-200 dark:border-gray-700/30 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
                                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{session.studentName}</td>
                                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400 max-w-[200px] truncate" title={session.moduleName}>{session.moduleName}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${scoreColors.bg} ${scoreColors.text} ${scoreColors.border}`}>
                                                            {session.score}%
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${session.passed
                                                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                                                            : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
                                                            }`}>
                                                            {session.passed ? 'Aprobado' : 'Reprobado'}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-xs">
                                                        {formatDate(session.completedAt || session.startedAt)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedSession(session);
                                                                setActiveQuestionIdx(0);
                                                            }}
                                                            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
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
                    </div>

                    {/* Detail Modal */}
                    {selectedSession && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 dark:bg-black/60 backdrop-blur-sm animate-fade-in">
                            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-6xl h-[90vh] overflow-hidden flex flex-col shadow-2xl ring-1 ring-gray-900/5 dark:ring-white/10 animate-scale-in">

                                {/* Modal Header */}
                                <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-start bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl relative z-20 shrink-0">
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Detalle de Evaluación</h2>
                                        <p className="text-gray-500 dark:text-gray-400 text-sm flex items-center flex-wrap gap-2">
                                            <span className="font-medium text-gray-700 dark:text-gray-300">{selectedSession.studentName}</span>
                                            <span>•</span>
                                            <span className="max-w-md truncate" title={selectedSession.moduleName}>{selectedSession.moduleName}</span>
                                            <span>•</span>
                                            <span>{formatDate(selectedSession.completedAt || selectedSession.startedAt)}</span>
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right mr-4">
                                            <div className={`text-2xl font-bold ${getScoreColorInfo(selectedSession.score).text}`}>
                                                {selectedSession.score}%
                                            </div>
                                            <div className={`text-xs font-bold uppercase tracking-wider ${selectedSession.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {selectedSession.passed ? 'Aprobado' : 'Reprobado'}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setSelectedSession(null)}
                                            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 hover:bg-gray-100 dark:hover:text-white dark:hover:bg-gray-800 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-600"
                                            title="Cerrar"
                                        >
                                            <X className="w-6 h-6" />
                                        </button>
                                    </div>
                                </div>

                                {/* Modal Body: Two-column layout */}
                                <div className="flex flex-1 overflow-hidden bg-gray-50 dark:bg-gray-900/50">

                                    {/* Left Sidebar: Question Navigation */}
                                    <div className="w-full max-w-[280px] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 overflow-y-auto flex flex-col hidden md:flex">
                                        <div className="p-4 border-b border-gray-100 dark:border-gray-800/50 bg-gray-50/50 dark:bg-transparent sticky top-0 z-10 backdrop-blur-sm block">
                                            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                                Navegación de Preguntas
                                            </h3>
                                        </div>
                                        <div className="p-3 space-y-1">
                                            {selectedSession.questions.map((q, idx) => {
                                                const answer = selectedSession.answers.find(a => a.questionId === q.id);
                                                const isCorrect = answer ? answer.isCorrect : false;
                                                const isActive = idx === activeQuestionIdx;

                                                return (
                                                    <button
                                                        key={q.id}
                                                        onClick={() => setActiveQuestionIdx(idx)}
                                                        className={`w-full text-left px-3 py-3 rounded-xl flex items-center justify-between transition-all outline-none ${isActive
                                                            ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30'
                                                            : 'hover:bg-gray-50 dark:hover:bg-gray-800 border-transparent'
                                                            } border`}
                                                    >
                                                        <span className={`text-sm font-medium ${isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'}`}>
                                                            Pregunta {idx + 1}
                                                        </span>
                                                        <div className={`w-2 h-2 rounded-full ${isCorrect ? 'bg-emerald-500' : 'bg-red-500'}`} title={isCorrect ? 'Correcta' : 'Incorrecta'} />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Right Area: Detail View */}
                                    <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
                                        {(() => {
                                            const question = selectedSession.questions[activeQuestionIdx];
                                            if (!question) return null;

                                            const answer = selectedSession.answers.find(a => a.questionId === question.id);
                                            const selectedIndex = answer ? answer.selectedIndex : -1;
                                            const isCorrect = answer ? answer.isCorrect : false;

                                            return (
                                                <div className="max-w-3xl mx-auto pb-24">
                                                    {/* Mobile Question Identifier */}
                                                    <div className="md:hidden flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-800">
                                                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                                            Pregunta {activeQuestionIdx + 1} de {selectedSession.questions.length}
                                                        </span>
                                                        <div className={`px-2 py-1 rounded text-xs font-bold ${isCorrect ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'}`}>
                                                            {isCorrect ? 'Correcta' : 'Incorrecta'}
                                                        </div>
                                                    </div>

                                                    {/* Question Text */}
                                                    <div className="flex gap-4 mb-8">
                                                        <div className={`hidden md:flex flex-shrink-0 w-10 h-10 rounded-xl items-center justify-center font-bold text-lg ${isCorrect ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400'}`}>
                                                            {activeQuestionIdx + 1}
                                                        </div>
                                                        <h3 className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white leading-relaxed pt-1">
                                                            {question.text}
                                                        </h3>
                                                    </div>

                                                    {/* Options */}
                                                    <div className="space-y-4 md:pl-14">
                                                        {question.options.map((opt, optIdx) => {
                                                            const isUserSelection = selectedIndex === optIdx;
                                                            const isActualCorrect = question.correctIndex === optIdx;

                                                            let optionStyle = "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/40 text-gray-700 dark:text-gray-300";
                                                            let labelStyle = "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-600 transition-colors";

                                                            if (isUserSelection && isActualCorrect) {
                                                                optionStyle = "border-emerald-300 dark:border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-100 ring-2 ring-emerald-500/20 shadow-sm";
                                                                labelStyle = "bg-emerald-500 text-white";
                                                            } else if (isUserSelection && !isActualCorrect) {
                                                                optionStyle = "border-red-300 dark:border-red-500/50 bg-red-50/50 dark:bg-red-500/10 text-red-900 dark:text-red-100 ring-2 ring-red-500/20 shadow-sm";
                                                                labelStyle = "bg-red-500 text-white";
                                                            } else if (!isUserSelection && isActualCorrect) {
                                                                optionStyle = "border-emerald-300 dark:border-emerald-500/30 bg-white dark:bg-gray-900 border-dashed text-emerald-700 dark:text-emerald-300";
                                                                labelStyle = "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400";
                                                            }

                                                            return (
                                                                <div key={optIdx} className={`group flex items-center gap-4 p-4 rounded-xl border ${optionStyle} transition-all duration-200 relative`}>
                                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${labelStyle}`}>
                                                                        {String.fromCharCode(65 + optIdx)}
                                                                    </div>
                                                                    <span className="text-base flex-1">{opt}</span>

                                                                    {isActualCorrect && isUserSelection && (
                                                                        <div className="flex shrink-0 items-center justify-center bg-emerald-500 rounded-full w-6 h-6 shadow-sm">
                                                                            <CheckCircle className="w-4 h-4 text-white" />
                                                                        </div>
                                                                    )}
                                                                    {isActualCorrect && !isUserSelection && (
                                                                        <div className="flex shrink-0 items-center justify-center bg-emerald-100 dark:bg-emerald-500/20 rounded-full w-6 h-6">
                                                                            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                                                        </div>
                                                                    )}
                                                                    {isUserSelection && !isActualCorrect && (
                                                                        <div className="flex shrink-0 items-center justify-center bg-red-500 rounded-full w-6 h-6 shadow-sm">
                                                                            <X className="w-4 h-4 text-white" />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {/* Explanation */}
                                                    {question.explanation && (
                                                        <div className="mt-8 md:pl-14">
                                                            <div className="p-5 rounded-xl bg-indigo-50/80 dark:bg-indigo-500/5 border border-indigo-100 dark:border-indigo-500/20">
                                                                <div className="flex items-center gap-2 mb-2 text-indigo-700 dark:text-indigo-400">
                                                                    <FileText className="w-4 h-4" />
                                                                    <strong className="text-sm uppercase tracking-wide">Explicación</strong>
                                                                </div>
                                                                <p className="text-indigo-900/90 dark:text-indigo-200/80 leading-relaxed">
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
                                    <div className="absolute bottom-0 right-0 left-0 md:left-[280px] p-4 bg-white/90 dark:bg-gray-900/90 border-t border-gray-200 dark:border-gray-800 backdrop-blur-md flex justify-between items-center px-4 md:px-8 z-30">
                                        <button
                                            onClick={() => setActiveQuestionIdx(prev => Math.max(0, prev - 1))}
                                            disabled={activeQuestionIdx === 0}
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                            Anterior
                                        </button>
                                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 hidden sm:inline-block">
                                            {activeQuestionIdx + 1} de {selectedSession.questions.length}
                                        </span>
                                        <button
                                            onClick={() => setActiveQuestionIdx(prev => Math.min(selectedSession.questions.length - 1, prev + 1))}
                                            disabled={activeQuestionIdx === selectedSession.questions.length - 1}
                                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                                        >
                                            Siguiente
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>

                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ═══ TAB: CERTIFICATES ═══ */}
            {activeTab === 'certificates' && (
                <>
                    {/* Cert Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                        <div className="bg-white dark:bg-gray-800/40 backdrop-blur-md border border-gray-200 dark:border-gray-700/50 rounded-2xl p-6 shadow-sm dark:shadow-xl">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                                    <Award className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Certificados</p>
                                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{certificates.length}</p>
                                </div>
                            </div>
                        </div>
                        {(['fundamental', 'professional', 'elite'] as const).map(level => {
                            const count = certificates.filter(c => c.level === level).length;
                            const colors = LEVEL_COLORS[level];
                            return (
                                <div key={level} className="bg-white dark:bg-gray-800/40 backdrop-blur-md border border-gray-200 dark:border-gray-700/50 rounded-2xl p-6 shadow-sm dark:shadow-xl">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center`}>
                                            <Award className={`w-6 h-6 ${colors.text}`} />
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{LEVEL_LABELS[level]}</p>
                                            <p className="text-3xl font-bold text-gray-900 dark:text-white">{count}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Certificates Table */}
                    <div className="bg-white dark:bg-gray-800/40 backdrop-blur-md border border-gray-200 dark:border-gray-700/50 rounded-2xl shadow-sm dark:shadow-xl overflow-hidden">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700/50 bg-gray-50/50 dark:bg-transparent">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Registro de Certificados</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-900/40 border-b border-gray-200 dark:border-gray-700/50">
                                    <tr>
                                        <th scope="col" className="px-6 py-4 font-semibold">Estudiante</th>
                                        <th scope="col" className="px-6 py-4 font-semibold">Ruta</th>
                                        <th scope="col" className="px-6 py-4 font-semibold text-center">Nivel</th>
                                        <th scope="col" className="px-6 py-4 font-semibold text-center">Puntaje</th>
                                        <th scope="col" className="px-6 py-4 font-semibold">Código</th>
                                        <th scope="col" className="px-6 py-4 font-semibold">Fecha</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                                <div className="flex justify-center items-center gap-3">
                                                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                                                    Cargando datos...
                                                </div>
                                            </td>
                                        </tr>
                                    ) : certificates.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                                                No se han emitido certificados aún.
                                            </td>
                                        </tr>
                                    ) : (
                                        certificates.map(cert => {
                                            const lc = LEVEL_COLORS[cert.level] || LEVEL_COLORS.fundamental;
                                            return (
                                                <tr key={cert.id} className="border-b border-gray-200 dark:border-gray-700/30 hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
                                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{cert.studentName}</td>
                                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-400 max-w-[200px] truncate" title={cert.pathTitle || ''}>{cert.pathTitle || '—'}</td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${lc.bg} ${lc.text} ${lc.border}`}>
                                                            {LEVEL_LABELS[cert.level] || cert.level}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-center font-bold">{cert.score}%</td>
                                                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-xs font-mono">{cert.verificationCode}</td>
                                                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-xs">
                                                        {cert.issuedAt?.toDate?.()?.toLocaleDateString('es-MX', {
                                                            year: 'numeric', month: 'short', day: 'numeric'
                                                        }) || 'N/A'}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
