import { NextRequest, NextResponse } from 'next/server';
import { geminiModel } from '@/lib/gemini';
import { db } from '@/lib/firebase';
import { addDoc, collection, Timestamp } from 'firebase/firestore';

export async function POST(req: NextRequest) {
    try {
        const { userId, userName, targetIncome, callsPerDay, appointmentsPerWeek, closingsPerMonth } = await req.json();

        if (!userId || !targetIncome) {
            return NextResponse.json({ error: 'userId and targetIncome are required' }, { status: 400 });
        }

        const prompt = `Eres un coach comercial experto del sector inmobiliario en México, especializado en el modelo de negocio de Urbanity.

Genera un plan de acción 30-60-90 días personalizado para ${userName || 'el asesor'}.

DATOS DEL ASESOR:
- Meta de ingreso mensual: $${targetIncome.toLocaleString()} MXN
- Llamadas diarias requeridas: ${callsPerDay}
- Citas semanales requeridas: ${appointmentsPerWeek}
- Cierres mensuales requeridos: ${closingsPerMonth}

FORMATO DE RESPUESTA (JSON ESTRICTO):
{
    "plan30": "Plan detallado de los primeros 30 días (fase de arranque). 5-7 acciones concretas con métricas específicas para cada semana.",
    "plan60": "Plan detallado de los días 31-60 (fase de aceleración). Optimización de resultados, ajustes de estrategia, metas incrementales.",
    "plan90": "Plan detallado de los días 61-90 (fase de consolidación). Escalar resultados, construir pipeline sólido, mentoría."
}

REQUISITOS:
- Sé concreto y accionable (no frases genéricas)
- Incluye métricas específicas por semana
- Usa el contexto del sector inmobiliario mexicano
- Incluye presupuesto de marketing digital sugerido
- Menciona herramientas específicas de Urbanity
- Cada plan debe tener entre 300-500 caracteres

RESPONDE ÚNICAMENTE CON EL JSON. Sin texto adicional.`;

        const result = await geminiModel.generateContent([{ text: prompt }]);
        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            throw new Error('No valid JSON in AI response');
        }

        const planData = JSON.parse(jsonMatch[0]);

        // Save to Firestore
        await addDoc(collection(db, 'action_plans'), {
            userId,
            targetIncome,
            callsPerDay,
            appointmentsPerWeek,
            closingsPerMonth,
            plan30: planData.plan30,
            plan60: planData.plan60,
            plan90: planData.plan90,
            createdAt: Timestamp.now(),
        });

        return NextResponse.json({
            success: true,
            plan30: planData.plan30,
            plan60: planData.plan60,
            plan90: planData.plan90,
        });

    } catch (error) {
        console.error('Error generating action plan:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Error desconocido' },
            { status: 500 }
        );
    }
}
