const admin = require('firebase-admin');

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
    try {
        // Verifica si la app ['DEFAULT'] está inicializada. 
        // Si no lo está, arrojará un error y pasará al catch.
        admin.app();
    } catch (error) {
        console.log("Inicializando Firebase Admin...");
        try {
            if (process.env.ADMIN_CLIENT_EMAIL && process.env.ADMIN_PRIVATE_KEY) {
                console.log("Usando credenciales explícitas de process.env");
                admin.initializeApp({
                    credential: admin.credential.cert({
                        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'mitalento-ia',
                        clientEmail: process.env.ADMIN_CLIENT_EMAIL,
                        privateKey: formatPrivateKey(process.env.ADMIN_PRIVATE_KEY),
                    }),
                });
            } else {
                console.log("Usando Application Default Credentials");
                admin.initializeApp();
            }
            console.log("Firebase Admin inicializado correctamente.");
        } catch (initError) {
            console.error("Error crítico inicializando Firebase Admin:", initError);
            throw initError;
        }
    }
    return admin;
}

// Convertir arrow functions a function declarations estándar.
// Esto previene que Turbopack evalúe los getters eagerly (prematuramente)
// durante la carga del módulo, lo cual causaba errores 500 impredecibles de
// "The default Firebase app does not exist" antes de ejecutar las requests.

export function getAdminAuth() {
    return getFirebaseAdmin().auth();
}

export function getAdminDb() {
    return getFirebaseAdmin().firestore();
}

// Re-export Firestore helpers so consumers never need to
// `import … from 'firebase-admin/firestore'` (which Turbopack hash-bundles).
export function getFirestoreTimestamp() {
    return getFirebaseAdmin().firestore.Timestamp;
}
