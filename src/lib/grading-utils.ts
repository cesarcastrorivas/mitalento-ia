import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FIXED_PATHS } from '@/lib/constants';

// ═══════════════════════════════════════════════════
// Grading Utilities — Lógica centralizada de validación
// Reglas:
//   Módulo aprobado: score ≥ max(80, passingScore)
//   Curso aprobado:  TODOS sus módulos aprobados
//   Ruta aprobada:   TODOS sus cursos aprobados
//   Certificado:     Solo si la ruta está aprobada
// ═══════════════════════════════════════════════════

const MIN_PASSING_SCORE = 80;

/**
 * Calcula el score mínimo real para aprobar un módulo.
 * Siempre es al menos 80%, pero puede ser mayor si el admin lo configuró así.
 */
export function getEffectivePassingScore(modulePassingScore: number): number {
    return Math.max(MIN_PASSING_SCORE, modulePassingScore);
}

/**
 * Verifica si un módulo está aprobado basándose en las sesiones del usuario.
 * Un módulo se considera aprobado si tiene al menos una sesión con passed = true
 * y score >= max(80, passingScore del módulo).
 */
export function isModulePassedByScore(score: number, modulePassingScore: number): boolean {
    const effectiveMin = getEffectivePassingScore(modulePassingScore);
    return score >= effectiveMin;
}

/**
 * Dado un set de IDs de módulos aprobados y los IDs de módulos de un curso,
 * verifica si TODOS los módulos del curso están aprobados.
 */
export function isCourseCompleted(
    passedModuleIds: Set<string>,
    courseModuleIds: string[]
): boolean {
    if (courseModuleIds.length === 0) return false;
    return courseModuleIds.every(moduleId => passedModuleIds.has(moduleId));
}

/**
 * Verifica si TODOS los cursos de una ruta están completos.
 * Recibe los cursos de la ruta (con sus módulos) y el set de módulos aprobados.
 */
export function isPathCompleted(
    coursesWithModules: { courseId: string; moduleIds: string[]; isOptional: boolean }[],
    passedModuleIds: Set<string>
): boolean {
    // Solo cursos obligatorios deben estar completados
    const requiredCourses = coursesWithModules.filter(c => !c.isOptional);
    if (requiredCourses.length === 0) return false;
    return requiredCourses.every(course =>
        isCourseCompleted(passedModuleIds, course.moduleIds)
    );
}

/**
 * Después de que un módulo es aprobado, verifica en cascada:
 * 1. ¿El curso del módulo está completo?
 * 2. Si sí, ¿la ruta del curso está completa?
 * 3. Si sí, actualiza el usuario con la ruta/curso completados.
 *
 * Retorna un objeto indicando qué se completó.
 */
export async function checkCascadeCompletion(
    userId: string,
    moduleId: string,
    courseId: string
): Promise<{
    courseCompleted: boolean;
    pathCompleted: boolean;
    completedCourseId?: string;
    completedPathId?: string;
}> {
    const result = {
        courseCompleted: false,
        pathCompleted: false,
        completedCourseId: undefined as string | undefined,
        completedPathId: undefined as string | undefined,
    };

    try {
        // 1. Obtener todos los módulos activos del mismo curso
        const modulesQ = query(
            collection(db, 'modules'),
            where('courseId', '==', courseId),
            where('isActive', '==', true)
        );
        const modulesSnap = await getDocs(modulesQ);
        const courseModuleIds = modulesSnap.docs.map(d => d.id);

        // 2. Obtener las sesiones aprobadas del usuario
        const sessionsQ = query(
            collection(db, 'quiz_sessions'),
            where('userId', '==', userId),
            where('passed', '==', true)
        );
        const sessionsSnap = await getDocs(sessionsQ);
        const passedModuleIds = new Set<string>();
        sessionsSnap.docs.forEach(d => {
            passedModuleIds.add(d.data().moduleId);
        });

        // 3. ¿El curso está completo?
        if (!isCourseCompleted(passedModuleIds, courseModuleIds)) {
            return result;
        }

        result.courseCompleted = true;
        result.completedCourseId = courseId;

        // 4. Obtener el pathId del curso
        const courseDoc = await getDoc(doc(db, 'courses', courseId));
        if (!courseDoc.exists()) return result;
        const pathId = courseDoc.data().pathId;
        if (!pathId) return result;

        // 5. Obtener todos los cursos activos de la ruta
        const coursesQ = query(
            collection(db, 'courses'),
            where('pathId', '==', pathId),
            where('isActive', '==', true)
        );
        const coursesSnap = await getDocs(coursesQ);

        // 6. Construir estructura de cursos con sus módulos
        const coursesWithModules: { courseId: string; moduleIds: string[]; isOptional: boolean }[] = [];

        for (const cDoc of coursesSnap.docs) {
            const cData = cDoc.data();
            const cModulesQ = query(
                collection(db, 'modules'),
                where('courseId', '==', cDoc.id),
                where('isActive', '==', true)
            );
            const cModulesSnap = await getDocs(cModulesQ);
            coursesWithModules.push({
                courseId: cDoc.id,
                moduleIds: cModulesSnap.docs.map(d => d.id),
                isOptional: cData.isOptional || false,
            });
        }

        // 7. ¿La ruta está completa?
        if (!isPathCompleted(coursesWithModules, passedModuleIds)) {
            // Aún así actualizar el curso como completado en el usuario
            await updateUserCompletedCourses(userId, courseId);
            return result;
        }

        result.pathCompleted = true;
        result.completedPathId = pathId;

        // 8. Obtener el nivel de certificación de la ruta
        let pathObj = FIXED_PATHS.find((p: any) => p.id === pathId);
        if (!pathObj) {
            const dynamicPathDoc = await getDoc(doc(db, 'learning_paths', pathId));
            if (dynamicPathDoc.exists()) {
                pathObj = { id: dynamicPathDoc.id, ...dynamicPathDoc.data() } as any;
            }
        }
        const pathCertLevel = pathObj ? pathObj.certificationLevel : null;

        // 9. Actualizar usuario con curso y ruta completados + certificationLevel
        await updateUserCompletedCourses(userId, courseId);
        await updateUserCompletedPaths(userId, pathId, pathCertLevel);

        return result;
    } catch (error) {
        console.error('Error in checkCascadeCompletion:', error);
        return result;
    }
}

/**
 * Agrega un courseId al array de cursos completados del usuario (sin duplicados).
 */
async function updateUserCompletedCourses(userId: string, courseId: string) {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return;

        const userData = userSnap.data();
        const completedCourses: string[] = userData.completedCourses || [];

        if (!completedCourses.includes(courseId)) {
            completedCourses.push(courseId);
            await updateDoc(userRef, { completedCourses });
        }
    } catch (error) {
        console.error('Error updating completed courses:', error);
    }
}

/**
 * Agrega un pathId al array de rutas completadas del usuario (sin duplicados).
 * También actualiza el certificationLevel del usuario si la ruta tiene un nivel configurado.
 */
async function updateUserCompletedPaths(userId: string, pathId: string, certificationLevel?: string | null) {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return;

        const userData = userSnap.data();
        const completedPaths: string[] = userData.completedPaths || [];

        const updates: Record<string, any> = {};

        if (!completedPaths.includes(pathId)) {
            completedPaths.push(pathId);
            updates.completedPaths = completedPaths;
        }

        // Auto-actualizar certificationLevel basado en el nivel de la ruta completada
        if (certificationLevel) {
            const LEVEL_ORDER = ['none', 'fundamental', 'professional', 'elite'];
            const currentLevel = userData.certificationLevel || 'none';
            const currentIdx = LEVEL_ORDER.indexOf(currentLevel);
            const newIdx = LEVEL_ORDER.indexOf(certificationLevel);
            // Solo subir de nivel, nunca bajar
            if (newIdx > currentIdx) {
                updates.certificationLevel = certificationLevel;
            }
        }

        if (Object.keys(updates).length > 0) {
            await updateDoc(userRef, updates);
        }
    } catch (error) {
        console.error('Error updating completed paths:', error);
    }
}

/**
 * Validación server-side completa: ¿El usuario puede generar un certificado?
 * Si se proporciona pathId, verifica esa ruta específica.
 * Si no, busca cualquier ruta completada.
 * Retorna información sobre la ruta completada incluyendo su certificationLevel.
 */
export async function canGenerateCertificate(userId: string, targetPathId?: string): Promise<{
    eligible: boolean;
    completedPathId?: string;
    pathTitle?: string;
    certificationLevel?: string;
    averageScore: number;
    reason?: string;
}> {
    try {
        // 1. Obtener datos del usuario
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) {
            return { eligible: false, averageScore: 0, reason: 'Usuario no encontrado' };
        }
        const userData = userDoc.data();
        const assignedPathIds: string[] = userData.assignedPathIds || [];

        // 2. Obtener todas las sesiones aprobadas del usuario
        const sessionsQ = query(
            collection(db, 'quiz_sessions'),
            where('userId', '==', userId),
            where('passed', '==', true)
        );
        const sessionsSnap = await getDocs(sessionsQ);
        const passedModuleIds = new Set<string>();
        let totalScore = 0;
        sessionsSnap.docs.forEach(d => {
            const data = d.data();
            passedModuleIds.add(data.moduleId);
            totalScore += data.score;
        });
        const averageScore = sessionsSnap.docs.length > 0
            ? Math.round(totalScore / sessionsSnap.docs.length)
            : 0;

        // 3. Obtener rutas activas (Fijas + Dinámicas si las hay)
        let paths = [...FIXED_PATHS] as any[];

        const dynamicPathsQ = query(collection(db, 'learning_paths'), where('isActive', '==', true));
        const dynamicPathsSnap = await getDocs(dynamicPathsQ);
        const dynamicPaths = dynamicPathsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        paths = [...paths, ...dynamicPaths];

        // Si se especificó un pathId, filtrar solo esa ruta
        if (targetPathId) {
            paths = paths.filter((p: any) => p.id === targetPathId);
        }

        // 4. Para cada ruta, verificar si está completa
        for (const path of paths) {
            const coursesQ = query(
                collection(db, 'courses'),
                where('pathId', '==', path.id),
                where('isActive', '==', true)
            );
            const coursesSnap = await getDocs(coursesQ);

            const coursesWithModules: { courseId: string; moduleIds: string[]; isOptional: boolean }[] = [];

            for (const cDoc of coursesSnap.docs) {
                const cData = cDoc.data();
                const cModulesQ = query(
                    collection(db, 'modules'),
                    where('courseId', '==', cDoc.id),
                    where('isActive', '==', true)
                );
                const cModulesSnap = await getDocs(cModulesQ);
                coursesWithModules.push({
                    courseId: cDoc.id,
                    moduleIds: cModulesSnap.docs.map(d => d.id),
                    isOptional: cData.isOptional || false,
                });
            }

            if (isPathCompleted(coursesWithModules, passedModuleIds)) {
                return {
                    eligible: true,
                    completedPathId: path.id,
                    pathTitle: (path as any).title,
                    certificationLevel: (path as any).certificationLevel || 'fundamental',
                    averageScore,
                };
            }
        }

        return {
            eligible: false,
            averageScore,
            reason: targetPathId
                ? 'No has completado todos los módulos de esta ruta'
                : 'No has completado todos los módulos de ninguna ruta asignada',
        };
    } catch (error) {
        console.error('Error in canGenerateCertificate:', error);
        return { eligible: false, averageScore: 0, reason: 'Error al verificar elegibilidad' };
    }
}
