---
name: ox-spec
description: Define especificaciones técnicas antes de implementar funcionalidades o cambios relevantes. Usa /skill:ox-spec con una descripción del cambio para revisar el contexto, resolver dudas necesarias y guardar directamente una SPEC completa en specs/.
disable-model-invocation: true
---

# /skill:ox-spec

Define el cambio y guarda su especificación. No implementes código durante este comando. Acepta `--worktree` para una carpeta aislada y `--here` para una carpeta secuencial limpia. Sin opción, el modo automático conserva el flujo sencillo y aísla una SPEC adicional sin cambiar la carpeta de la anterior.

## Filosofía

Lento en la definición, rápido en la escritura. Dedica el tiempo necesario a entender el problema y resolver ambigüedades que cambien el resultado. Cuando la definición sea suficiente, escribe el archivo completo directamente. El usuario lo revisa después y solicita ajustes sobre ese mismo archivo.

No muestres un borrador en el chat, no solicites aprobación por secciones y no pidas permiso para guardar. Si falta una decisión importante, pregunta por esa decisión y continúa después de resolverla.

## 1. Entender el contexto

1. Lee completos [template.md](template.md), [workflow.md](workflow.md) y [worktrees.md](worktrees.md), junto a esta skill. El template define la estructura de la SPEC. El workflow fija las reglas compartidas. La guía de worktrees define cómo preparar y retomar su carpeta sin comandos manuales del usuario.
2. Lee las instrucciones aplicables del repositorio, incluidos los archivos `AGENTS.md`. Consulta la documentación y la memoria del proyecto disponibles, como `README.md`, `CLAUDE.md` o `GEMINI.md`, sin sustituir instrucciones aplicables por el primer archivo encontrado. Si existe `docs/foundation.md`, o el documento de fundamentos indicado por el proyecto, léelo completo. Su ausencia no bloquea el flujo ni obliga a ejecutar `ox-foundation`.
3. Inspecciona `specs/` y su numeración actual. Lee las dos SPECs más recientes, si existen, y las que definan contratos afectados o dependencias. Consulta sus commits de `Evidencia` cuando necesites aclarar un contrato, una decisión o un cambio previo. Revisa el código y la configuración relevantes para comprobar el estado actual.
4. Obtén la fecha actual mediante las herramientas del entorno. No deduzcas la fecha a partir de otras SPECs.
5. Usa los argumentos o la conversación como descripción inicial. Si no hay una petición identificable, pregunta qué se quiere construir o cambiar. Un argumento que sea solo un slug kebab-case sirve también como nombre propuesto.

Responde en el idioma del usuario. Escribe la SPEC en el idioma del repositorio salvo indicación contraria. Conserva sus términos y estados, pero aplica la estructura del template actualizado aunque las SPECs antiguas tengan otra forma.

## 2. Resolver las dudas necesarias

Revisa alcance, comportamiento observable, datos, contratos, integración, migración, seguridad, errores y riesgos. Usa primero la información de la conversación y del repositorio. No conviertas estas categorías en un cuestionario obligatorio.

Lee completos solo los principios pertinentes a las decisiones abiertas:

- [Experience First](../ox-principle-experience-first/SKILL.md) al comparar alcance, recorridos de usuario o ergonomía de un contrato.
- [Foundational Thinking](../ox-principle-foundational-thinking/SKILL.md) al fijar representaciones compartidas, estado concurrente o el orden de preparación y capacidades.
- [Redesign from First Principles](../ox-principle-redesign-from-first-principles/SKILL.md) cuando el requisito cuestione las responsabilidades o invariantes del diseño existente.
- [Subtract Before You Add](../ox-principle-subtract-before-you-add/SKILL.md) cuando el plan deba retirar complejidad innecesaria identificada antes de construir.

Si una elección necesita observar comportamiento o comparar interacciones, propone un experimento acotado con [ox-prototype](../ox-prototype/SKILL.md). Espera autorización para ejecutarlo y conserva la decisión pendiente hasta tener evidencia suficiente.

- Pregunta solo por ambigüedades que cambien el alcance, el comportamiento, los contratos, la compatibilidad o las garantías de seguridad. Agrupa las dudas relacionadas en un bloque breve, de hasta cinco preguntas, y espera la respuesta.
- Ofrece opciones concretas cuando ayuden. Indica la recomendación y su motivo. Usa una herramienta de preguntas si está disponible o una lista numerada si no lo está.
- Respeta las decisiones ya tomadas. Reutiliza los acuerdos vigentes de los fundamentos y distingue las propuestas de los requisitos aceptados. Resuelve sus pendientes solo si afectan a esta SPEC. Si el cambio contradice un acuerdo global, consulta esa diferencia antes de escribir. No preguntes de nuevo por información suficiente ni solicites confirmar hechos comprobados en el repositorio.
- Resuelve detalles internos reversibles usando las convenciones del proyecto. Identifica como propuestas las elecciones nuevas del agente. No las atribuyas al usuario ni inventes requisitos, rutas existentes o garantías.
- Propón separar SPECs cuando haya objetivos independientes o un alcance difícil de implementar y verificar como una unidad. La longitud del objetivo y la cantidad de áreas afectadas son señales, no límites automáticos.

Pasa a la escritura cuando puedas describir qué cambia, qué queda fuera, los contratos y reglas observables, los bloques de implementación y cómo verificar el resultado. No exijas conocer todos los nombres de archivos o funciones internos.

Si la petición ya está definida, continúa directamente. Si el usuario pide guardar aun con dudas importantes, guarda una SPEC en `Borrador` y registra las decisiones pendientes, su impacto y qué bloquean dentro de `Decisiones`. No presentes una cuestión pendiente como resuelta.

## 3. Preparar la rama de la SPEC

1. Comprueba Git, la rama local `dev` y los cambios existentes según [workflow.md](workflow.md). Identifica la raíz del repositorio. Resuelve cualquier impedimento antes de escribir archivos.
2. Para una SPEC nueva, deriva un slug ASCII kebab-case breve y llama a `ox_worktree` con `action: "prepare"`, `slug` y el modo indicado en [worktrees.md](worktrees.md). La herramienta reserva el número entre sesiones y prepara desde `dev` la rama `spec-NN-slug` y su carpeta antes de guardar el documento. Usa `number: 0` solo si el usuario pidió fundamentos con `00`.
3. Para editar o retomar una SPEC existente, usa `prepare` con `spec` en lugar de `slug`. Reutiliza la rama y el checkout encontrados, incluidos los cambios sin commit. Si falta su rama, explica el impedimento y pide prepararla sin trasladar trabajo de otra SPEC.
4. Conserva `spec`, `branch`, `cwd`, `specPath` y `repositoryRoot` devueltos. Usa ese `cwd` explícitamente en comandos y rutas, aunque la sesión haya empezado en otra carpeta. No actives esa rama en el checkout de otra SPEC.
5. Confirma la rama en el `cwd` preparado. Revisa allí la SPEC existente, los fundamentos disponibles, las instrucciones, el código y los contratos afectados. Resuelve cualquier diferencia con el contexto inicial antes de redactar.

## 4. Escribir y verificar la SPEC

Redacta el documento completo siguiendo [template.md](template.md). Conserva el orden y las secciones obligatorias. Aplica su criterio para incluir u omitir `Datos y contratos relevantes`.

- Distingue el comportamiento requerido de las decisiones internas que puede resolver la implementación.
- Enlaza desde `Contexto` o `Decisiones` los acuerdos globales relevantes sin copiarlos. Si el usuario acordó cambiar uno, actualiza también el documento de fundamentos en la rama de esta SPEC, conservando los acuerdos no afectados. Una recomendación nueva no autoriza esa modificación.
- Fija las reglas de datos e interfaces que condicionen el resultado. Deja el diseño interno al agente que implemente. El template define dónde documentar estas reglas y con qué detalle.
- Organiza el plan en bloques ordenados con tareas sin marcar y un resultado verificable por bloque. Divide por unidades coherentes, no por una cantidad fija de líneas.
- Redacta criterios de aceptación observables con identificadores `CA-NN`. Cubre fallos y casos límite relevantes, además del resultado satisfactorio.
- Comprueba que alcance, comportamiento, contratos, decisiones, plan y aceptación sean coherentes. Ninguna tarea debe introducir requisitos fuera del alcance.
- Verifica que las referencias a otras SPECs existan y no formen dependencias circulares. Si falta una dependencia necesaria, resuelve la duda antes de dar la definición por completa.

## 5. Guardar directamente

1. Con la rama de la SPEC comprobada en su `cwd`, vuelve a comprobar que `specPath` esté libre si la SPEC es nueva. Si se ocupó, detente y resuelve la colisión sin sobrescribirlo ni escribir en otra rama.
2. Guarda directamente en el `specPath` devuelto, que termina en `specs/NN-slug.md`. Actualiza un archivo existente solo cuando el usuario haya pedido editar o retomar esa SPEC.
3. Usa el estado inicial `Borrador`, o su equivalente en el idioma y las convenciones del proyecto. Guardar el archivo no lo convierte en aprobado ni autoriza su implementación. Al editar una SPEC existente, conserva su estado salvo indicación del usuario. Consulta cualquier cambio de requisitos que no esté acordado.
4. Completa la fecha y las relaciones `Depende de`, `Modifica` y `Reemplaza` según el template. Al editar una SPEC existente, conserva su fecha salvo indicación contraria del usuario o del proyecto. No alteres otras SPECs ni su vigencia automáticamente.
5. Revisa el archivo guardado para detectar secciones incompletas, referencias rotas o contradicciones. Corrígelas antes de terminar.
6. Guarda en Engram el resumen de creación o revisión relevante según [workflow.md](workflow.md). Registra el estado del archivo sin asumir aprobación. Si tienes que detenerte por un bloqueo, registra también el impedimento con la información disponible.
7. Si la carpeta difiere de la de esta sesión, abre su Pi en Herdr con `ox_worktree`, `action: "open"` y `spec`, sin `task`, según [worktrees.md](worktrees.md). No inicies implementación. Si la apertura falla, conserva el archivo y comunica la ruta y el error real.
8. Confirma la ruta, el estado, la rama, la carpeta y el workspace cuando exista. Indica cómo retomarla con `/ox-worktree`. Una vez aprobada, el siguiente comando es `/skill:ox-spec-impl NN-slug`, que continúa en esa misma rama y carpeta.

Termina al guardar y comunicar el resultado. La preparación de la rama forma parte de este comando. No instales dependencias, cambies código ni inicies la implementación desde `/skill:ox-spec`.
