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
        let file = await fileManager.getFile(uploadName);
        while (file.state === FileState.PROCESSING) {
            console.log('Processing video...');
            await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2s
            file = await fileManager.getFile(uploadName);
        }

        if (file.state === FileState.FAILED) {
            throw new Error('Video processing failed on Gemini');
        }

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

        const parsed = JSON.parse(jsonMatch[0]);

        const questions: Question[] = parsed.questions.map((q: Question, index: number) => ({
            ...q,
            id: q.id || `q${index + 1}-${Date.now()}`
        }));

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
        let file = await fileManager.getFile(uploadName);
        while (file.state === FileState.PROCESSING) {
            console.log('Processing video for transcription...');
            await new Promise((resolve) => setTimeout(resolve, 2000));
            file = await fileManager.getFile(uploadName);
        }

        if (file.state === FileState.FAILED) {
            throw new Error('Video processing failed on Gemini');
        }

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
    questionCount: number = 5
): Promise<QuizGenerationResult> {
    try {
        console.log('Generating quiz from transcription for:', videoTitle);

        const seed = `${userId}-${moduleId}-${Date.now()}`;
        const prompt = `Eres un evaluador educativo corporativo de ALTA PRECISIÓN. Tu tarea es analizar la siguiente transcripción de un video y generar ${questionCount} preguntas de evaluación.

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

        const parsed = JSON.parse(jsonMatch[0]);

        const questions: Question[] = parsed.questions.map((q: Question, index: number) => ({
            ...q,
            id: q.id || `q${index + 1}-${Date.now()}`
        }));

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
