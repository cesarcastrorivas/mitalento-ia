import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

// ─── Security: URL validation (SSRF protection) ──────────────────────────────

/**
 * Validates that a video URL is safe to fetch.
 * Blocks internal/private IPs and non-HTTPS protocols.
 */
function validateVideoUrl(url: string): void {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        throw new Error('URL de video inválida');
    }

    if (parsed.protocol !== 'https:') {
        throw new Error('Solo se permiten URLs con protocolo HTTPS');
    }

    const host = parsed.hostname.toLowerCase();

    // Block loopback, link-local, and common cloud metadata endpoints
    const blockedExact = ['localhost', '0.0.0.0', '::1'];
    if (blockedExact.includes(host)) {
        throw new Error('URL de video no permitida');
    }

    const blockedPrefixes = ['127.', '169.254.']; // loopback, link-local/metadata
    if (blockedPrefixes.some(p => host.startsWith(p))) {
        throw new Error('URL de video no permitida');
    }

    // Block RFC-1918 private ranges: 10.x, 172.16–31.x, 192.168.x
    const octets = host.split('.').map(Number);
    if (octets.length === 4 && octets.every(n => !isNaN(n))) {
        const [a, b] = octets;
        if (a === 10) throw new Error('URL de video no permitida');
        if (a === 172 && b >= 16 && b <= 31) throw new Error('URL de video no permitida');
        if (a === 192 && b === 168) throw new Error('URL de video no permitida');
    }
}

// ─── Security: Gemini response schema validation ──────────────────────────────

/**
 * Validates and sanitizes the raw JSON returned by Gemini.
 * Prevents malformed/malicious AI output from reaching Firestore.
 */
function validateParsedQuiz(parsed: unknown): Question[] {
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Gemini: la respuesta no es un objeto JSON válido');
    }

    const obj = parsed as Record<string, unknown>;

    if (!Array.isArray(obj.questions) || obj.questions.length === 0) {
        throw new Error('Gemini: el campo "questions" debe ser un array no vacío');
    }

    if (obj.questions.length > 20) {
        throw new Error('Gemini: demasiadas preguntas en la respuesta');
    }

    return obj.questions.map((q: unknown, index: number) => {
        if (!q || typeof q !== 'object') {
            throw new Error(`Gemini: la pregunta ${index} no es un objeto válido`);
        }

        const question = q as Record<string, unknown>;

        if (typeof question.text !== 'string' || question.text.trim().length === 0) {
            throw new Error(`Gemini: la pregunta ${index} no tiene texto válido`);
        }

        if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 6) {
            throw new Error(`Gemini: la pregunta ${index} tiene opciones inválidas`);
        }

        for (const opt of question.options) {
            if (typeof opt !== 'string') {
                throw new Error(`Gemini: opción inválida en pregunta ${index}`);
            }
        }

        if (
            typeof question.correctIndex !== 'number' ||
            !Number.isInteger(question.correctIndex) ||
            question.correctIndex < 0 ||
            question.correctIndex >= (question.options as string[]).length
        ) {
            throw new Error(`Gemini: correctIndex inválido en pregunta ${index}`);
        }

        if (typeof question.explanation !== 'string') {
            throw new Error(`Gemini: la pregunta ${index} no tiene explicación`);
        }

        return {
            id: typeof question.id === 'string' ? question.id.slice(0, 50) : `q${index + 1}`,
            text: (question.text as string).slice(0, 500),
            options: (question.options as string[]).map(o => o.slice(0, 200)),
            correctIndex: question.correctIndex as number,
            explanation: (question.explanation as string).slice(0, 1000),
        };
    });
}

/** Polls Gemini until the file is ready, using exponential backoff.
 *  Throws if the file fails or the max wait time is exceeded. */
async function waitForProcessing(uploadName: string, maxWaitMs = 120_000): Promise<void> {
    const start = Date.now();
    let attempts = 0;

    let file = await fileManager.getFile(uploadName);

    while (file.state === FileState.PROCESSING) {
        if (Date.now() - start > maxWaitMs) {
            throw new Error('Timeout: el video tardó demasiado en procesarse en Gemini');
        }
        // Exponential backoff: 2s → 2.6s → 3.4s … capped at 15s
        const wait = Math.min(2000 * Math.pow(1.3, attempts), 15_000);
        await new Promise((resolve) => setTimeout(resolve, wait));
        file = await fileManager.getFile(uploadName);
        attempts++;
    }

    if (file.state === FileState.FAILED) {
        throw new Error('El procesamiento del video falló en Gemini');
    }
}

// Gemini 3.0 Flash Preview - As requested
export const geminiModel = genAI.getGenerativeModel({
    model: 'gemini-3-flash-preview',
});

export interface Question {
    id: string;
    text: string;
    options: string[];
    correctIndex: number;
    explanation: string;
}

export interface QuizGenerationResult {
    questions: Question[];
    success: boolean;
    error?: string;
}

/**
 * Downloads a file from a URL to a temporary local file
 */
async function downloadFile(url: string, suffix: string): Promise<string> {
    validateVideoUrl(url);

    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `video-${Date.now()}-${Math.random().toString(36).substring(7)}${suffix}`);

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch video: ${response.statusText}`);
    if (!response.body) throw new Error('No response body');

    // @ts-expect-error - ReadableStream to NodeJS.Readable compat
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(tempFilePath));

    return tempFilePath;
}

export async function generateQuizFromVideo(
    videoUrl: string,
    videoTitle: string,
    userId: string,
    moduleId: string,
    questionCount: number = 5
): Promise<QuizGenerationResult> {
    let tempFilePath: string | null = null;
    let fileUri: string | null = null;
    let uploadName: string | null = null;

    try {
        console.log('Downloading video for analysis:', videoTitle);
        // 1. Download video temporarily (Stream directly to file system first for File API)
        // Note: FileManager.uploadFile requires a path, not a stream currently in Node implementation usually
        tempFilePath = await downloadFile(videoUrl, '.mp4');

        console.log('Uploading to Gemini:', tempFilePath);

        // 2. Upload to Gemini
        const uploadResult = await fileManager.uploadFile(tempFilePath, {
            mimeType: 'video/mp4',
            displayName: `Module: ${videoTitle}`,
        });

        fileUri = uploadResult.file.uri;
        uploadName = uploadResult.file.name;

        console.log('Uploaded video URI:', fileUri);

        // 3. Wait for processing
        console.log('Waiting for Gemini to process video...');
        await waitForProcessing(uploadName);
        const file = await fileManager.getFile(uploadName);

        console.log('Video processed. Generating quiz...');

        // 4. Generate Quiz
        const seed = `${userId}-${moduleId}-${Date.now()}`;
        const prompt = `Eres un evaluador educativo corporativo de ALTA PRECISIÓN. Tu tarea es analizar este video y generar ${questionCount} preguntas de evaluación.

TÍTULO DEL VIDEO: ${videoTitle}

═══════════════════════════════════════════════════════════════════
⚠️ REGLAS CRÍTICAS ANTI-ALUCINACIÓN (OBLIGATORIAS)
═══════════════════════════════════════════════════════════════════
1. SOLO genera preguntas sobre información que REALMENTE aparece en el video.
2. NO inventes datos, cifras, nombres, fechas o conceptos que NO estén en el video.
3. Si no hay suficiente contenido para ${questionCount} preguntas, genera MENOS pero precisas.
4. Cada respuesta correcta DEBE ser verificable viendo/escuchando el video.
5. Antes de escribir cada pregunta, verifica mentalmente: "¿Esto está en el video?"

═══════════════════════════════════════════════════════════════════
📋 CRITERIOS DE CALIDAD
═══════════════════════════════════════════════════════════════════
• VERIFICABILIDAD: Cada pregunta debe poder responderse SOLO con el video.
• COMPRENSIÓN: Evalúa entendimiento, NO memorización textual.
• RELEVANCIA: Cubre los puntos MÁS IMPORTANTES del contenido.
• CLARIDAD: Una sola respuesta correcta, sin ambigüedad.
• VARIEDAD: Mezcla preguntas conceptuales, de aplicación y de análisis.

═══════════════════════════════════════════════════════════════════
🎯 FORMATO DE DISTRACTORES (Opciones Incorrectas)
═══════════════════════════════════════════════════════════════════
Las opciones incorrectas deben ser:
• PLAUSIBLES: Suenan razonables para alguien que no vio el video.
• DISTINGUIBLES: Claramente incorrectas para quien SÍ vio el video.
• NO ABSURDAS: Evita opciones obviamente ridículas o fuera de contexto.

═══════════════════════════════════════════════════════════════════
📝 FORMATO DE RESPUESTA (JSON ESTRICTO)
═══════════════════════════════════════════════════════════════════
{
  "questions": [
    {
      "id": "q1",
      "text": "Pregunta clara y específica basada en el video",
      "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "correctIndex": 0,
      "explanation": "Explicación breve indicando POR QUÉ es correcta y dónde se menciona en el video"
    }
  ]
}

SEED DE VARIACIÓN: ${seed}
Usa este seed para variar la redacción, el orden de opciones y el enfoque de las preguntas.

RESPONDE ÚNICAMENTE CON EL JSON. Sin texto adicional antes o después.`;

        const result = await geminiModel.generateContent([
            { fileData: { mimeType: file.mimeType, fileUri: file.uri } },
            { text: prompt }
        ]);

        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            throw new Error('No valid JSON found in response');
        }

        const questions = validateParsedQuiz(JSON.parse(jsonMatch[0]));

        // Cleanup Gemini file (Async, don't wait)
        fileManager.deleteFile(uploadName).catch(console.error);

        return { questions, success: true };

    } catch (error) {
        console.error('Error in generateQuizFromVideo:', error);
        return {
            questions: [],
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    } finally {
        // Cleanup local temp file
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
    }
}

export interface TranscriptionResult {
    text: string;
    success: boolean;
    error?: string;
}

export async function transcribeVideo(
    videoUrl: string,
    videoTitle: string
): Promise<TranscriptionResult> {
    let tempFilePath: string | null = null;
    let fileUri: string | null = null;
    let uploadName: string | null = null;

    try {
        console.log('Downloading video for transcription:', videoTitle);
        tempFilePath = await downloadFile(videoUrl, '.mp4');

        console.log('Uploading to Gemini:', tempFilePath);
        const uploadResult = await fileManager.uploadFile(tempFilePath, {
            mimeType: 'video/mp4',
            displayName: `Transcription: ${videoTitle}`,
        });

        fileUri = uploadResult.file.uri;
        uploadName = uploadResult.file.name;

        console.log('Uploaded video URI:', fileUri);

        // Wait for processing
        console.log('Waiting for Gemini to process video for transcription...');
        await waitForProcessing(uploadName);
        const file = await fileManager.getFile(uploadName);

        console.log('Video processed. Generating transcription...');

        const prompt = `Genera una transcripción detallada y precisa de todo el audio de este video.
        - Si hay diferentes hablantes, trata de distinguirlos si es posible (ej: Hablante 1, Hablante 2).
        - Incluye signos de puntuación adecuados.
        - El texto debe ser fluido y legible.
        - Si hay texto importante en pantalla que no se dice en voz alta, puedes incluirlo entre corchetes [Texto en pantalla: ...].`;

        const result = await geminiModel.generateContent([
            { fileData: { mimeType: file.mimeType, fileUri: file.uri } },
            { text: prompt }
        ]);

        const text = result.response.text();

        // Cleanup Gemini file
        fileManager.deleteFile(uploadName).catch(console.error);

        return { text, success: true };

    } catch (error) {
        console.error('Error in transcribeVideo:', error);
        return {
            text: '',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    } finally {
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
        }
    }
}

/**
 * Generates a quiz from a stored transcription text (no video processing needed).
 * Much faster and cheaper than generateQuizFromVideo.
 */
export async function generateQuizFromTranscription(
    transcription: string,
    videoTitle: string,
    userId: string,
    moduleId: string,
    questionCount: number = 5,
    videoContext?: string
): Promise<QuizGenerationResult> {
    try {
        console.log('Generating quiz from transcription for:', videoTitle);

        const seed = `${userId}-${moduleId}-${Date.now()}`;
        const contextToAdd = videoContext && videoContext.trim() !== ''
            ? `\nCONTEXTO ADICIONAL / DIRECTRICES DEL ADMINISTRADOR:\n---\n${videoContext}\n---\n`
            : '';

        const prompt = `Eres un evaluador educativo corporativo de ALTA PRECISIÓN. Tu tarea es analizar la siguiente transcripción de un video y generar ${questionCount} preguntas de evaluación.${contextToAdd}

TÍTULO DEL VIDEO: ${videoTitle}

TRANSCRIPCIÓN DEL VIDEO:
---
${transcription}
---

═══════════════════════════════════════════════════════════════════
⚠️ REGLAS CRÍTICAS ANTI-ALUCINACIÓN (OBLIGATORIAS)
═══════════════════════════════════════════════════════════════════
1. SOLO genera preguntas sobre información que REALMENTE aparece en la transcripción.
2. NO inventes datos, cifras, nombres, fechas o conceptos que NO estén en el texto.
3. Si no hay suficiente contenido para ${questionCount} preguntas, genera MENOS pero precisas.
4. Cada respuesta correcta DEBE ser verificable leyendo la transcripción.
5. Antes de escribir cada pregunta, verifica mentalmente: "¿Esto está en la transcripción?"

═══════════════════════════════════════════════════════════════════
📋 CRITERIOS DE CALIDAD
═══════════════════════════════════════════════════════════════════
• VERIFICABILIDAD: Cada pregunta debe poder responderse SOLO con la transcripción.
• COMPRENSIÓN: Evalúa entendimiento, NO memorización textual.
• RELEVANCIA: Cubre los puntos MÁS IMPORTANTES del contenido.
• CLARIDAD: Una sola respuesta correcta, sin ambigüedad.
• VARIEDAD: Mezcla preguntas conceptuales, de aplicación y de análisis.

═══════════════════════════════════════════════════════════════════
🎯 FORMATO DE DISTRACTORES (Opciones Incorrectas)
═══════════════════════════════════════════════════════════════════
Las opciones incorrectas deben ser:
• PLAUSIBLES: Suenan razonables para alguien que no leyó la transcripción.
• DISTINGUIBLES: Claramente incorrectas para quien SÍ la leyó.
• NO ABSURDAS: Evita opciones obviamente ridículas o fuera de contexto.

═══════════════════════════════════════════════════════════════════
📝 FORMATO DE RESPUESTA (JSON ESTRICTO)
═══════════════════════════════════════════════════════════════════
{
  "questions": [
    {
      "id": "q1",
      "text": "Pregunta clara y específica basada en la transcripción",
      "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "correctIndex": 0,
      "explanation": "Explicación breve indicando POR QUÉ es correcta y dónde se menciona en la transcripción"
    }
  ]
}

SEED DE VARIACIÓN: ${seed}
Usa este seed para variar la redacción, el orden de opciones y el enfoque de las preguntas.

RESPONDE ÚNICAMENTE CON EL JSON. Sin texto adicional antes o después.`;

        const result = await geminiModel.generateContent([
            { text: prompt }
        ]);

        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            throw new Error('No valid JSON found in response');
        }

        const questions = validateParsedQuiz(JSON.parse(jsonMatch[0]));

        return { questions, success: true };

    } catch (error) {
        console.error('Error in generateQuizFromTranscription:', error);
        return {
            questions: [],
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
