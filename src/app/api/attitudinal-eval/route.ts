import { NextRequest, NextResponse } from 'next/server';
import { geminiModel } from '@/lib/gemini';

export async function POST(req: NextRequest) {
    try {
        const { userId, responses } = await req.json();

        if (!userId || !responses || !Array.isArray(responses)) {
            return NextResponse.json(
                { error: 'userId and responses[] are required' },
                { status: 400 }
            );
        }

        // Build prompt for Gemini attitudinal analysis
        const responsesText = responses
            .map((r: { question: string; answer: string }, i: number) =>
                `Pregunta ${i + 1}: ${r.question}\nRespuesta: ${r.answer}`)
            .join('\n\n');

        const prompt = `Eres un psicólogo organizacional experto en evaluación de perfiles comerciales para el sector inmobiliario.
        
Analiza las siguientes respuestas de un aspirante a asesor inmobiliario de Urbanity Academy.

RESPUESTAS DEL ASPIRANTE:
---
${responsesText}
---

CRITERIOS DE EVALUACIÓN:
1. **Motivación genuina**: ¿Demuestra interés real en el negocio inmobiliario o solo busca dinero fácil?
2. **Inteligencia emocional**: ¿Maneja el rechazo y situaciones difíciles con madurez?
3. **Ética profesional**: ¿Demuestra honestidad y valores en sus respuestas?
4. **Orientación a resultados**: ¿Tiene metas claras y mentalidad de crecimiento?
5. **Coherencia**: ¿Sus respuestas son coherentes entre sí o se contradicen?

FORMATO DE RESPUESTA (JSON ESTRICTO):
{
    "semaphore": "green" | "yellow" | "red",
    "analysis": "Análisis detallado de 3-5 líneas explicando la evaluación",
    "strengths": ["Fortaleza 1", "Fortaleza 2"],
    "concerns": ["Preocupación 1", "Preocupación 2"],
    "recommendation": "Recomendación para el supervisor"
}

CRITERIOS DEL SEMÁFORO:
- 🟢 **GREEN**: Actitud positiva, motivación genuina, buena coherencia, perfil adecuado
- 🟡 **YELLOW**: Algunas respuestas dudosas, requiere revisión del supervisor
- 🔴 **RED**: Señales de alerta claras, falta de ética, incoherencia grave

RESPONDE ÚNICAMENTE CON EL JSON. Sin texto adicional.`;

        const result = await geminiModel.generateContent([{ text: prompt }]);
        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            throw new Error('No valid JSON found in AI response');
        }

        const analysis = JSON.parse(jsonMatch[0]);

        return NextResponse.json({
            success: true,
            semaphore: analysis.semaphore,
            analysis: analysis.analysis,
            strengths: analysis.strengths || [],
            concerns: analysis.concerns || [],
            recommendation: analysis.recommendation || '',
        });

    } catch (error) {
        console.error('Error in attitudinal-eval:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Error desconocido' },
            { status: 500 }
        );
    }
}
