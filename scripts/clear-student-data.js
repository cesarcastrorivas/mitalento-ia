const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: process.env.ADMIN_CLIENT_EMAIL,
            privateKey: process.env.ADMIN_PRIVATE_KEY ? process.env.ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined
        })
    });
}

const db = admin.firestore();

async function clearData() {
    console.log('Iniciando limpieza de datos de reportes...');

    try {
        // 1. Borrar quiz_sessions
        console.log('Borrando quiz_sessions...');
        const quizSessionsSnapshot = await db.collection('quiz_sessions').get();
        let batch = db.batch();
        let count = 0;
        
        for (const doc of quizSessionsSnapshot.docs) {
            batch.delete(doc.ref);
            count++;
            if (count % 400 === 0) {
                await batch.commit();
                batch = db.batch();
            }
        }
        if (count % 400 !== 0) {
            await batch.commit();
        }
        console.log(`Borrados ${count} documentos de quiz_sessions.`);

        // 2. Borrar commitments
        console.log('Borrando commitments...');
        const commitmentsSnapshot = await db.collection('commitments').get();
        batch = db.batch();
        count = 0;
        
        for (const doc of commitmentsSnapshot.docs) {
            batch.delete(doc.ref);
            count++;
            if (count % 400 === 0) {
                await batch.commit();
                batch = db.batch();
            }
        }
        if (count % 400 !== 0) {
            await batch.commit();
        }
        console.log(`Borrados ${count} documentos de commitments.`);

        // 3. Resetear usuarios
        console.log('Reseteando progreso de usuarios estudiantes...');
        const usersSnapshot = await db.collection('users').where('role', '==', 'student').get();
        batch = db.batch();
        count = 0;
        
        for (const doc of usersSnapshot.docs) {
            batch.update(doc.ref, {
                certificationLevel: 'none',
                attitudinalStatus: 'pending',
                completedCourses: admin.firestore.FieldValue.delete(),
                completedPaths: admin.firestore.FieldValue.delete(),
                passedModules: admin.firestore.FieldValue.delete(),
                quizScore: admin.firestore.FieldValue.delete(),
                hasCommitment: admin.firestore.FieldValue.delete(),
            });
            count++;
            if (count % 400 === 0) {
                await batch.commit();
                batch = db.batch();
            }
        }
        if (count % 400 !== 0) {
            await batch.commit();
        }
        console.log(`Reseteados ${count} usuarios estudiantes.`);

        console.log('Limpieza completada exitosamente.');
    } catch (e) {
        console.error('Error durante la limpieza:', e);
    }
}

clearData().finally(() => process.exit(0));
