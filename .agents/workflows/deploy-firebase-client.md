---
description: Roadmap para desplegar la app Next.js en una cuenta Firebase de un cliente nuevo
---

# 🚀 Roadmap: Deploy a Firebase de un Cliente Nuevo

> Guía paso a paso para desplegar MiTalento IA en el proyecto Firebase de un cliente.
> Tiempo estimado total: **10-15 minutos** (la primera vez).

---

## Fase 1: Preparación del Proyecto Firebase del Cliente (5 min)

El cliente (o tú con acceso a su cuenta) debe hacer esto **una sola vez** desde la consola web de Firebase:

### 1.1 Crear el proyecto
- Ir a [console.firebase.google.com](https://console.firebase.google.com)
- Crear un nuevo proyecto (ej: `nombre-empresa-prod`)
- Anotar el **Project ID** (ej: `nombre-empresa-prod`)

### 1.2 Activar el Plan Blaze
- En la consola de Firebase, ir a **Uso y facturación** (Usage & Billing)
- Hacer upgrade al plan **Blaze** (pay-as-you-go)
- Vincular una tarjeta de crédito o cuenta de facturación de Google Cloud
- ⚠️ **Sin esto, no se pueden desplegar Cloud Functions (necesarias para Next.js SSR)**

### 1.3 Inicializar los servicios
Desde la consola de Firebase del proyecto:
- **Firestore Database** → Clic en "Crear base de datos" → Modo producción → Listo
- **Storage** → Clic en "Comenzar" → Aceptar ubicación por defecto → Listo
- **Authentication** → Habilitar los proveedores que use la app (Google, Email, etc.)

---

## Fase 2: Configurar Permisos en Google Cloud (3 min)

Ir a [console.cloud.google.com/iam-admin/iam](https://console.cloud.google.com/iam-admin/iam) con el proyecto del cliente seleccionado.

### 2.1 Agregar permiso de Cloud Build a Compute Engine
1. Clic en **"+ Otorgar acceso"**
2. En "Nuevas principales", escribir:
   ```
   {NUMERO_PROYECTO}-compute@developer.gserviceaccount.com
   ```
   > El número del proyecto se encuentra en la configuración del proyecto en Firebase Console.
3. Seleccionar el rol: **"Cuenta de servicio de Cloud Build"** (`roles/cloudbuild.builds.builder`)
4. Guardar

### 2.2 (Opcional) Verificar que estas APIs estén habilitadas
Normalmente Firebase las activa automáticamente, pero si hay errores:
- Cloud Functions API
- Cloud Build API
- Artifact Registry API
- Cloud Run API

---

## Fase 3: Preparar el Código Local (2 min)

### 3.1 Crear archivo `.env.production` con las credenciales del cliente
```env
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=nombre-empresa-prod
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxx
FIREBASE_ADMIN_PROJECT_ID=nombre-empresa-prod
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxx@nombre-empresa-prod.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GEMINI_API_KEY=xxx
```

### 3.2 Activar el experimento de webframeworks (solo la primera vez global)
```bash
npx firebase experiments:enable webframeworks
```

---

## Fase 4: Login y Deploy (2 min)

### 4.1 Iniciar sesión con la cuenta que tiene acceso al proyecto
```bash
// turbo
npx firebase logout
npx firebase login
```
> Se abrirá el navegador. Seleccionar la cuenta con acceso al proyecto.

### 4.2 Seleccionar el proyecto
```bash
// turbo
npx firebase use nombre-empresa-prod
```

### 4.3 Desplegar
```bash
npx firebase deploy
```

> ⏱️ Este proceso tarda entre 3-8 minutos. Al terminar mostrará:
> ```
> ✔ Deploy complete!
> Hosting URL: https://nombre-empresa-prod.web.app
> ```

---

## Fase 5: Deploys Posteriores (30 seg)

Una vez configurado todo, los deploys futuros son simplemente:

```bash
npx firebase deploy
```

¡Eso es todo! No se necesita repetir ningún paso de configuración.

---

## 🔧 Troubleshooting Rápido

| Error | Solución |
|-------|----------|
| `must be on the Blaze plan` | Activar plan Blaze en Firebase Console |
| `Firebase Storage has not been set up` | Ir a Storage en Firebase Console y dar "Comenzar" |
| `missing permission on the build service account` | Agregar rol `cloudbuild.builds.builder` a `{NUM}-compute@developer.gserviceaccount.com` en IAM |
| `EPERM: symlink` en Windows | Activar "Modo Programador" en Windows o abrir VS Code como Administrador |
| `Grant the new role? (Y/n)` | Escribir `Y` y presionar Enter |

---

## 💡 Alternativa: Vercel (más simple)

Si prefieres evitar toda la configuración de Google Cloud IAM:

```bash
npx vercel --prod
```

- No requiere plan de pago
- No requiere configurar permisos IAM
- Deploy en 1 minuto
- Tu Firebase (Firestore, Auth, Storage) sigue funcionando igual
- Solo cambia dónde se aloja el frontend + las API routes
