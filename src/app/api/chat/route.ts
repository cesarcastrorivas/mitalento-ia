import { NextRequest, NextResponse } from 'next/server';
import { geminiModel } from '@/lib/gemini';
import { getAdminDb } from '@/lib/firebase-admin';
import { getServerUser } from '@/lib/server-auth';
import { checkRateLimit } from '@/lib/rate-limit';

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
                { error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' },
                { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetInMs / 1000)) } }
            );
        }

        const { message, history } = await req.json();

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        // Fetch system context from Firestore using Admin SDK (server-side)
        let systemInstruction = '';
        try {
            const db = getAdminDb();
            const docSnap = await db.collection('knowledge_base').doc('sofia').get();
            if (docSnap.exists) {
                systemInstruction = docSnap.data()?.content || '';
            }
        } catch (error) {
            console.error('Error fetching knowledge base:', error);
            systemInstruction = 'Eres Bally IA, una asistente inteligente útil.';
        }

        let prompt = `INSTRUCCIONES DEL SISTEMA:
${systemInstruction || 'Eres Bally IA, una asistente inteligente, amigable y experta.'}

IMPORTANTE: TU PERSONALIDAD Y FORMATO DE RESPUESTA
1.  **Tono Cercano y Amigable**: Háblame como si fuéramos amigos cercanos chateando por WhatsApp. Usa un lenguaje natural, cálido y empático.
2.  **Estructura Clara**: NO uses bloques de texto gigantes. Usa párrafos cortos y espaciados.
3.  **Uso de Negritas**: Resalta las ideas clave o palabras importantes con **negritas** para facilitar la lectura rápida.
4.  **Emojis**: Usa emojis de forma natural para darle vida a la conversación, pero sin exagerar (🎯  ✨  🚀  💡).
5.  **Listas**: Cuando expliques varios puntos, usa listas con viñetas (•) o emojis.

Ejemplo de cómo debes responder:
"¡Hola! Claron que sí, aquí tienes la info que buscabas 🚀

**Punto importante 1**
Explicación breve y directa.

**Punto importante 2**
Otra explicación útil.

¿Te sirve esto? Avísame si necesitas algo más 😉"

SIGUE ESTE FORMATO SIEMPRE.
\n\n`;
        prompt += `HISTORIAL DE CONVERSACIÓN:\n`;

        if (Array.isArray(history)) {
            history.forEach((msg: any) => {
                prompt += `${msg.role === 'user' ? 'Usuario' : 'Bally IA'}: ${msg.content}\n`;
            });
        }

        prompt += `\nUsuario: ${message}\nBally IA:`;

        const result = await geminiModel.generateContent(prompt);
        const response = result.response.text();

        return NextResponse.json({ response });

    } catch (error) {
        console.error('Error in chat API:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
