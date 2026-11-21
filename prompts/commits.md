---
description: Pregunta la acción y delega los commits en ox-committer con contexto nuevo, sin cambiar el modelo del orquestador
---

Coordina los commits del repositorio donde el usuario invoca `/commits`. El orquestador pregunta y verifica; `ox-committer` ejecuta las operaciones Git autorizadas. No uses el directorio de configuración global de Pi como repositorio por defecto.

Preferencias del usuario para esta ejecución: $ARGUMENTS

No cambies el modelo del orquestador, no uses `/model` ni modifiques la configuración de modelos. El modelo configurado para `ox-committer` corresponde únicamente al subagente. No ejecutes por tu cuenta `git add`, `git reset`, cambios de rama, commits o push en este flujo.

## 1. Pregunta qué hacer

Antes de lanzar al ejecutor o modificar el repositorio, usa la herramienta `ask_user_question` de la extensión `ox-questions`.
Envía una sola pregunta en `questions`, con `header: "Commit"`, una pregunta sobre la acción que quiere realizar y `multiSelect: false`. En `options`, usa cada texto siguiente como `label` y su explicación como `description`, en este orden:

1. `Commit + push (Recommended)`: crea los commits en la rama actual y después haz push.
2. `Commit only`: crea los commits en la rama actual, sin push.
3. `Commit on a new branch`: crea una rama, crea los commits en ella y después haz push.

Espera una respuesta explícita. No elijas ninguna opción por defecto ni autorices push sin una elección que lo permita.
Si la herramienta no está disponible, devuelve un error técnico o el entorno no admite preguntas interactivas, presenta las mismas opciones en la conversación y espera la respuesta del usuario.
Si el usuario cancela, la herramienta devuelve `cancelled: true`, el usuario rechaza la pregunta o pide detenerse, termina sin lanzar al ejecutor ni modificar el repositorio. Una cancelación no activa la pregunta alternativa.
Si la respuesta está vacía o su texto no identifica inequívocamente una opción, aclara la intención. Resuelve cualquier contradicción entre la opción y las restricciones del usuario antes de delegar.

## 2. Prepara el encargo mínimo

Usa comprobaciones de solo lectura para identificar la raíz Git, la rama y el HEAD actuales. Si todavía no existe HEAD, indícalo sin inventar un commit. Si no estás en un repositorio, informa y termina. Lee las instrucciones aplicables y confirma el alcance autorizado.

No prepares, limpies ni modifiques el índice. No recopiles todos los diffs ni copies el historial de conversación para delegar: el ejecutor inspeccionará los cambios por sí mismo, filtrando secretos antes de leerlos.

El encargo debe contener:

- La ruta absoluta del repositorio, la rama observada y el HEAD observado o su ausencia.
- La opción exacta elegida por el usuario y su autorización de push o prohibición de push.
- Los argumentos de esta invocación, el alcance, las exclusiones y las restricciones acordadas.
- El idioma de los mensajes si se indicó, o `repo` si pidió seguir el historial. Si no se indicó, conserva el inglés predeterminado.
- Las instrucciones aplicables, mediante contenido pertinente o rutas absolutas, sin razonamientos privados ni secretos. Incluye las instrucciones de Git y mensajes de commit del proyecto, y las rutas de `~/.pi/agent/skills/ox-unslop/SKILL.md` y `~/.pi/agent/skills/ox-technical-writing/SKILL.md`, con la instrucción de leerlas antes de redactar mensajes.
- La obligación de seguir el procedimiento del perfil `ox-committer`, no editar archivos de trabajo y conservar los cambios ajenos.

Conserva la excepción de seguridad del ejecutor: `.env.example` y `env-example` pueden entrar si son plantillas sin secretos, también en subdirectorios. No se permite incluir credenciales reales por el nombre del archivo. Si Git ignora una plantilla, hace falta autorización antes de forzar su inclusión o cambiar `.gitignore`.

## 3. Lanza un solo ejecutor con contexto nuevo

Si no tienes disponible `subagent`, llama primero a `subagents_enable`. Comprueba que el perfil `ox-committer` está disponible y resuelve al modelo configurado para ese agente. Si falta el agente o su modelo no está disponible, informa y detente. No cambies al orquestador de modelo ni elijas otro ejecutor como sustituto.

Anuncia el agente, el repositorio y la acción autorizada. Lanza una llamada directa a `subagent` con `agent: "ox-committer"`, el `cwd` absoluto del repositorio, `async: true`, `worktree: false` y `options.context: "fresh"`. Usa como `task` únicamente el encargo mínimo preparado. No uses fork, no reanudes una sesión antigua ni añadas la conversación completa. No hacen falta un workflow script ni otros agentes.

Conserva las herramientas y los permisos del perfil. Omite `output` para usar el informe gestionado, o proporciona una ruta absoluta fuera del repositorio; no pases `output: false`. El runtime guarda el informe devuelto por el ejecutor. No le pidas que cree archivos de informes dentro del árbol de trabajo.

`worktree: false` es deliberado: el ejecutor necesita los cambios preparados, sin preparar y sin seguimiento del checkout actual. No arranques otro escritor ni modifiques el índice, las ramas o los archivos mientras el ejecutor esté activo. Si ya hay un escritor activo en ese checkout, espera a que termine antes de preparar la identidad final del repositorio y lanzar el encargo.

## 4. Recoge y verifica el resultado

Espera la notificación nativa de finalización y lee el informe devuelto. Una confirmación de lanzamiento no significa que los commits se hayan creado. Si no queda trabajo independiente seguro, cede el turno sin cambiar a ejecución síncrona ni sondear en bucle.

Comprueba con operaciones de solo lectura que los hashes informados existen y que la rama y el estado final concuerdan con la acción autorizada. Distingue los commits creados de los cambios pendientes. Acredita el resultado del push solo con evidencia de su ejecución o una comprobación remota de solo lectura; no lo deduzcas de que existan commits locales.

Si el ejecutor falla, queda bloqueado o necesita una decisión adicional, comunica el estado real y pregunta al usuario. No hagas commits o push como sustituto, no lo relances automáticamente y no repitas operaciones que hayan tenido éxito parcial. Una continuación necesita revisar el estado actual y conservar los hashes ya creados.

Termina con una lista breve de los commits creados, la rama, el resultado del push, los archivos excluidos y los cambios pendientes. Si la opción fue `Commit only`, indica que no se hizo push.
