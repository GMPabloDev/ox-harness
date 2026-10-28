---
name: ox-spec
description: Define especificaciones técnicas antes de implementar funcionalidades o cambios relevantes.
disable-model-invocation: true
---

# /skill:ox-spec

Define el cambio y guarda su especificación en una rama propia. Trabaja en la carpeta actual del repositorio. No implementes código durante este comando.

## 1. Entender el contexto

1. Lee completo [template.md](template.md), junto a esta skill. El template define la estructura de la SPEC.
2. Lee las instrucciones aplicables del repositorio, incluidos los archivos `AGENTS.md`. Consulta la documentación y la memoria del proyecto disponibles, como `README.md`. Si existe `docs/foundation.md`, o el documento de fundamentos indicado por el proyecto, léelo completo. Su ausencia no bloquea el flujo.
3. Inspecciona `specs/` y su numeración actual. Lee las dos SPECs relacionadas, si existen, y las que definan contratos afectados o dependencias. Consulta sus commits de `Evidencia` cuando necesites aclarar un contrato, una decisión o un cambio previo. Revisa el código y la configuración relevantes para comprobar el estado actual.
4. Obtén la fecha actual mediante las herramientas del entorno. No deduzcas la fecha a partir de otras SPECs.
5. Usa los argumentos o la conversación como descripción inicial. Si no hay una petición identificable, pregunta qué se quiere construir o cambiar. Un argumento que sea solo un slug kebab-case sirve también como nombre propuesto.

Responde en el idioma del usuario. Escribe la SPEC en el idioma del repositorio salvo indicación contraria. Conserva sus términos y estados, pero aplica la estructura del template actualizado aunque las SPECs antiguas tengan otra forma.

## 2. Resolver las dudas necesarias

Revisa alcance, comportamiento observable, datos, contratos, integración, migración, seguridad, errores y riesgos. Usa primero la información de la conversación y del repositorio. No conviertas estas categorías en un cuestionario obligatorio.

Antes de resolver una decisión o fijar el plan, lee el [selector común de principios](../ox-mode/principles.md). Usa los activadores de definición, contratos y planificación según las decisiones abiertas. Lee completos solo los originales pertinentes y conserva las autorizaciones de esta fase.

Resuelve las dudas con estas reglas:

- Pregunta solo por ambigüedades que cambien el alcance, el comportamiento, los contratos, la compatibilidad o las garantías de seguridad. Agrupa las dudas relacionadas en un bloque breve, de hasta cinco preguntas, y espera la respuesta.
- Ofrece opciones concretas cuando ayuden. Indica la recomendación y su motivo. Usa una herramienta de preguntas si está disponible o una lista numerada si no lo está.
- Respeta las decisiones ya tomadas. Reutiliza los acuerdos vigentes de los fundamentos y distingue las propuestas de los requisitos aceptados. Resuelve sus pendientes solo si afectan a esta SPEC. Si el cambio contradice un acuerdo global, consulta esa diferencia antes de escribir. No preguntes de nuevo por información suficiente ni solicites confirmar hechos comprobados en el repositorio.
- Resuelve detalles internos reversibles usando las convenciones del proyecto. Identifica como propuestas las elecciones nuevas del agente. No las atribuyas al usuario ni inventes requisitos, rutas existentes o garantías.
- Propón separar SPECs cuando haya objetivos independientes o un alcance difícil de implementar y verificar como una unidad. La longitud del objetivo y la cantidad de áreas afectadas son señales, no límites automáticos.

Pasa a la escritura cuando puedas describir qué cambia, qué queda fuera, los contratos y reglas observables, los bloques de implementación y cómo verificar el resultado. No exijas conocer todos los nombres de archivos o funciones internos.

Si la petición ya está definida, continúa directamente. Si el usuario pide guardar aun con dudas importantes, guarda una SPEC en `Borrador` y registra las decisiones pendientes, su impacto y qué bloquean dentro de `Decisiones`. No presentes una cuestión pendiente como resuelta.

## 3. Preparar la rama de la SPEC

1. Identifica la raíz del repositorio y úsala en comandos y rutas. Comprueba que Git tenga al menos un commit y una rama local `main`. Si falta esa preparación, detente antes de escribir y pide resolverla. No inicialices Git ni elijas otra base por tu cuenta.
2. Consulta `git status`, la rama activa, el índice y los cambios existentes. Una operación de merge, rebase, cherry-pick o revert pendiente impide continuar. No la completes ni la abortes por tu cuenta. Antes de cambiar de rama, comprueba que no haya otros agentes o comandos activos en esta carpeta. Exige el índice y el directorio de trabajo limpios. Conserva los cambios existentes y no hagas stash, descartes ni reescribas historia para continuar.
3. Para una SPEC nueva, deriva un slug ASCII kebab-case breve. Consulta la numeración de `specs/` y las ramas locales `spec-*`, incluidos los documentos que solo existan en esas ramas. Usa el siguiente número después del mayor existente, con al menos dos cifras. Reserva `00` solo si el usuario lo pidió. Comprueba que ni el número ni el nombre correspondan a otra SPEC.
4. Crea y activa `spec-NN-slug` desde `main` con `git switch -c spec-NN-slug main` antes de guardar la SPEC. Sustituye `NN-slug` por la referencia elegida. Si la rama ya existe, comprueba si se está retomando una SPEC o hay una colisión. No la recrees ni actualices su base automáticamente.
5. Para editar o retomar una SPEC existente, identifica su rama y usa `git switch spec-NN-slug` si no está activa y la carpeta está limpia. Si ya estás en ella, conserva los cambios sin commit que pertenezcan a esa SPEC. Ante cambios ajenos o una rama ausente, detente y pide resolverlo sin trasladar trabajo de otra SPEC.
6. Confirma la rama antes de editar. Guarda la SPEC solo en `spec-NN-slug`, nunca directamente en `main`. Relee desde esa rama las instrucciones, la SPEC existente, los fundamentos disponibles y los contratos afectados. Resuelve cualquier diferencia con el contexto inicial.

Crear o activar una rama no hace un commit ni publica cambios. Esta skill no autoriza commits, push, merge ni despliegue.

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

1. Con la rama de la SPEC comprobada, vuelve a comprobar que `specs/NN-slug.md` esté libre si la SPEC es nueva. Si se ocupó, detente y resuelve la colisión sin sobrescribirlo ni escribir en otra rama.
2. Guarda directamente en `specs/NN-slug.md` desde la raíz del repositorio. Crea `specs/` si falta. Actualiza un archivo existente solo cuando el usuario haya pedido editar o retomar esa SPEC.
3. Usa el estado inicial `Borrador`, o su equivalente en el idioma y las convenciones del proyecto. Guardar el archivo no lo convierte en aprobado ni autoriza su implementación. Al editar una SPEC existente, conserva su estado salvo indicación del usuario. Consulta cualquier cambio de requisitos que no esté acordado.
4. Completa la fecha y las relaciones `Depende de`, `Modifica` y `Reemplaza` según el template. Al editar una SPEC existente, conserva su fecha salvo indicación contraria del usuario o del proyecto. No alteres otras SPECs ni su vigencia automáticamente.
5. Revisa el archivo guardado para detectar secciones incompletas, referencias rotas o contradicciones. Corrígelas antes de terminar.
6. Guarda en Engram el resumen de creación o revisión relevante con `topic_key: "spec/NN-slug/status"`. Comprueba el proyecto con `mem_current_project` usando la raíz del repositorio como `cwd` y conserva esa raíz en los guardados. Incluye objetivo, ruta, estado leído, rama, decisiones y siguiente paso. No asumas aprobación. Registra también los bloqueos. Si la memoria falla, conserva el archivo e informa sin bloquear la entrega ni afirmar que el guardado tuvo éxito.
7. Confirma la ruta, el estado y la rama. Una vez aprobada, el siguiente comando es `/skill:ox-spec-impl NN-slug`, que continúa en esa misma rama y carpeta.

Termina al guardar y comunicar el resultado. La preparación de la rama forma parte de este comando. No instales dependencias, cambies código ni inicies la implementación desde `/skill:ox-spec`.
