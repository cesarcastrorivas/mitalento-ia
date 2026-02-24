import { Timestamp } from 'firebase/firestore';

// Roles de usuario
export type UserRole = 'admin' | 'student';

// Nivel de certificación Urbanity Academy
export type CertificationLevel = 'none' | 'fundamental' | 'professional' | 'elite';

// Semáforo actitudinal
export type AttitudinalSemaphore = 'green' | 'yellow' | 'red';

// Usuario
export interface User {
    uid: string;
    email: string;
    displayName: string;
    role: UserRole;
    createdAt: Timestamp;
    createdBy?: string; // UID del admin que lo creó
    isActive: boolean;
    photoURL?: string; // URL de la foto de perfil del estudiante
    assignedPathIds?: string[]; // IDs de los caminos asignados al usuario
    certificationLevel?: CertificationLevel;
    attitudinalStatus?: AttitudinalSemaphore | 'pending';
    completedCourses?: string[]; // IDs de cursos completados (todos sus módulos aprobados)
    completedPaths?: string[];   // IDs de rutas completadas (todos sus cursos aprobados)
    stageChecklist?: Record<string, boolean>; // Checklist de requisitos por etapa del pipeline
    supervisorFeedback?: string; // Nota del supervisor sobre el candidato
}

// Camino de aprendizaje (Learning Path)
export interface LearningPath {
    id: string;
    title: string;
    description: string;
    icon?: string;
    order: number;
    isActive: boolean;
    certificationLevel?: CertificationLevel; // Nivel que otorga esta ruta al completarse
    createdAt: Timestamp;
    createdBy: string;
}

// Curso
export interface Course {
    id: string;
    pathId: string; // ID del LearningPath al que pertenece
    title: string;
    description: string;
    thumbnailUrl?: string;
    order: number;
    isActive: boolean;
    isOptional: boolean; // Si es opcional o obligatorio
    createdAt: Timestamp;
    createdBy: string;
}

// Progreso del usuario en un módulo
export interface ModuleProgress {
    moduleId: string;
    completed: boolean;
    score: number;
    attempts: number;
    lastAttempt?: Timestamp;
    bestScore: number;
}

// Módulo de entrenamiento
export interface Module {
    id: string;
    courseId: string; // ID del Curso al que pertenece
    title: string;
    description: string;
    videoUrl: string;
    videoDuration?: number; // en segundos
    thumbnailUrl?: string;
    order: number; // Orden dentro del curso
    isActive: boolean;
    createdAt: Timestamp;
    createdBy: string;
    videoContext?: string; // Contexto generado por IA para crear preguntas
    requiredWatchPercentage: number; // % del video que debe verse antes del quiz
    passingScore: number; // Puntuación mínima para aprobar (0-100)
    transcription?: string; // Transcripción del video generada por IA
}

// Pregunta generada por IA
export interface Question {
    id: string;
    text: string;
    options: string[];
    correctIndex: number;
    explanation: string;
}

// Respuesta del usuario
export interface UserAnswer {
    questionId: string;
    selectedIndex: number;
    isCorrect: boolean;
    answeredAt: Timestamp;
}

// Sesión de quiz
export interface QuizSession {
    id: string;
    moduleId: string;
    userId: string;
    questions: Question[];
    answers: UserAnswer[];
    score: number;
    passed: boolean;
    startedAt: Timestamp;
    completedAt?: Timestamp;
    seed: string; // Seed única para variación de preguntas
}

// Estado del quiz en el frontend
export interface QuizState {
    currentQuestionIndex: number;
    answers: Map<string, number>;
    isCompleted: boolean;
    showResults: boolean;
}

// ═══════════════════════════════════════════════════
// Urbanity Academy — Certificación Intensiva 3 Días
// ═══════════════════════════════════════════════════

// Evaluación actitudinal (Día 1 - Filtro Psicológico)
export interface AttitudinalEvaluation {
    id: string;
    userId: string;
    responses: { question: string; answer: string }[];
    aiAnalysis: string;
    semaphore: AttitudinalSemaphore;
    supervisorApproved?: boolean;
    supervisorNotes?: string;
    createdAt: Timestamp;
}

// Plan de acción 30-60-90 (Día 3)
export interface ActionPlan {
    id: string;
    userId: string;
    targetIncome: number;
    callsPerDay: number;
    appointmentsPerWeek: number;
    closingsPerMonth: number;
    plan30: string;
    plan60: string;
    plan90: string;
    createdAt: Timestamp;
}

// Certificado digital verificable
export interface Certificate {
    id: string;
    userId: string;
    userName: string;
    level: CertificationLevel;
    pathId?: string;    // ID de la ruta que generó este certificado
    pathTitle?: string; // Título de la ruta
    score: number;
    verificationCode: string;
    isActive: boolean;
    issuedAt: Timestamp;
}

// Entrada del leaderboard
export interface LeaderboardEntry {
    userId: string;
    displayName: string;
    photoURL?: string;
    totalScore: number;
    certificationLevel: CertificationLevel;
    completedAt: Timestamp;
}
