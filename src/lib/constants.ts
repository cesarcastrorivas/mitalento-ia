import { LearningPath } from '@/types';
import { Timestamp } from 'firebase/firestore';

export const FIXED_PATHS: LearningPath[] = [
    {
        id: 'path-fundamental',
        title: 'Cultura, Marco Legal y ADN Urbanity',
        description: 'Conoce la identidad, los valores y el marco regulatorio que nos rige como empresa. Indispensable para todo nuevo miembro de la organización.',
        icon: '🏢',
        order: 1,
        isActive: true,
        certificationLevel: 'fundamental',
        createdAt: Timestamp.fromMillis(Date.now()),
        createdBy: 'system'
    },
    {
        id: 'path-professional',
        title: 'Método Comercial Urbanity',
        description: 'Domina nuestras estrategias de ventas, prospección y cierre. Todo lo que necesitas para ser un asesor inmobiliario altamente efectivo.',
        icon: '📈',
        order: 2,
        isActive: true,
        certificationLevel: 'professional',
        createdAt: Timestamp.fromMillis(Date.now()),
        createdBy: 'system'
    },
    {
        id: 'path-elite',
        title: 'Alto Desempeño y Proyección a Liderazgo',
        description: 'Desarrolla habilidades directivas, gestión de equipos de alto rendimiento y pensamiento estratégico a largo plazo.',
        icon: '👑',
        order: 3,
        isActive: true,
        certificationLevel: 'elite',
        createdAt: Timestamp.fromMillis(Date.now()),
        createdBy: 'system'
    }
];
