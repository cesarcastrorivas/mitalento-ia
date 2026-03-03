import * as admin from 'firebase-admin';

// Reemplaza los saltos de línea escapados si vienen en una variable de entorno de Vercel/Next
function formatPrivateKey(key: string) {
    if (!key) return key;
    let formattedKey = key;
    if (formattedKey.startsWith('"') && formattedKey.endsWith('"')) {
        formattedKey = formattedKey.slice(1, -1);
    }
    // Remove stray quotes at the end just in case
    formattedKey = formattedKey.replace(/"+$/, '');
    return formattedKey.replace(/\\n/g, '\n');
}

export function getFirebaseAdmin() {
    if (!admin.apps.length) {
        if (process.env.ADMIN_CLIENT_EMAIL && process.env.ADMIN_PRIVATE_KEY) {
            // Credenciales explícitas — desarrollo local con .env.local
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'mitalento-ia',
                    clientEmail: process.env.ADMIN_CLIENT_EMAIL,
                    privateKey: formatPrivateKey(process.env.ADMIN_PRIVATE_KEY),
                }),
            });
        } else {
            // Application Default Credentials — Cloud Run / Cloud Functions Gen 2.
            // GCLOUD_PROJECT / GOOGLE_CLOUD_PROJECT se setean automáticamente en GCP.
            admin.initializeApp();
        }
    }
    return admin;
}

export const getAdminAuth = () => getFirebaseAdmin().auth();
export const getAdminDb = () => getFirebaseAdmin().firestore();

// Re-export Firestore helpers so consumers never need to
// `import … from 'firebase-admin/firestore'` (which Turbopack hash-bundles).
export const getFirestoreTimestamp = () =>
    getFirebaseAdmin().firestore.Timestamp;
