---
name: ox-spec-review
description: Revisa una implementación de spec contra sus criterios y los estándares del repositorio mediante dos auditores independientes en paralelo.
disable-model-invocation: true
---

# /skill:ox-spec-review — Revisar una implementación de spec

Revisa la implementación completa, normalmente en una sesión nueva después de implementar los bloques. Los auditores son de solo lectura; el orquestador puede encargar correcciones y actualizar casillas verificadas según el flujo de abajo. No cambies de rama ni el estado de la spec. El usuario cambia manualmente el estado.

Consulta `~/.pi/agent/skills/ox-principles/SKILL.md` y lee los principios aplicables a la revisión. Cada auditor selecciona sus principios de forma independiente.

## Identificar la spec y el alcance

1. Acepta `/skill:ox-spec-review <NN-slug> base <SHA-completo>` o solo el identificador de la spec. Usa el identificador (nombre completo, número o slug) para buscar en `specs/`; si el argumento incluye `base <SHA-completo>`, conserva ese SHA por separado para el paso 2. Si falta el identificador o no hay una coincidencia única, enumera las opciones y pide al usuario que elija. Lee la spec completa.
2. Comprueba la raíz del repositorio, la rama actual y `HEAD`. Si no hay repositorio o `HEAD` válido, detente e informa. Identifica el commit base anterior a la implementación: usa el que indique el usuario o evidencia inequívoca del historial; si no puedes identificarlo con seguridad, pide que lo elija. Revisa desde esa base hasta `HEAD`, incluidos los commits de implementación y corrección de todos los bloques, además de cambios pendientes seleccionados. Nunca uses `HEAD` como base por defecto para una implementación ya committeada.
3. Examina `git status --short`, `git diff --name-status <base> HEAD`, `git diff --name-status <base>`, `git diff --cached --name-status` y `git ls-files --others --exclude-standard`. Examina también el contenido pertinente de los diffs y lee directamente los archivos nuevos: `git diff` no muestra los archivos sin seguimiento. Identifica archivos eliminados y renombrados. Incluye cambios preparados y sin preparar, y advierte si las versiones preparadas difieren del estado actual. No prepares archivos con `git add`.
4. Muestra la spec, la rama, el commit base y los archivos detectados. La spec puede ser nueva y no seguida. Si hay cambios ajenos o de atribución dudosa, pide al usuario que confirme qué archivos incluir. Si no hay cambios identificables, pide aclaración antes de revisar.
5. Guarda un **registro de revisión** en el contexto de la ronda: raíz absoluta, rama, base, `HEAD`, ruta de la spec, archivos seleccionados (incluidos los nuevos no seguidos) y diferencias preparadas relevantes. Antes de lanzar los auditores, toma una huella del contenido de la spec, la base, `HEAD`, la lista seleccionada, el diff comprometido, los diffs preparados y sin preparar, y el contenido de cada archivo nuevo seleccionado. Reutiliza el registro para ambos encargos y vuelve a calcular la huella al recibir los informes. Si cambia, invalida la evidencia de esa ronda para aprobar o marcar casillas y pide revisar un estado estable dentro del límite de rondas.

El alcance son los cambios seleccionados respecto al commit base y los archivos nuevos seleccionados. Los auditores pueden leer otros archivos como contexto, incluido el prototipo local ignorado por Git si la spec lo referencia. Si falta el prototipo o una revisión limitada por archivo no permite verificar un criterio, márcalo como no verificado. La versión final del árbol es el objetivo principal; comunica por separado cualquier diferencia preparada que pudiera entrar en un commit.

## Lanzar las revisiones

Habilita las herramientas de subagentes si es necesario. Lanza `ox-spec-auditor` y `ox-code-auditor` **en paralelo**, cada uno con contexto nuevo (`fresh`). No les transmitas conclusiones del otro ni les pidas corregir archivos.

Usa el mecanismo de workflow de `pi-subagents` con `runs.all` para iniciar ambos. Pasa a cada auditor el alcance del registro, indica modo `final` y pide el informe de su eje. No uses un worktree separado: deben revisar el rango comprometido y los cambios pendientes seleccionados en el árbol actual.

Los auditores pueden ejecutar comprobaciones pertinentes si no son destructivas ni modifican archivos del proyecto o servicios externos. Pueden generarse cachés o artefactos temporales; deben informar de los efectos observados. Si una prueba requiere efectos no seguros, no la ejecutan y registran la limitación. Coordina las pruebas si pudieran interferir entre sí.

Si no se puede lanzar un auditor, falla o no entrega un informe suficiente, no sustituyas su revisión por una suposición. Informa del error como una limitación de cobertura y aplica la tabla de resultados. No cambies de modelo ni de modo de ejecución sin aprobación del usuario.

## Preparar el informe

Lee los informes disponibles, contrasta la evidencia y reúne los hallazgos sin duplicados. Mantén separados el cumplimiento de la spec y la calidad del código. No descartes hallazgos por su importancia sin explicarlo ni conviertas una señal de calidad en fallo automático.

Para cada hallazgo indica eje, importancia (`alta`, `media` o `baja`), ubicación cuando exista, problema, evidencia, consecuencia y posible solución. Para requisitos ausentes cita la spec y lo que se examinó, sin inventar una línea. Indica todos los criterios de aceptación como `cumplido`, `no cumplido` o `no verificado`, con evidencia o motivo. Incluye estándares consultados, pruebas ejecutadas y resultados, pruebas omitidas y limitaciones.

Distingue bloqueantes, mejoras posponibles e hipótesis sin evidencia. Justifica la clasificación según probabilidad e impacto, incluidos riesgos poco frecuentes pero graves. Con evidencia vigente, aplica la primera fila que corresponda:

| Condición | Resultado |
| --- | --- |
| Hay un incumplimiento confirmado o un hallazgo bloqueante. | **Cambios necesarios**. Si falta un informe o evidencia, indica también que la cobertura es parcial. |
| No hay bloqueantes confirmados, pero falta un informe suficiente o algún criterio no está verificado. | **Revisión incompleta**. Indica qué falta para decidir. |
| Ambos auditores completaron su eje, todos los criterios se comprobaron como cumplidos y no quedan bloqueantes. | **Aprobada**. Enumera aparte las mejoras pospuestas; no impiden aprobar. |

La aprobación corresponde al estado auditado y no garantiza ausencia de defectos.

## Correcciones y cierre

Permite como máximo dos rondas de revisión final: cada ronda es una ejecución paralela de ambos auditores y, si corresponde, una ejecución de `ox-spec-fix` para los hallazgos seleccionados. Presenta el informe y pide al usuario seleccionar qué hallazgos corregir o posponer; no impongas perfeccionamiento. Tras el fix, comprueba las pruebas y comunica lo corregido, no confirmado y bloqueado. Una segunda ronda es opcional, previa decisión del usuario; después de ella no inicies una tercera. Si el árbol cambia después de la última auditoría, informa por separado las correcciones y el resultado de sus pruebas. Cierra la versión modificada como **pendiente de auditoría**, no como aprobada: las pruebas posteriores no sustituyen la auditoría.

Con la evidencia vigente al finalizar, el orquestador es el único escritor de casillas: marca únicamente criterios efectivamente verificados, sin marcar los no verificados ni usar una revisión anterior como prueba de código posteriormente alterado. Los auditores y el corrector no editan la spec. Comunica cada casilla actualizada y su evidencia, los criterios pendientes, hallazgos pospuestos y limitaciones. No cambies el estado de la spec; recuerda que el usuario lo cambia manualmente. No hagas commits de la revisión final salvo solicitud explícita.
