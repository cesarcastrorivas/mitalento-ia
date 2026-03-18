'use client';

import { useMemo } from 'react';
import { Target, Rocket, Zap, Trophy, Flame, Sparkles } from 'lucide-react';

const phrases = [
    { text: 'El éxito no es una opción, es tu obligación. ¡Acción masiva!', icon: Flame, color: 'text-orange-400' },
    { text: 'No te conformes con lo promedio. Multiplica tus metas por 10X.', icon: Rocket, color: 'text-indigo-300' },
    { text: 'Mientras otros duermen, tú estás construyendo un imperio.', icon: Zap, color: 'text-amber-400' },
    { text: 'La obsesión no es una enfermedad, es un don. ¡Úsalo!', icon: Sparkles, color: 'text-purple-400' },
    { text: 'Los que dicen que es imposible nunca lo intentaron con todo.', icon: Trophy, color: 'text-yellow-400' },
    { text: 'No necesitas suerte, necesitas acción masiva. ¡AHORA!', icon: Target, color: 'text-rose-400' },
    { text: 'Tu competencia debería preocuparse, no tú. Domina el juego.', icon: Target, color: 'text-red-400' },
    { text: 'El miedo es un indicador: estás a punto de crecer. ¡Hazlo!', icon: Zap, color: 'text-amber-400' },
    { text: 'Deja de pensar en pequeño. Piensa en GRANDE, actúa en GRANDE.', icon: Rocket, color: 'text-blue-400' },
    { text: 'No sigas el plan B. Haz que el plan A funcione con todo.', icon: Flame, color: 'text-orange-400' },
];

interface MotivationalPhraseProps {
    className?: string;
}

export function MotivationalPhrase({ className }: MotivationalPhraseProps) {
    const phraseObj = useMemo(
        () => phrases[Math.floor(Math.random() * phrases.length)],
        [] // stable per mount — no re-roll on re-renders
    );

    const Icon = phraseObj.icon;

    return (
        <p className={`${className || ''} flex items-center md:items-start xl:items-center gap-2 flex-wrap`}>
            {phraseObj.text}
            <Icon className={`w-5 h-5 ${phraseObj.color} flex-shrink-0 inline-block`} strokeWidth={2.5} />
        </p>
    );
}
