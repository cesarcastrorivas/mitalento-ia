import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const apiKey = process.env.GEMINI_API_KEY || '';
export const genAI = new GoogleGenerativeAI(apiKey);
const fileManager = new GoogleAIFileManager(apiKey);

export const secondaryGenAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY_SECONDARY || apiKey);
export const secondaryFileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY_SECONDARY || apiKey);

export const secondaryGeminiModel = secondaryGenAI.getGenerativeModel({
    model: 'gemini-3.1-pro-preview',
});

// Flash-lite model for fallback on large video transcription
const secondaryGeminiFlashModel = secondaryGenAI.getGenerativeModel({
    model: 'gemini-3.1-flash-lite-preview',
});

// JSON specific model for quizzes
export const secondaryGeminiJsonModel = secondaryGenAI.getGenerativeModel({
    model: 'gemini-3.1-pro-preview',
    generationConfig: {
        responseMimeType: "application/json"
    }
});

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

    const isDev = process.env.NODE_ENV === 'development';

    if (parsed.protocol !== 'https:' && !isDev) {
        throw new Error('Solo se permiten URLs con protocolo HTTPS');
    }

    const host = parsed.hostname.toLowerCase();

    // Block loopback, link-local, and common cloud metadata endpoints
    const blockedExact = ['localhost', '0.0.0.0', '::1'];
    if (blockedExact.includes(host) && !isDev) {
        throw new Error('URL de video no permitida');
    }

    const blockedPrefixes = ['127.', '169.254.']; // loopback, link-local/metadata
    if (blockedPrefixes.some(p => host.startsWith(p)) && !isDev) {
        throw new Error('URL de video no permitida');
    }

    // Block RFC-1918 private ranges: 10.x, 172.16–31.x, 192.168.x
    const octets = host.split('.').map(Number);
    if (octets.length === 4 && octets.every(n => !isNaN(n)) && !isDev) {
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
async function waitForProcessing(uploadName: string, fbManager: GoogleAIFileManager = fileManager, maxWaitMs = 120_000): Promise<void> {
    const start = Date.now();
    let attempts = 0;

    let file = await fbManager.getFile(uploadName);

    while (file.state === FileState.PROCESSING) {
        if (Date.now() - start > maxWaitMs) {
            throw new Error('Timeout: el video tardó demasiado en procesarse en Gemini');
        }
        // Exponential backoff: 2s → 2.6s → 3.4s … capped at 15s
        const wait = Math.min(2000 * Math.pow(1.3, attempts), 15_000);
        await new Promise((resolve) => setTimeout(resolve, wait));
        file = await fbManager.getFile(uploadName);
        attempts++;
    }

    if (file.state === FileState.FAILED) {
        throw new Error('El procesamiento del video falló en Gemini');
    }
}

// Gemini 3.1 Flash Lite - As requested
export const geminiModel = genAI.getGenerativeModel({
    model: 'gemini-3.1-flash-lite-preview',
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

// ─── Resumable upload: streams file in 8 MB chunks to avoid OOM ─────────────

const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MiB (multiple of 256 KiB as required by Google)

interface UploadedFileInfo {
    name: string;
    uri: string;
    mimeType: string;
    state: string;
}

/**
 * Uploads a file to Gemini File API using resumable upload protocol.
 * Unlike the SDK's uploadFile() which loads the entire file into memory,
 * this streams the file in 8 MB chunks keeping peak memory at ~8 MB.
 */
async function resumableUploadFile(
    filePath: string,
    metadata: { mimeType: string; displayName?: string },
    geminiApiKey: string,
): Promise<{ file: UploadedFileInfo }> {
    const fileSize = fs.statSync(filePath).size;
    const baseUrl = 'https://generativelanguage.googleapis.com/upload/v1beta/files';

    console.log(`Resumable upload: ${(fileSize / 1024 / 1024).toFixed(1)} MB in ${Math.ceil(fileSize / CHUNK_SIZE)} chunks`);

    // Phase 1: Initiate resumable upload session
    const initResponse = await fetch(`${baseUrl}?key=${geminiApiKey}`, {
        method: 'POST',
        headers: {
            'X-Goog-Upload-Protocol': 'resumable',
            'X-Goog-Upload-Command': 'start',
            'X-Goog-Upload-Header-Content-Length': String(fileSize),
            'X-Goog-Upload-Header-Content-Type': metadata.mimeType,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            file: { displayName: metadata.displayName || '' },
        }),
    });

    if (!initResponse.ok) {
        const errText = await initResponse.text();
        throw new Error(`Failed to initiate resumable upload: ${initResponse.status} ${errText}`);
    }

    const uploadUrl = initResponse.headers.get('x-goog-upload-url');
    if (!uploadUrl) throw new Error('No upload URL returned from Gemini');

    // Phase 2: Upload file in chunks
    const fileHandle = await fs.promises.open(filePath, 'r');
    const buffer = Buffer.alloc(Math.min(CHUNK_SIZE, fileSize));
    let offset = 0;

    try {
        while (offset < fileSize) {
            const remaining = fileSize - offset;
            const bytesToRead = Math.min(CHUNK_SIZE, remaining);
            const isLast = remaining <= CHUNK_SIZE;

            const { bytesRead } = await fileHandle.read(buffer, 0, bytesToRead, offset);
            const chunk = buffer.subarray(0, bytesRead);

            const command = isLast ? 'upload, finalize' : 'upload';

            let chunkResponse: Response | null = null;
            // Retry up to 3 times per chunk
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    chunkResponse = await fetch(uploadUrl, {
                        method: 'POST',
                        headers: {
                            'X-Goog-Upload-Command': command,
                            'X-Goog-Upload-Offset': String(offset),
                            'Content-Length': String(bytesRead),
                        },
                        body: chunk,
                    });
                    if (chunkResponse.ok || chunkResponse.status < 500) break;
                } catch (err) {
                    if (attempt === 2) throw err;
                }
                await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
            }

            if (!chunkResponse || (!chunkResponse.ok && !isLast)) {
                throw new Error(`Chunk upload failed at offset ${offset}: ${chunkResponse?.status}`);
            }

            if (isLast) {
                const result = await chunkResponse.json();
                console.log('Resumable upload complete:', result.file?.name);
                return result as { file: UploadedFileInfo };
            }

            offset += bytesRead;
        }
    } finally {
        await fileHandle.close();
    }

    throw new Error('Upload completed without finalize response');
}

/** Resolves the API key for a given file manager instance */
function getApiKeyForManager(fmToUse: GoogleAIFileManager): string {
    if (fmToUse === secondaryFileManager) {
        return process.env.GEMINI_API_KEY_SECONDARY || apiKey;
    }
    return apiKey;
}

// ─── File download ──────────────────────────────────────────────────────────

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
    questionCount: number = 5,
    modelToUse = secondaryGeminiJsonModel,
    fmToUse = secondaryFileManager
): Promise<QuizGenerationResult> {
    let tempFilePath: string | null = null;
    let fileUri: string | null = null;
    let uploadName: string | null = null;

    try {
        console.log('Downloading video for analysis:', videoTitle);
        // 1. Download video temporarily (Stream directly to file system first for File API)
        // Note: FileManager.uploadFile requires a path, not a stream currently in Node implementation usually
        tempFilePath = await downloadFile(videoUrl, '.mp4');

        console.log('Uploading to Gemini (resumable):', tempFilePath);

        // 2. Upload to Gemini using resumable upload (memory-efficient)
        const uploadResult = await resumableUploadFile(tempFilePath, {
            mimeType: 'video/mp4',
            displayName: `Module: ${videoTitle}`,
        }, getApiKeyForManager(fmToUse));

        fileUri = uploadResult.file.uri;
        uploadName = uploadResult.file.name;

        console.log('Uploaded video URI:', fileUri);

        // 3. Wait for processing
        console.log('Waiting for Gemini to process video...');
        await waitForProcessing(uploadName, fmToUse);
        const file = await fmToUse.getFile(uploadName);

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

        const result = await modelToUse.generateContent([
            { fileData: { mimeType: file.mimeType, fileUri: file.uri } },
            { text: prompt }
        ]);

        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const rawJson = jsonMatch ? jsonMatch[0] : responseText;

        const questions = validateParsedQuiz(JSON.parse(rawJson));

        // Cleanup Gemini file (Async, don't wait)
        fmToUse.deleteFile(uploadName).catch(console.error);

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
    videoTitle: string,
    modelToUse = secondaryGeminiModel,
    fmToUse = secondaryFileManager
): Promise<TranscriptionResult> {
    let tempFilePath: string | null = null;
    let fileUri: string | null = null;
    let uploadName: string | null = null;

    try {
        const requestStart = Date.now();

        console.log('[transcribe] Downloading video:', videoTitle);
        tempFilePath = await downloadFile(videoUrl, '.mp4');
        console.log(`[transcribe] Downloaded in ${((Date.now() - requestStart) / 1000).toFixed(1)}s`);

        console.log('[transcribe] Uploading to Gemini (resumable):', tempFilePath);
        const uploadResult = await resumableUploadFile(tempFilePath, {
            mimeType: 'video/mp4',
            displayName: `Transcription: ${videoTitle}`,
        }, getApiKeyForManager(fmToUse));

        fileUri = uploadResult.file.uri;
        uploadName = uploadResult.file.name;

        // Free tmpfs immediately - file is already in Gemini
        if (tempFilePath && fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
            tempFilePath = null;
        }
        console.log(`[transcribe] Uploaded in ${((Date.now() - requestStart) / 1000).toFixed(1)}s, temp file freed`);

        // Wait for processing
        console.log('[transcribe] Waiting for Gemini to process...');
        await waitForProcessing(uploadName, fmToUse);
        const file = await fmToUse.getFile(uploadName);
        console.log(`[transcribe] Processed in ${((Date.now() - requestStart) / 1000).toFixed(1)}s. Generating transcription...`);

        const prompt = `Genera una transcripción detallada y precisa de todo el audio de este video.
        - Si hay diferentes hablantes, trata de distinguirlos si es posible (ej: Hablante 1, Hablante 2).
        - Incluye signos de puntuación adecuados.
        - El texto debe ser fluido y legible.
        - Si hay texto importante en pantalla que no se dice en voz alta, puedes incluirlo entre corchetes [Texto en pantalla: ...].`;

        const contentParts = [
            { fileData: { mimeType: file.mimeType, fileUri: file.uri } },
            { text: prompt }
        ];

        // Retry with exponential backoff + fallback to flash-lite on persistent failure
        const modelsToTry = [modelToUse, secondaryGeminiFlashModel];
        let lastError: Error | null = null;

        for (const model of modelsToTry) {
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    console.log(`[transcribe] generateContent attempt ${attempt + 1} with ${model === modelToUse ? 'pro' : 'flash-lite'}...`);
                    const result = await model.generateContent(contentParts);
                    const text = result.response.text();
                    console.log(`[transcribe] COMPLETE in ${((Date.now() - requestStart) / 1000).toFixed(1)}s, text length: ${text.length}`);

                    // Cleanup Gemini file
                    fmToUse.deleteFile(uploadName!).catch(console.error);
                    return { text, success: true };
                } catch (err) {
                    lastError = err instanceof Error ? err : new Error(String(err));
                    const isServerError = lastError.message.includes('500') || lastError.message.includes('503');
                    console.warn(`[transcribe] Attempt ${attempt + 1} failed: ${lastError.message.slice(0, 120)}`);
                    if (!isServerError) break; // Don't retry on 4xx errors
                    if (attempt < 2) await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt)));
                }
            }
            console.log(`[transcribe] All attempts failed with current model, trying next...`);
        }

        throw lastError || new Error('Transcription failed after all retries');

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
    videoContext?: string,
    modelToUse = secondaryGeminiJsonModel
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

        const result = await modelToUse.generateContent([
            { text: prompt }
        ]);

        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const rawJson = jsonMatch ? jsonMatch[0] : responseText;

        const questions = validateParsedQuiz(JSON.parse(rawJson));

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
