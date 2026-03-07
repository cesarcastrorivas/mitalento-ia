'use client';

import { useMemo } from 'react';

const phrases = [
    'El éxito no es una opción, es tu obligación. ¡Acción masiva! 🔥',
    'No te conformes con lo promedio. Multiplica tus metas por 10X. 🚀',
    'Mientras otros duermen, tú estás construyendo un imperio. 💪',
    'La obsesión no es una enfermedad, es un don. ¡Úsalo! ⚡',
    'Los que dicen que es imposible nunca lo intentaron con todo. 🏆',
    'No necesitas suerte, necesitas acción masiva. ¡AHORA! 🎯',
    'Tu competencia debería preocuparse, no tú. Domina el juego. 👊',
    'El miedo es un indicador: estás a punto de crecer. ¡Hazlo! 💥',
    'Deja de pensar en pequeño. Piensa en GRANDE, actúa en GRANDE. 🦁',
    'No sigas el plan B. Haz que el plan A funcione con todo. 🔥',
];

interface MotivationalPhraseProps {
    className?: string;
}

export function MotivationalPhrase({ className }: MotivationalPhraseProps) {
    const phrase = useMemo(
        () => phrases[Math.floor(Math.random() * phrases.length)],
        [] // stable per mount — no re-roll on re-renders
    );

    return <p className={className}>{phrase}</p>;
}
