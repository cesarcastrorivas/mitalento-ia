'use client';

import { useState } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LearningPath, Course, Module, User } from '@/types';

export default function MigrationPage() {
    const [status, setStatus] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const log = (msg: string) => setStatus(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);

    const migrateModules = async () => {
        setLoading(true);
        log('Iniciando migración de módulos...');
        try {
            // 1. Verificar/Crear Path General
            let pathId = '';
            const pathsQ = query(collection(db, 'learning_paths'), where('title', '==', 'Ruta General'));
            const pathsSnap = await getDocs(pathsQ);

            if (!pathsSnap.empty) {
                pathId = pathsSnap.docs[0].id;
                log(`Ruta General encontrada: ${pathId}`);
            } else {
                log('Creando Ruta General...');
                const newPath = await addDoc(collection(db, 'learning_paths'), {
                    title: 'Ruta General',
                    description: 'Ruta principal de entrenamiento',
                    icon: '🎓',
                    isActive: true,
                    order: 1,
                    createdAt: Timestamp.now(),
                    createdBy: 'migration-script'
                });
                pathId = newPath.id;
                log(`Ruta General creada: ${pathId}`);
            }

            // 2. Verificar/Crear Curso General
            let courseId = '';
            const coursesQ = query(collection(db, 'courses'), where('pathId', '==', pathId), where('title', '==', 'Curso Básico'));
            const coursesSnap = await getDocs(coursesQ);

            if (!coursesSnap.empty) {
                courseId = coursesSnap.docs[0].id;
                log(`Curso Básico encontrado: ${courseId}`);
            } else {
                log('Creando Curso Básico...');
                const newCourse = await addDoc(collection(db, 'courses'), {
                    pathId,
                    title: 'Curso Básico',
                    description: 'Fundamentos esenciales',
                    order: 1,
                    isActive: true,
                    isOptional: false,
                    createdAt: Timestamp.now(),
                    createdBy: 'migration-script'
                });
                courseId = newCourse.id;
                log(`Curso Básico creado: ${courseId}`);
            }

            // 3. Migrar Módulos Huérfanos
            // Buscamos módulos que NO tengan courseId o tengan el temporal
            const modulesSnap = await getDocs(collection(db, 'modules'));
            let updatedCount = 0;

            for (const docSnap of modulesSnap.docs) {
                const moduleData = docSnap.data() as Module;
                // Si no tiene courseId o es el temporal...
                if (!moduleData.courseId || moduleData.courseId === 'temp-default-course') {
                    await updateDoc(doc(db, 'modules', docSnap.id), {
                        courseId: courseId,
                        updatedAt: Timestamp.now()
                    });
                    updatedCount++;
                }
            }

            log(`Se actualizaron ${updatedCount} módulos.`);
            log('Migración de módulos completada.');

        } catch (error) {
            console.error(error);
            log(`ERROR: ${JSON.stringify(error)}`);
        } finally {
            setLoading(false);
        }
    };

    const migrateUsers = async () => {
        setLoading(true);
        log('Iniciando migración de usuarios...');
        try {
            // Obtener ID de la ruta general (asumiendo que ya se corrió el paso anterior o buscarla)
            const pathsQ = query(collection(db, 'learning_paths'), where('title', '==', 'Ruta General'));
            const pathsSnap = await getDocs(pathsQ);

            if (pathsSnap.empty) {
                log('ERROR: No se encontró la "Ruta General". Ejecuta la migración de módulos primero.');
                setLoading(false);
                return;
            }

            const generalPathId = pathsSnap.docs[0].id;

            // Buscar usuarios y actualizar
            const usersSnap = await getDocs(collection(db, 'users'));
            let updatedCount = 0;

            for (const docSnap of usersSnap.docs) {
                const userData = docSnap.data() as User;
                // Si no tiene assignedPathIds o está vacío
                if (!userData.assignedPathIds || userData.assignedPathIds.length === 0) {
                    await updateDoc(doc(db, 'users', docSnap.id), {
                        assignedPathIds: [generalPathId]
                    });
                    updatedCount++;
                }
            }

            log(`Se actualizaron ${updatedCount} usuarios.`);
            log('Migración de usuarios completada.');

        } catch (error) {
            console.error(error);
            log(`ERROR: ${JSON.stringify(error)}`);
        } finally {
            setLoading(false);
        }
    };

    const denormalizeModules = async () => {
        setLoading(true);
        log('Iniciando denormalización de courseTitle/pathId en módulos...');
        try {
            // 1. Cargar todos los cursos para tener un mapa courseId -> {title, pathId}
            const coursesSnap = await getDocs(collection(db, 'courses'));
            const courseMap = new Map<string, { title: string; pathId: string }>();
            coursesSnap.docs.forEach(d => {
                const data = d.data();
                courseMap.set(d.id, { title: data.title || '', pathId: data.pathId || '' });
            });
            log(`Cargados ${courseMap.size} cursos como referencia.`);

            // 2. Cargar todos los módulos
            const modulesSnap = await getDocs(collection(db, 'modules'));
            let updatedCount = 0;
            let skippedCount = 0;

            for (const docSnap of modulesSnap.docs) {
                const moduleData = docSnap.data();
                const courseInfo = courseMap.get(moduleData.courseId);

                if (!courseInfo) {
                    log(`WARN: Módulo ${docSnap.id} tiene courseId="${moduleData.courseId}" que no existe.`);
                    skippedCount++;
                    continue;
                }

                // Solo actualizar si falta courseTitle o pathId
                if (!moduleData.courseTitle || !moduleData.pathId) {
                    await updateDoc(doc(db, 'modules', docSnap.id), {
                        courseTitle: courseInfo.title,
                        pathId: courseInfo.pathId,
                    });
                    updatedCount++;
                } else {
                    skippedCount++;
                }
            }

            log(`Denormalización completada: ${updatedCount} actualizados, ${skippedCount} ya tenían datos.`);
        } catch (error) {
            console.error(error);
            log(`ERROR: ${JSON.stringify(error)}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '24px' }}>Herramienta de Migración de Datos</h1>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
                <button
                    onClick={migrateModules}
                    disabled={loading}
                    className="btn btn-primary"
                    style={{ padding: '12px 24px' }}
                >
                    1. Migrar Módulos (Crear Estructura Base)
                </button>

                <button
                    onClick={migrateUsers}
                    disabled={loading}
                    className="btn btn-secondary"
                    style={{ padding: '12px 24px' }}
                >
                    2. Asignar Ruta a Usuarios
                </button>

                <button
                    onClick={denormalizeModules}
                    disabled={loading}
                    className="btn btn-primary"
                    style={{ padding: '12px 24px', background: '#7c3aed' }}
                >
                    3. Denormalizar courseTitle/pathId en Módulos
                </button>
            </div>

            <div style={{
                background: '#f8fafc',
                padding: '20px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                minHeight: '300px',
                fontFamily: 'monospace'
            }}>
                <h3 style={{ borderBottom: '1px solid #cbd5e1', paddingBottom: '8px', marginBottom: '12px' }}>Logs:</h3>
                {status.map((line, i) => (
                    <div key={i} style={{ marginBottom: '4px' }}>{line}</div>
                ))}
            </div>
        </div>
    );
}
