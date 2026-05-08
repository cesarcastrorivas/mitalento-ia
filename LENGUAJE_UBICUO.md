# Lenguaje Ubicuo — `mi-talento-ia`

> Vocabulario del dominio de este proyecto. Es el lenguaje compartido entre el dueño del producto, el código y la IA.
> Tiene precedencia sobre el lenguaje ubicuo global cuando hay conflicto.

**Última actualización:** 2026-05-08
**Bounded context:** plataforma de capacitación corporativa para asesores comerciales de Urbanity Group. Stack: Next.js (App Router) + Firebase (Auth, Firestore, Storage) + IA generativa (Gemini) para quizzes y chatbot.

---

## Convención de idioma

**Español es el idioma canónico** del dominio, también en el código. La migración es progresiva: hoy el código está mayormente en inglés y se irá renombrando. Mientras tanto:

- Hablamos siempre en español usando los términos canónicos de la tabla siguiente.
- Cuando creemos código nuevo, usamos el término canónico en español.
- El código en inglés que ya existe (`LearningPath`, `Module`, etc.) se trata como **alias evitado**, no como error. Ver sección "Deuda terminológica".

## Conceptos del dominio

| Canónico | Alias evitado | Colección Firestore | Definición |
|----------|---------------|---------------------|------------|
| **Ruta** | `LearningPath`, `path` | `learning_paths` | Contenedor jerárquico de nivel 1. Solo existen 3 fijas: Fundamental, Profesional, Élite. Al completarla, el estudiante recibe el nivel de certificación correspondiente. |
| **Curso** | `Course` | `courses` | Grupo de módulos dentro de una ruta. Puede ser obligatorio u opcional (`isOptional`). |
| **Módulo** | `Module` | `modules` | Unidad de aprendizaje con video + quiz opcional. Atributos clave: `requiredWatchPercentage`, `passingScore`, `transcription`, `videoContext`. |
| **Estudiante** | `student`, `user` (cuando `role='student'`) | `users` (con `role='student'`) | Asesor comercial de Urbanity que consume el contenido. Tiene `assignedPathIds`, `progress`, `certificationLevel`, `attitudinalStatus`. |
| **Administrador** | `admin` | `users` (con `role='admin'`) | Usuario con CRUD total sobre rutas, cursos, módulos, diplomas, herramientas y BALLY AI. |
| **Sesión de quiz** | `QuizSession` | `quiz_sessions` | Instancia de un intento de evaluación. Tiene `score`, `passed`, `seed` (variación determinística de preguntas para reproducibilidad). |
| **Pregunta** | `Question` | (embebida en sesión de quiz) | Generada por Gemini desde la transcripción del video. Tiene `options[]`, `correctIndex`, `explanation`. |
| **Diploma** | `Certificate` | `certificates` | Documento digital verificable que se emite al completar una ruta. Tiene `verificationCode` y `level`. |
| **Herramienta** | `Tool` | `tools` | Recurso del UBK (video / audio / PDF / script). |
| **Carpeta de herramientas** | `ToolFolder` | `tool_folders` | Jerarquía organizativa del UBK (puede anidarse vía `parentId`). |
| **Base de conocimiento** | `knowledge_base` | `knowledge_base` | Colección con un solo doc cuyo id es `sofia` (legacy: Bally IA se llamaba SofIA). El id se conserva intencionalmente para no migrar datos en Firestore. En código se accede vía la constante `BALLY_KB_DOC_ID` (en `src/app/admin/bally/page.tsx`). |

## Estados y transiciones

| Concepto | Valores en código | Lectura canónica |
|----------|-------------------|------------------|
| **Nivel de certificación** | `'none' \| 'fundamental' \| 'professional' \| 'elite'` | Sin certificar / Fundamental / Profesional / Élite. Solo sube, nunca baja. |
| **Semáforo actitudinal** | `'green' \| 'yellow' \| 'red' \| 'pending'` | Verde / Amarillo / Rojo / Pendiente. Lo asigna manualmente el administrador. |
| **Rol** | `'admin' \| 'student'` | Administrador / Estudiante. |
| Activo | `isActive: boolean` | Banderas de soft-delete en User, Ruta, Curso, Módulo, Diploma, Herramienta. |
| Aprobado (sesión de quiz) | `passed: boolean` | True cuando `score >= max(80, Module.passingScore)`. |

## Acciones y eventos del dominio

| Acción/Evento | Significado | Quién dispara |
|---------------|-------------|---------------|
| **Inscribir** | Asignar una ruta a un estudiante (`assignedPathIds`). | Administrador. |
| **Completar módulo** | Marcar `users.progress[moduleId].completed = true` cuando se ve el video al `requiredWatchPercentage` o se aprueba el quiz. | Estudiante. |
| **Aprobar quiz** | Generar una sesión con `passed = true`. | Estudiante (al responder). |
| **Cascada de completación** | Función `checkCascadeCompletion` (`src/lib/grading-utils.ts`) que, al completar un módulo, recalcula si el curso y la ruta también se completaron y actualiza `users.completedPaths[]` y `certificationLevel`. | Sistema, en el handler que cierra el módulo. |
| **Auto-certificación Élite** | Al cumplir el Élite Checklist se genera automáticamente el diploma `level='elite'`. (Commit `710da97`). | Sistema. |
| **Certificar / Emitir diploma** | Crear un documento en `certificates` con `verificationCode`. | Estudiante (POST `/api/generate-certificate`) o sistema. |
| **Clasificar (ranking)** | Top-20 por score promedio de los últimos 90 días, visible solo en `/admin/ranking`. | Administrador (lectura). |
| **Evaluar actitud** | Asignar el semáforo actitudinal a un estudiante. | Administrador. |
| **Transcribir video** | POST `/api/transcribe` → tarea async; se consulta con `/api/transcribe-status/[taskId]`. | Administrador (al crear módulo). |

## Roles y actores

| Rol | Definición | Capacidades clave |
|-----|------------|-------------------|
| **Estudiante** | Asesor comercial de Urbanity. | Ver sus rutas asignadas, completar módulos, hacer quizzes, generar su diploma, usar BALLY AI, acceder al UBK. |
| **Administrador** | Equipo de Urbanity que opera la plataforma. | CRUD sobre rutas/cursos/módulos/herramientas, gestión de usuarios, asignación de rutas, evaluación actitudinal, edición de la base de conocimiento de BALLY AI, vista de ranking y diplomas. |
| **BALLY AI** *(actor sistema)* | Asistente conversacional con knowledge base personalizada. | Responde preguntas del estudiante usando el contenido de `knowledge_base/sofia` (id legacy). Páginas: `/bally` (estudiante), `/admin/bally` (edición de KB). Endpoint `POST /api/chat`. |
| **Gemini** *(actor sistema externo)* | LLM de Google usado para transcribir videos y generar preguntas de quiz. | No habla directamente con el usuario; lo orquestan los handlers de `/api/generate-quiz` y `/api/transcribe`. |

## Jerga del producto

- **BALLY AI** — Asistente conversacional con base de conocimiento personalizada. **Nombre canónico**, ya migrado en código (rutas `/bally` y `/admin/bally`, componentes `BallyPage`, `BallyLayout`, `BallyKnowledgeBase`, prompts y UI). El doc id `knowledge_base/sofia` se conserva intencionalmente como id legacy (ver fila correspondiente en "Conceptos del dominio"). URLs viejas `/sofia` y `/admin/sofia` redirigen 301 vía `next.config.ts`.
- **UBK (Urbanity Business Kit)** — Repositorio central de recursos compartidos (videos, audios, PDFs, scripts). Antes se llamaba "Herramientas" en la UI; el rename ya está hecho a nivel de UI (commit `27123aa`), pero las colecciones siguen siendo `tools` y `tool_folders`.
- **Élite Checklist** — Conjunto de 4 criterios para emitir el diploma de nivel Élite: módulos del path-elite completados + caso práctico + plan 30-60-90 + evaluación final.
- **Cascada de completación** — Ver tabla de acciones. Es la lógica que hace que completar un módulo dispare automáticamente la recálculo de curso y ruta.
- **Mi Talento Urbanity** — Marca con la que se nombra el producto cara al usuario. Internamente y en el repo se llama `mi-talento-ia`.
- **Seed de quiz** — String aleatorio guardado en la sesión que sirve para reproducir la misma variación de preguntas que vio un estudiante.

## Convenciones de naming en este proyecto

- **Idioma canónico**: español. La realidad actual es código en inglés que migra progresivamente. Al crear código nuevo, usar español; al tocar código existente, no renombrar a la fuerza salvo que sea el objetivo de la tarea.
- **Estilo**: `camelCase` para variables y funciones, `PascalCase` para tipos y componentes, `snake_case` para nombres de colecciones Firestore.
- **Identificador de usuario**: el canónico es `userId`. ⚠️ El código mezcla `uid` y `userId`; al unificar, escoger `userId` salvo cuando se trate del campo nativo de Firebase Auth (`auth.currentUser.uid`).

## Términos deprecados

| Término deprecado | Reemplazado por | Desde |
|-------------------|------------------|-------|
| **SofIA** | BALLY AI | Decisión: antes del 2026-05-07. Código migrado el 2026-05-08 (carpetas, rutas, componentes, redirects 301). Único residuo intencional: el doc id `knowledge_base/sofia`. |
| **Herramientas** *(en UI)* | UBK | Commit `27123aa`. |
| **Ranking** *(como página de estudiante)* | Solo admin (`/admin/ranking`) | Commit `27123aa`. |
| **Página `/compromiso`** *(firma digital)* | — *(eliminada)* | 2026-05-07. La firma digital del compromiso fue removida del código (página, botón en `/certificacion`, ruta protegida en middleware, excepción en navbar). El **Compromiso como ítem del checklist de certificación sigue vigente**: la colección `commitments` y los reportes admin (`/admin/certifications`, `/admin/reportes-certificacion`) se conservan intencionalmente. |
| **CRM Génesis** | — *(referencia muerta)* | Solo aparecía mencionado en los estándares del Compromiso, ahora deprecado. |

## Deuda terminológica

Lo que hay que migrar para que código y dominio converjan. No bloquea nada, pero deja registro para no perder el hilo.

| Tema | Estado actual del código | Nombre canónico | Notas |
|------|--------------------------|-----------------|-------|
| Entidades del dominio | `LearningPath`, `Module`, `Course`, `student` | Ruta, Módulo, Curso, Estudiante | Migración progresiva, no bigbang. |
| Identificador de usuario | `uid` y `userId` mezclados (ej. `QuizSession.userId` vs `User.uid`) | `userId` | Reservar `uid` solo para el campo de Firebase Auth. |
| Niveles de certificación | strings `'fundamental' \| 'professional' \| 'elite'` | Conservar strings en código (ya son cortos), pero hablar siempre como Fundamental / Profesional / Élite. | Sin acción de código. |

---

*Este archivo es vivo. Se actualiza cada vez que emerge un término nuevo, se unifica un sinónimo accidental, o se desambigua un homónimo. Edición visible: cualquier cambio se muestra como diff antes de guardar.*
