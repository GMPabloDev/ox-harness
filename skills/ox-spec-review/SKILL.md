---
name: ox-spec-review
description: Revisa una implementación de spec contra sus criterios y los estándares del repositorio mediante dos auditores independientes en paralelo.
disable-model-invocation: true
---

# /skill:ox-spec-review — Revisar una implementación de spec

Revisa la implementación sin corregirla. No edites archivos del proyecto, no cambies de rama ni el estado de la spec y no hagas commits. El usuario decide cómo resolver los hallazgos y cambia manualmente el estado de la spec.

Consulta `~/.pi/agent/skills/ox-principles/SKILL.md` y lee los principios aplicables a la revisión. Cada auditor selecciona sus principios de forma independiente.

## Identificar la spec y el alcance

1. Usa el argumento para identificar una spec en `specs/` por nombre completo, número o slug. Si no hay argumento, no existe una coincidencia o hay varias, enumera las opciones y pide al usuario que elija. Lee la spec completa.
2. Comprueba la raíz del repositorio, la rama actual y `HEAD`. Si no hay repositorio o `HEAD` válido, detente e informa del problema. Por defecto, `HEAD` es el punto de comparación; usa otro commit solo si el usuario lo indica y puedes resolverlo.
3. Examina `git status --short`, `git diff --name-status HEAD`, `git diff --cached --name-status` y `git ls-files --others --exclude-standard`. Examina también el contenido pertinente de los diffs y lee directamente los archivos nuevos: `git diff` no muestra los archivos sin seguimiento. Identifica archivos eliminados y renombrados. Incluye cambios preparados y sin preparar, y advierte si las versiones preparadas difieren del estado actual. No prepares archivos con `git add`.
4. Muestra la spec, la rama, el commit base y la lista de archivos detectados. La spec puede ser nueva y no seguida. No supongas que todos los cambios pertenecen a ella: si existen cambios ajenos o no puedes atribuirlos con seguridad, pide al usuario que confirme qué archivos incluir. Si no hay cambios identificables, informa y pide aclaración antes de revisar.

El alcance son los cambios seleccionados respecto al commit base y los archivos nuevos seleccionados. Los auditores pueden leer otros archivos como contexto, incluido el prototipo local ignorado por Git si la spec lo referencia. Si falta el prototipo o una revisión limitada por archivo no permite verificar un criterio, márcalo como no verificado. La versión final del árbol es el objetivo principal; comunica por separado cualquier diferencia preparada que pudiera entrar en un commit.

## Lanzar las revisiones

Habilita las herramientas de subagentes si es necesario. Lanza `ox-spec-auditor` y `ox-code-auditor` **en paralelo**, cada uno con contexto nuevo (`fresh`). No les transmitas conclusiones del otro ni les pidas corregir archivos.

Usa el mecanismo de workflow de `pi-subagents` con `runs.all` para iniciar ambos. En cada encargo incluye la ruta absoluta del repositorio, la rama y el commit base, la ruta de la spec, la lista de archivos seleccionados, las diferencias preparadas relevantes y la instrucción de examinar también los archivos nuevos no seguidos. Asigna a cada auditor su eje y pide el informe definido en sus instrucciones. No uses un worktree separado: debe revisar los cambios actuales sin commit.

Los auditores pueden ejecutar comprobaciones pertinentes si no son destructivas ni modifican archivos del proyecto o servicios externos. Pueden generarse cachés o artefactos temporales; deben informar de los efectos observados. Si una prueba requiere efectos no seguros, no la ejecutan y registran la limitación. Coordina las pruebas si pudieran interferir entre sí.

Si no se puede lanzar un auditor, falla o no entrega un informe suficiente, no sustituyas su revisión por una suposición. Informa del error y presenta el resultado como incompleto. No cambies de modelo ni de modo de ejecución sin aprobación del usuario.

Antes de lanzar los auditores, registra una huella del commit base, de los diffs preparados y sin preparar, y del contenido de cada archivo nuevo seleccionado. Vuelve a calcularla al terminar, incluyendo la lista de archivos seleccionados. Si cambia, informa y no apruebes un resultado que ya no corresponda al estado actual. Pide repetir la revisión sobre un estado estable.

## Preparar el informe

Lee ambos informes, contrasta la evidencia y reúne los hallazgos sin duplicados. Mantén separados el cumplimiento de la spec y la calidad del código. No descartes hallazgos por su importancia sin explicarlo ni conviertas una señal de calidad en fallo automático.

Para cada hallazgo indica eje, importancia (`alta`, `media` o `baja`), ubicación cuando exista, problema, evidencia, consecuencia y posible solución. Para requisitos ausentes cita la spec y lo que se examinó, sin inventar una línea. Indica todos los criterios de aceptación como `cumplido`, `no cumplido` o `no verificado`, con evidencia o motivo. Incluye estándares consultados, pruebas ejecutadas y resultados, pruebas omitidas y limitaciones.

Elige uno de estos resultados:

- **Aprobada**: ambos auditores completaron su revisión, todos los criterios están verificados y no hay hallazgos pendientes.
- **Cambios necesarios**: hay al menos un incumplimiento o hallazgo que requiere resolución. Indica también cualquier comprobación pendiente.
- **Revisión incompleta**: falta evidencia para decidir y no hay hallazgos que ya exijan cambios; incluye fallos de auditor o criterios no verificados.

La aprobación describe la evidencia disponible, no garantiza ausencia de defectos. Si hay hallazgos, deja su resolución al usuario. Sugiere volver a revisar después de los cambios. Tras una revisión satisfactoria, recuerda que el usuario cambia el estado de la spec manualmente antes de su flujo de commits.
