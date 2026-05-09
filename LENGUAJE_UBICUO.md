# Lenguaje Ubicuo — Mi Talento Urbanity (UBK)

> Vocabulario del dominio compartido entre el equipo, el código y la IA.
> Tiene precedencia sobre `C:\Users\cesar\.claude\lenguaje-ubicuo.md` cuando hay conflicto.

**Última actualización:** 2026-05-08
**Bounded context:** plataforma de capacitación, certificación y selección de personal de Urbanity Academy. Stack: Next.js 16 + Firebase (Auth + Firestore + Storage) + Google Gemini.

---

## ⚠️ Directorios del proyecto — leer antes de tocar nada

Existen **dos directorios** con código que dice ser este proyecto. Esto se prestaba a confusión (ej. `firebase deploy` ejecutado desde el borrador deployaba reglas/hosting equivocados). Regla obligatoria:

| Rol | Ruta | Qué hay | Qué SÍ se hace ahí | Qué NO se hace |
|-----|------|---------|---------------------|----------------|
| **Real** (canónico) | `C:\Users\cesar\mitalento-ia` | Código vivo, completo, evolucionado. Sección Herramientas, Bally Knowledge, certificaciones, pipeline. | Todo el desarrollo, `firebase deploy`, `npm run build`, PRs. | — |
| **Borrador** (scratch) | `C:\Users\cesar\.gemini\antigravity\scratch\borrador-urbanity` | Snapshot antiguo creado por Antigravity con experimentos puntuales (ej. rename Sofía → Bally en paths). Solo "Initial commit" en su `.git`. | Pruebas desechables. Si algo de aquí debe sobrevivir, **migrar al real antes de modificarlo**. | **Nunca** `firebase deploy`. **Nunca** PR desde aquí. **Nunca** asumir que su código es el actual — el real va por delante. |

> El borrador se llamaba `mi-talento-ia` (idéntico al real). Renombrado a `borrador-urbanity` el 2026-05-08 precisamente para evitar la confusión. Backup ZIP previo al rename: `OneDrive\Escritorio\scratch-mi-talento-backup-20260508-192748.zip`.

---

## Conceptos del dominio

### Aprendizaje (jerarquía principal)

| Término | Definición | Alias evitados | Ejemplo en código |
|---------|------------|----------------|-------------------|
| **Path** (Ruta / Camino) | Trayecto de aprendizaje agrupador. Contiene varios cursos y, al completarse, otorga un nivel de certificación. | `Track`, `Programa` | `interface LearningPath`, colección `learning_paths`, ruta `/paths/[pathId]` |
| **Course** (Curso) | Conjunto ordenado de módulos dentro de un Path. Puede ser obligatorio u opcional. | `Class`, `Modulo grande` | `interface Course`, colección `courses`, ruta `/courses/[courseId]` |
| **Module** (Módulo) | Unidad mínima de aprendizaje: un video + transcripción + quiz generado por IA. | `Lección`, `Lesson`, `Clase` | `interface Module`, colección `modules`, ruta `/modules/[id]` |
| **Quiz** | Evaluación de N preguntas tras un módulo. Una sesión por intento. | `Test`, `Examen` | `interface QuizSession`, colección `quiz_sessions` |
| **Question** | Pregunta generada por IA con 4 opciones, índice correcto y explicación. | `Pregunta` (en español está bien), `Item` | `interface Question` |
| **ModuleProgress** | Progreso del usuario en un módulo concreto: intentos, mejor score, completado. | `Avance` | `interface ModuleProgress` (suele anidarse en User) |

### Herramientas (Tools)

| Término | Definición | Alias evitados | Ejemplo en código |
|---------|------------|----------------|-------------------|
| **Tool** (Herramienta) | Recurso central subido por admin para que cualquier alumno lo consuma. Ortogonal a paths/cursos. Vive en una biblioteca con carpetas. | `Resource`, `Recurso`, `Material` | `interface Tool`, colección `tools`, ruta `/admin/tools` y `/tools` |
| **ToolType** | Discriminador del Tool. Determina cómo se renderiza en la vista alumno. | — | `'video' \| 'audio' \| 'image' \| 'pdf' \| 'script' \| 'exe'` |
| **ToolFolder** | Carpeta jerárquica para organizar Tools. Profundidad máx. 2 (raíz → carpeta → subcarpeta). | `Categoría` | `interface ToolFolder`, colección `tool_folders` |
| **Script** (tipo Tool) | Tool tipo texto puro: prompts, plantillas de mensaje, snippets para copiar/pegar. **No es un archivo**, es contenido en `tool.url` directamente. | `Texto`, `Plantilla` (cuando hablamos del tipo) | `tool.type === 'script'`, en este caso `tool.url` contiene el texto |
| **exe** (tipo Tool) | Tool tipo instalador Windows pesado. Vista alumno NO renderiza visor inline; muestra panel de descarga + aviso SmartScreen. Tope 500 MB. Agregado el 2026-05-08. | `installer`, `binary` | `tool.type === 'exe'`, `TOOL_MAX_MB.exe = 500` |

### Identidad y certificación

| Término | Definición | Alias evitados | Ejemplo en código |
|---------|------------|----------------|-------------------|
| **User** | Cuenta autenticada. Su `role` decide visibilidad de admin. | `Usuario` (en UI sí, en código `User`) | `interface User`, colección `users` |
| **CertificationLevel** | Nivel alcanzado por el alumno al completar paths. Cuatro escalones. | — | `'none' \| 'fundamental' \| 'professional' \| 'elite'` |
| **Certificate** | Documento digital verificable por código QR. Se emite SOLO desde API server con Admin SDK (un alumno no se autoemite). | `Diploma` (en UI puede aparecer "Diploma Élite") | `interface Certificate`, colección `certificates` |
| **AttitudinalSemaphore** | ⚠️ Estado actitudinal del candidato. Verde/amarillo/rojo. Por confirmar el criterio exacto que sube/baja el semáforo. | `Status` | `'green' \| 'yellow' \| 'red'` |
| **Pipeline de candidato** | ⚠️ Flujo de selección de personal. El alumno tiene `stageChecklist` (etapas con bool) y `supervisorFeedback`. Por confirmar las etapas concretas y quién las marca. | — | `User.stageChecklist`, `User.supervisorFeedback` |
| **Leaderboard** | Ranking por score acumulado y nivel de certificación. Calculado vía rutas API con Admin SDK (bypass de rules). | `Ranking` (en UI sí: `/ranking`) | `interface LeaderboardEntry` |
| **Commitment** | Compromiso firmado por el alumno (estándares de conducta). Un usuario solo puede crear los suyos. | `Acuerdo` | colección `commitments` |

### Asistente IA

| Término | Definición | Alias evitados | Ejemplo en código |
|---------|------------|----------------|-------------------|
| **Bally** | Nombre de cara al alumno del asistente IA. Es lo que se muestra en sidebar ("Bally IA Knowledge") y en respuestas del chatbot. | `Sofía` (legacy, ver deprecados), `Asistente` (genérico) | UI: textos "Bally", "Bally IA"; archivo `src/lib/assistantConfig.ts` (en borrador) define `ASSISTANT_DISPLAY_NAME` |
| **Knowledge Base** (de Bally) | Documento markdown que define la personalidad, tono y conocimientos que Bally usa para responder. Editable solo por admin. Lectura pública (necesario para que el chatbot lea sin sesión). | `Contexto`, `Prompt` | colección `knowledge_base`, ruta `/admin/sofia` (path legacy, contenido habla de Bally) |
| **Salud del Contexto** | Indicador UX en el editor de Knowledge Base. Mide caracteres y clasifica en Crítico/Bajo/Saludable/Robusto (umbrales 2k/10k/30k). Fines: evitar alucinaciones por contexto pobre. | `Health`, `Calidad` | función `getContextHealth(length)` en `src/app/admin/sofia/page.tsx` |

---

## Roles y actores

| Rol | Definición | Capacidades clave |
|-----|------------|-------------------|
| **admin** | Operador de la plataforma. Crea paths/courses/modules/tools, gestiona usuarios, edita Knowledge Base de Bally, emite certificados (vía API), configura pipeline de candidatos. | Acceso total a `/admin/**`. Storage write en `/videos/**`, `/tools/**`, `/course-thumbnails/**`. Firestore write a casi todo. |
| **student** (alumno) | Consumidor del contenido. Hace cursos, rinde quizzes, descarga tools, chatea con Bally. | Solo lectura de paths/courses/modules/tools activos. Crea su propio progreso, sus propios quiz_sessions, su propio commitment. Solo lee su propio doc en `/users/{userId}`. |

---

## Acciones y eventos del dominio

| Acción / Evento | Significado | Quién dispara | Qué provoca |
|---|---|---|---|
| **Aprobar quiz** | El alumno alcanza `passingScore` en una QuizSession. ID del doc se vuelve determinístico (`{userId}_{moduleId}`) → write-once por rules. | Alumno (al rendir) | Creación inmutable de QuizSession con `passed=true`; actualiza `User.completedCourses`/`completedPaths` cuando corresponde. |
| **Emitir certificado** | Generar Certificate verificable. | API server (Admin SDK), nunca el alumno | Doc en `certificates` con `verificationCode`; consultable público para QR. |
| **Subir Tool** | Admin sube archivo a Firebase Storage en `tools/{toolId}/{timestamp}_{safeName}` y guarda metadata en Firestore. | Admin | Doc en `tools` con `url`, `fileName`, `fileSize`, `mimeType` (y `duration` si video/audio). |
| **Cascade delete** (de carpeta) | Eliminar una `ToolFolder` borra recursivamente subcarpetas + tools + sus archivos en Storage. | Admin (con confirmación que muestra conteo previo) | `deleteFolderCascade(folderId)` en `src/lib/tool-upload.ts`. |
| **Transcribir video** | Genera transcripción del video del módulo con IA para alimentar generación de preguntas. | Admin (en formulario de Module) | `POST /api/transcribe`, llena `Module.transcription`. |

---

## Convenciones de naming en este proyecto

- **Idioma de identificadores en código:** **inglés** (ej. `interface Tool`, `course`, `pathId`). Los textos de UI son en español.
- **Idioma de comentarios:** español (heredado del global).
- **Estilo:** `camelCase` para variables/props/funciones, `PascalCase` para tipos/componentes, `kebab-case` para rutas y nombres de archivos de Next.
- **Colecciones Firestore:** `snake_case` plural (`learning_paths`, `quiz_sessions`, `tool_folders`, `knowledge_base`).
- **Paths de Storage:** `kebab-case` por dominio (`videos/`, `course-thumbnails/`, `avatars/{userId}/`, `tools/{toolId}/`).
- **Categoría de Tool:** valor literal `"root"` para raíz; `"folder_{folderId}"` para dentro de una carpeta. Esto vive en `Tool.category` (no es un FK directo, es un string discriminado).

---

## Términos deprecados / legacy

| Término deprecado | Reemplazado por | Desde | Notas |
|-------------------|------------------|-------|-------|
| **Sofía** (en código y UI) | **Bally** | Pre-2026-05 | El rename está incompleto: las **rutas siguen siendo `/sofia/` y `/admin/sofia`**, los archivos `.tsx` también. Solo el contenido visible (textos, sidebar, respuestas) dice "Bally". El borrador-urbanity intentó hacer el rename completo (paths a `/bally-ai/`) pero ese cambio NO está en el real. Si se completa el rename algún día, hacerlo en el real, no en el borrador. |
| `videoUrl` único en Module | + soporte multi-recurso vía Tools | 2026-05 aprox | Los Modules siguen teniendo un `videoUrl` único como recurso principal. Los recursos descargables adicionales viven en la sección Herramientas (Tool) como repositorio central, no atado al módulo. |

---

## Notas para la IA

- Cuando el usuario diga "**herramienta**" → es Tool del dominio, no una librería ni un script genérico.
- Cuando diga "**ruta**" → es ambiguo. Confirmar si se refiere a `LearningPath` (dominio) o ruta de Next.js (técnica). El contexto suele aclararlo.
- Cuando diga "**deploy**" → es `firebase deploy` desde el **real**. Si nota que el cwd está en el borrador, alertar antes.
- Si lee código que dice "Sofía" pero el contexto del usuario habla de "Bally", **no son cosas distintas** — es el rename incompleto. Mismo asistente.
- Si trabaja en el directorio borrador, asumir que el código está desactualizado vs el real y confirmar con el usuario antes de cambiar nada.

---

*Archivo vivo. Actualizar cuando emerja un término nuevo, se unifique un sinónimo accidental, o se desambigüe un homónimo. Marcar `⚠️` cualquier definición inferida del código sin validar con el dueño del dominio.*
