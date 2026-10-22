# Delegar un bloque de la SPEC

El principal coordina `ox-spec-impl`. `ox-worker` implementa y valida el encargo. El principal comprueba la entrega, registra el progreso, guarda los commits y lanza la revisión final. Aplica también este procedimiento para corregir hallazgos aceptados.

## 1. Preparar el motor y el alcance

1. Lee la skill instalada `pi-subagents` y carga las referencias que exija para la forma de trabajo elegida. Reutiliza las instrucciones completas mientras sigan en contexto. Usa la API de la versión instalada.
2. Si falta `subagent`, llama `subagents_enable` cuando esté disponible y usa `subagent` en la siguiente solicitud al modelo. Si el motor no está disponible, deja el bloque pendiente y solicita recargar o reparar la instalación.
3. Consulta `action: "get"` para `ox-worker` con `options: { agentScope: "user" }`. Comprueba el modelo y el nivel elegidos en la configuración del usuario. Comprueba sus herramientas, contexto fresco, extensiones ambientales desactivadas y ausencia de subdelegación. Resuelve cualquier sustitución de configuración antes de lanzar.
4. Acota el encargo al siguiente bloque y sus criterios exigibles. Si el bloque contiene componentes independientes que necesitan propietarios distintos, aplica las reglas de partición de `pi-subagents` antes de lanzar escritores. Conserva un único cierre de bloque.
5. Comprueba la raíz Git de la carpeta de esta SPEC, la rama, `HEAD`, el índice y los cambios existentes. Usa su `cwd`, no `repositoryRoot`, que solo identifica la raíz compartida para memoria. Identifica las rutas permitidas y los cambios que el worker debe conservar. Mantén un solo escritor por checkout. El principal tampoco edita la SPEC mientras el worker trabaja. Otros principales pueden trabajar en sus propios worktrees, no en este.

La lectura de una skill no concede herramientas ni permisos. El worker recibe [su procedimiento de ejecución](block-execution.md), no el flujo completo de `ox-spec-impl`. La revisión pertenece al principal y no se ejecuta desde el worker.

El gate del worker comprueba su evidencia estructurada y la conservación del índice inicial. No solicita otro revisor por bloque. La revisión acumulada de la SPEC sigue siendo obligatoria al final y la lanza el principal.

## 2. Entregar un encargo autocontenido

Incluye estos datos sin copiar la conversación completa:

- Objetivo, resultado verificable, bloque y criterios `CA-NN` exigibles. Para correcciones, incluye los hallazgos que el principal haya aceptado y sus bloques afectados.
- Repositorio y `cwd` absolutos, rama y `HEAD` comprobados, ruta de la SPEC aprobada y punto de reanudación.
- Rutas permitidas de código y pruebas, archivos excluidos y cambios previos que debe conservar. La SPEC y el índice quedan bajo responsabilidad del principal.
- Rutas de instrucciones, fundamentos vigentes, contratos, pruebas y evidencia previa necesaria. Incluye la ruta absoluta de `block-execution.md`, resuelta desde esta guía.
- Comandos de validación exigidos y cualquier limitación conocida. Indica una ruta externa al repositorio para las salidas extensas y autoriza solo esa escritura de evidencia adicional.
- Idioma y formato del informe definidos en el procedimiento del worker. Una entrega parcial necesita el punto de reanudación y lo que falte por comprobar.
- Decisiones que debe consultar al principal y condiciones de detención. El encargo no autoriza commits, cambios de rama, publicación, memoria persistente ni delegación.

Cuando falte contexto local necesario, puedes encargar esa pregunta a `ox-scout`. Para una pregunta externa necesaria, puedes usar `ox-researcher`. Comprueba antes cada perfil con `agentScope: "user"`. Usa contexto fresco, un objetivo acotado y salida en artefacto. El scout conserva solo sus herramientas de lectura. El researcher conserva sus herramientas web y carga `pi-web-access` en el hijo. Valida la evidencia recibida e incorpora al encargo solo las conclusiones pertinentes y sus referencias. Omite estas consultas cuando ya tengas evidencia suficiente.

## 3. Lanzar y conservar el checkout

Para un bloque coherente basta una llamada directa. En este ejemplo, `repo` es el `cwd` absoluto de la SPEC y `encargo` contiene el texto comprobado en los pasos anteriores. No añadas `worktree: true`: la rama persistente de la SPEC ya aporta el aislamiento y el principal conserva sus commits.

```js
subagent({
	agent: "ox-worker",
	cwd: repo,
	task: encargo,
	async: true,
	options: {
		agentScope: "user",
		context: "fresh",
		skill: false,
		outputMode: "file-only",
		checkpointBeforeDeadlineMs: 300000,
		share: false
	}
});
```

No añadas límites duros de llamadas o tokens al worker. Acota el trabajo por su resultado y concede margen para terminar la validación y entregar un estado parcial. Un aviso de checkpoint pide terminar la herramienta activa y registrar el estado. Un timeout no demuestra que el sistema de archivos esté en un estado seguro.

Conserva la identidad del run y las referencias reales del motor. En una sesión interactiva, cede el turno y espera la notificación nativa cuando no quede trabajo independiente seguro. Responde las decisiones del worker mediante `subagent_supervisor`, sin conceder una ampliación de alcance que necesite aprobación del usuario. La finalización del lanzamiento no significa que el bloque esté terminado.

## 4. Comprobar la entrega

1. Comprueba el estado final del hijo, su registro de aceptación del motor y su informe. Un error del proveedor, una cancelación, un timeout o un informe ausente o rechazado deja el encargo pendiente. Una salida de éxito del motor no sustituye los criterios de aceptación.
2. Comprueba que la rama, `HEAD`, el índice y la SPEC conserven el estado entregado al worker. Inspecciona el diff y los archivos nuevos. Si aparecen cambios ajenos o no autorizados, conserva la evidencia y resuelve la discrepancia antes de cerrar.
3. Contrasta cada criterio con el código, las pruebas y los resultados recibidos. Reutiliza evidencia vigente y ejecuta las comprobaciones que falten o que los cambios posteriores hayan invalidado. Distingue resultados reportados por el hijo de verificaciones ejecutadas por el principal.
4. Si falta una corrección dentro del alcance, prepara otro encargo acotado para el worker con el estado actual. Reutiliza evidencia todavía válida. No repitas búsquedas ni ciclos TDD ya demostrados solo para recrear su historial.
5. Devuelve a `ox-spec-impl` el resultado comprobado y los pendientes. Solo el principal actualiza la SPEC, guarda los commits y decide si puede avanzar según `--block` o `--all`.

Un fallo de carga, herramientas o infraestructura requiere registrar el error y conservar el estado del repositorio antes de un reintento por el mismo motor. La implementación directa o una CLI alternativa necesitan una autorización explícita para cambiar el modo de ejecución. Si interrumpes un worker, confirma su detención antes de editar y conserva su diff parcial. Registra el punto de reanudación en la SPEC y en Engram sin atribuir validaciones no ejecutadas.
