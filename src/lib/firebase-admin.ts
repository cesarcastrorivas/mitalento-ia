import * as admin from 'firebase-admin';

// Reemplaza los saltos de línea escapados si vienen en una variable de entorno de Vercel/Next
function formatPrivateKey(key: string) {
    return key.replace(/\\n/g, '\n');
}

if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY
                    ? formatPrivateKey(process.env.FIREBASE_PRIVATE_KEY)
                    : undefined,
            }),
        });
    } catch (error) {
        console.error('Firebase Admin Initialization Error:', error);
    }
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
