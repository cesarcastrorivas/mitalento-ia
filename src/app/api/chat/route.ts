import { NextRequest, NextResponse } from 'next/server';
import { genAI } from '@/lib/gemini';
import { getAdminDb } from '@/lib/firebase-admin';
import { getServerUser } from '@/lib/server-auth';
import { checkRateLimit } from '@/lib/rate-limit';

// ─── Knowledge Base Cache (TTL: 5 min) ────────────────────────────────────────
interface KBCache {
    data: KnowledgeBase | null;
    fetchedAt: number;
}

interface KnowledgeBase {
    // New structured format
    identity?: string;
    projectData?: string;
    salesPitch?: string;
    faq?: string;
    restrictions?: string;
    // Legacy format (fallback)
    content?: string;
}

const KB_TTL_MS = 5 * 60 * 1000; // 5 minutes
let kbCache: KBCache = { data: null, fetchedAt: 0 };

async function getKnowledgeBase(): Promise<KnowledgeBase> {
    const now = Date.now();

    // Return cached if still valid
    if (kbCache.data && (now - kbCache.fetchedAt) < KB_TTL_MS) {
        return kbCache.data;
    }

    try {
        const db = getAdminDb();
        const docSnap = await db.collection('knowledge_base').doc('sofia').get();

        if (docSnap.exists) {
            const data = docSnap.data() as KnowledgeBase;
            kbCache = { data, fetchedAt: now };
            return data;
        }
    } catch (error) {
        console.error('Error fetching knowledge base:', error);
        // If cache exists but expired, still use it as fallback
        if (kbCache.data) return kbCache.data;
    }

    return {};
}

// ─── Fixed formatting instructions (not admin-editable) ───────────────────────
const FORMAT_INSTRUCTIONS = `
FORMATO DE RESPUESTA OBLIGATORIO:
1. **Tono Cercano y Profesional**: Responde como un colega experto. Lenguaje natural, claro y directo.
2. **Estructura Clara**: Parrafos cortos y espaciados. NO bloques de texto gigantes.
3. **Negritas**: Resalta ideas clave con **negritas** para lectura rapida.
4. **Emojis**: Usa emojis con moderacion para darle vida a la conversacion.
5. **Listas**: Cuando expliques varios puntos, usa listas con vinetas o emojis.
6. **Precision**: NUNCA inventes datos que no esten en tu base de conocimiento. Si no sabes algo, dilo honestamente.
7. **Foco comercial**: Eres una herramienta para asesores de ventas. Prioriza informacion util para cerrar ventas.
`.trim();

// ─── Build system instruction from structured KB ──────────────────────────────
function buildSystemInstruction(kb: KnowledgeBase): string {
    // FALLBACK: If old format (single 'content' field), use it directly
    if (kb.content && !kb.identity && !kb.projectData) {
        return `${kb.content}\n\n${FORMAT_INSTRUCTIONS}`;
    }

    // New structured format
    const sections: string[] = [];

    if (kb.identity?.trim()) {
        sections.push(`# IDENTIDAD Y ROL\n${kb.identity.trim()}`);
    } else {
        sections.push(`# IDENTIDAD Y ROL\nEres Bally IA, la asistente de inteligencia artificial especializada en ventas inmobiliarias. Tu objetivo es ayudar a los asesores comerciales con informacion precisa y rapida sobre el proyecto.`);
    }

    if (kb.projectData?.trim()) {
        sections.push(`# DATOS DEL PROYECTO\n${kb.projectData.trim()}`);
    }

    if (kb.salesPitch?.trim()) {
        sections.push(`# ARGUMENTARIO DE VENTAS\n${kb.salesPitch.trim()}`);
    }

    if (kb.faq?.trim()) {
        sections.push(`# PREGUNTAS FRECUENTES\n${kb.faq.trim()}`);
    }

    if (kb.restrictions?.trim()) {
        sections.push(`# RESTRICCIONES Y LIMITES\nDEBES cumplir estas restricciones SIEMPRE:\n${kb.restrictions.trim()}`);
    }

    sections.push(`# INSTRUCCIONES DE FORMATO\n${FORMAT_INSTRUCTIONS}`);

    return sections.join('\n\n---\n\n');
}

// ─── Convert history to Gemini native format ──────────────────────────────────
function toGeminiHistory(history: Array<{ role: string; content: string }>): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
    if (!Array.isArray(history)) return [];

    let filteredHistory = history.filter(msg => msg.content?.trim());
    
    // Gemini startChat history MUST start with 'user' role.
    while (filteredHistory.length > 0 && filteredHistory[0].role !== 'user') {
        filteredHistory.shift();
    }

    return filteredHistory.map(msg => ({
        role: (msg.role === 'user' ? 'user' : 'model') as 'user' | 'model',
        parts: [{ text: msg.content }],
    }));
}

export async function POST(req: NextRequest) {
    try {
        const user = await getServerUser();
        if (!user) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        // 60 mensajes/hora por usuario
        const rl = await checkRateLimit(user.uid, 'chat', 60);
        if (!rl.allowed) {
            return NextResponse.json(
                { error: 'Demasiadas solicitudes. Intenta de nuevo mas tarde.' },
                { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetInMs / 1000)) } }
            );
        }

        const { message, history } = await req.json();

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        // Get knowledge base (cached, 5 min TTL)
        const kb = await getKnowledgeBase();
        const systemInstruction = buildSystemInstruction(kb);

        // Create model with native systemInstruction
        const model = genAI.getGenerativeModel({
            model: 'gemini-3.1-flash-lite-preview',
            systemInstruction,
        });

        // Use native chat with structured history
        const geminiHistory = toGeminiHistory(history || []);
        const chat = model.startChat({ history: geminiHistory });
        const result = await chat.sendMessage(message);
        const response = result.response.text();

        return NextResponse.json({ response });

    } catch (error) {
        console.error('Error in chat API:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
