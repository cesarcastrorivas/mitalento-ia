/**
 * Aplica la configuración de CORS de cors.json al bucket de Firebase Storage
 * usando las credenciales del Admin SDK (.env.local).
 *
 * Uso:
 *   node scripts/apply-storage-cors.mjs
 *
 * Reemplazo de:
 *   gsutil cors set cors.json gs://mitalento-ia.firebasestorage.app
 *
 * Requiere que el service account tenga permiso storage.buckets.update
 * sobre el bucket (incluido por defecto en roles/firebase.admin).
 */

import { readFileSync } from 'fs';
import { config } from 'dotenv';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

config({ path: '.env.local' });

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'mitalento-ia';
const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'mitalento-ia.firebasestorage.app';
const clientEmail = process.env.ADMIN_CLIENT_EMAIL;
const privateKey = process.env.ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!clientEmail || !privateKey) {
  console.error('[apply-cors] Faltan ADMIN_CLIENT_EMAIL o ADMIN_PRIVATE_KEY en .env.local');
  process.exit(1);
}

const corsConfig = JSON.parse(readFileSync('cors.json', 'utf8'));

if (getApps().length === 0) {
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    storageBucket: bucketName,
  });
}

const bucket = getStorage().bucket();

console.log(`[apply-cors] Aplicando configuración CORS al bucket: ${bucketName}`);
console.log('[apply-cors] Origins:', corsConfig[0]?.origin);

try {
  await bucket.setCorsConfiguration(corsConfig);
  console.log('[apply-cors] ✓ CORS aplicado correctamente.');

  const [metadata] = await bucket.getMetadata();
  console.log('[apply-cors] Configuración actual:');
  console.log(JSON.stringify(metadata.cors, null, 2));
  process.exit(0);
} catch (err) {
  console.error('[apply-cors] ✗ Error aplicando CORS:', err.message || err);
  if (err.code === 403) {
    console.error('[apply-cors] El service account no tiene permiso storage.buckets.update.');
    console.error('[apply-cors] Asignar role "Storage Admin" al service account en Cloud Console.');
  }
  process.exit(1);
}
