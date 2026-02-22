import { NextRequest, NextResponse } from 'next/server';
import { geminiModel } from '@/lib/gemini';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function POST(req: NextRequest) {
    try {
        const { message, history } = await req.json();

        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        // 1. Fetch System Context from Firestore
        let systemInstruction = '';
        try {
            // Note: We're using the admin SDK or client SDK in a server environment. 
            // Since @/lib/firebase exports the client SDK initialized app, it works in Next.js API routes 
            // (Standard Tier) but strictly speaking for production usually Admin SDK is better.
            // However, existing code uses client SDK in pages, so it should work here too if env vars are set.
            // But 'getDoc' is client SDK. API routes run in Node environment.
            // We need to ensure simple fetch works.
            const docRef = doc(db, 'knowledge_base', 'sofia');
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                systemInstruction = docSnap.data().content || '';
            }
        } catch (error) {
            console.error('Error fetching knowledge base:', error);
            // Fallback to basic instruction if DB fails
            systemInstruction = 'Eres SofIA, una asistente inteligente útil.';
        }

        // 2. Construct Chat Prompt
        // Gemini API supports 'chat' mode with history, but stateless generateContent is easier for simple Vercel functions
        // unless we want to manage full history tokens ourselves.
        // We will construct a text prompt with history.

        let prompt = `INSTRUCCIONES DEL SISTEMA:
${systemInstruction || 'Eres SofIA, una asistente inteligente, amigable y experta.'}

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
                prompt += `${msg.role === 'user' ? 'Usuario' : 'SofIA'}: ${msg.content}\n`;
            });
        }

        prompt += `\nUsuario: ${message}\nSofIA:`;

        // 3. Call Gemini
        const result = await geminiModel.generateContent(prompt);
        const response = result.response.text();

        return NextResponse.json({ response });

    } catch (error) {
        console.error('Error in chat API:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
