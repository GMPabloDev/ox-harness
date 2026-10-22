---
name: ox-spec-impl
description: Coordina una SPEC aprobada con bloques delegados, TDD, commits locales y revisión final, y ofrece integrarla en dev con confirmación explícita.
disable-model-invocation: true
---

# /skill:ox-spec-impl

## Invocación y modos

```text
/skill:ox-spec-impl NN-slug [--block | --all]
```

Acepta número, slug o nombre del archivo en `specs/`, con o sin extensión. Localiza su carpeta y rama con `ox_worktree`, `action: "resolve"`. Lee completos [worktrees.md](../ox-spec/worktrees.md) al entrar desde otra carpeta o coordinar trabajo paralelo. Si falta la referencia, no encuentras la SPEC o hay varias candidatas, pide identificar una. Solicita corregir opciones desconocidas o modos incompatibles antes de modificar archivos.

| Modo | Ejecución | Pausa de revisión |
| --- | --- | --- |
| `--block`, predeterminado | Completa el siguiente bloque pendiente y sus validaciones. | Espera aprobación antes del siguiente bloque. |
| `--all` | Completa todos los bloques pendientes y verifica la aceptación final. | Continúa entre bloques sin pedir aprobación. |

La invocación autoriza comenzar según el modo elegido, una vez resueltas las comprobaciones previas. Aplica la política de commits locales de [workflow.md](../ox-spec/workflow.md). Un "continúa" en modo por bloques autoriza el siguiente bloque completo. Conserva el modo durante la sesión, salvo cambio explícito del usuario; en una nueva invocación sin opción, aplica `--block`.

El principal conserva esta coordinación. La invocación autoriza delegar los bloques y sus correcciones a `ox-worker`, consultar a `ox-scout` o `ox-researcher` cuando falte evidencia necesaria y ejecutar la revisión final con `ox-reviewer`. Los especialistas son hijos directos del principal. El progreso de la SPEC, los commits, Engram y la aceptación corresponden al principal.

## 1. Leer y comprobar

1. Lee completo [workflow.md](../ox-spec/workflow.md) y aplica sus reglas de ramas, commits, integración y memoria. Resuelve con `ox_worktree` la rama `spec-NN-slug` y su `cwd`. Si la rama existe sin checkout, usa `prepare` con `spec` para materializarla. Lee las instrucciones y la SPEC completa en el `specPath` devuelto, incluidos los cambios sin commit. Si falta la rama, pide prepararla antes de continuar. Lee las referencias que definan contratos afectados. Si existe `docs/foundation.md`, o el documento de fundamentos indicado por el proyecto, léelo también desde esa carpeta. Reutiliza sus acuerdos vigentes, no sus propuestas sin aprobar. Su ausencia no bloquea el flujo. Usa las herramientas disponibles del agente y responde en el idioma del usuario.
2. Comprueba que el estado signifique `Aprobada`, `Aprobado`, `Approved` o su equivalente inequívoco antes de implementar. Una SPEC en `Implementada` o su equivalente inequívoco puede reanudarse solo para verificar su cierre y decidir su integración, si todos sus bloques y criterios figuran completos. Si no está aprobada ni cumple esa condición de cierre, informa del estado o la inconsistencia y pide resolverlo. Una aprobación explícita del usuario sobre la versión actual permite registrar ese estado después de activar la rama de la SPEC. La mera invocación de `/skill:ox-spec-impl` no aprueba una SPEC.
3. Interpreta las secciones por su significado. `Datos y contratos relevantes` es opcional; cuando no exista, usa las reglas del comportamiento y las referencias vigentes. El diseño interno queda a criterio de la implementación dentro de esas restricciones. La ausencia de `Evidencia` en una SPEC antigua no impide empezar. Añádela al cerrar.
4. Comprueba las relaciones `Depende de`, `Modifica` y `Reemplaza`. Identifica las capacidades necesarias y señala referencias rotas, contradicciones y decisiones pendientes que bloqueen la ejecución. La disponibilidad técnica se comprueba en la rama de trabajo durante la preparación.
5. Identifica los bloques de `Plan de implementación`, sus tareas, resultados verificables y criterios `CA-NN` relacionados. Si un plan antiguo solo tiene pasos, trata cada paso principal como un bloque; conserva su estructura. Si faltan límites o resultados suficientes para ejecutar, pide concretarlos.

Comienza tareas solo cuando la SPEC esté aprobada y el siguiente bloque tenga requisitos suficientes. Si todos los bloques figuran completos, prepara el entorno y pasa a la verificación final para comprobarlo en el código.

## 2. Preparar la rama y reanudar

1. Comprueba Git, la rama local `dev` y los cambios existentes según el workflow. Identifica la raíz del repositorio. Resuelve cualquier impedimento antes de escribir archivos.
2. Deriva `spec-NN-slug` del nombre de la SPEC. Usa la rama preparada por `/skill:ox-spec`. Si falta, detente y pide preparar esa rama con la SPEC antes de implementar. No continúes en la rama actual como alternativa.
3. Compara el `cwd` de la SPEC con la raíz Git de esta sesión, no con su subdirectorio actual. Si pertenecen al mismo checkout, continúa aquí usando el `cwd` de la SPEC para comandos y rutas. Si pertenecen a checkouts distintos, entrega la invocación y su modo mediante `open` con un `task` autocontenido según [worktrees.md](../ox-spec/worktrees.md), y termina aquí sin lanzar workers. Si `open` devuelve `current`, continúa aquí. Si Herdr reutiliza otra sesión, indica al usuario que continúe allí sin enviar otra tarea. La sesión de destino vuelve a comprobar aprobación, dependencias e instrucciones. Antes de editar, confirma la rama y relee la SPEC, los fundamentos disponibles y los contratos desde su carpeta.
4. Comprueba que las capacidades de las dependencias estén disponibles en el código de esa rama. Contrasta el progreso registrado con el código, el diff, las pruebas disponibles y, cuando ayude, el historial. Si llegaste con estado `Implementada` y encuentras contradicciones con ese cierre, informa y pide acordar la corrección antes de modificar el progreso o reabrir tareas. En una SPEC aprobada, corrige las marcas que contradigan la evidencia y reanuda la primera tarea pendiente del primer bloque incompleto. Si solo faltaba registrar trabajo ya realizado, verifica y actualiza el progreso.
5. Si reanudas trabajo, identifica los commits ya guardados de la SPEC. Si un bloque verificado conserva cambios sin commit, comprueba que su validación siga vigente y guarda ese cierre antes de avanzar. Reutiliza los commits existentes según el workflow.
6. Guarda en Engram el resumen de inicio o reanudación según el workflow, con el estado leído, la rama, el modo y el bloque pendiente. Si una comprobación previa bloquea el inicio, registra el impedimento sin afirmar que comenzaste a implementar.

Con las dependencias y el entorno de su carpeta disponibles y el progreso comprobado, comunica brevemente la SPEC, la rama, el `cwd`, el modo y el bloque de reanudación. Comienza sin otra confirmación. Antes de implementar otra SPEC en paralelo, comprueba los contratos y dependencias según [worktrees.md](../ox-spec/worktrees.md). Una carpeta aislada no vuelve independiente una tarea dependiente.

## 3. Ejecutar y validar cada bloque

1. Identifica el siguiente bloque pendiente, su resultado verificable y los criterios `CA-NN` exigibles. Para cambiar un requisito o resolver una ambigüedad que afecte al resultado, presenta opciones concretas y espera la decisión del usuario. Refleja el acuerdo en la SPEC antes de continuar y, si modifica una decisión global, actualiza también los fundamentos afectados. Una contradicción entre la SPEC y un acuerdo global requiere resolver la diferencia con el usuario, no elegir uno silenciosamente.
2. Lee completo [el procedimiento de delegación](delegation.md) y encarga el bloque a `ox-worker`. Entrega el punto de reanudación, los contratos, los límites de edición y las validaciones exigidas. El worker aplica las guías TDD indicadas en su procedimiento. Conserva el checkout mientras trabaja y resuelve sus consultas sin ampliar requisitos por tu cuenta.
3. Comprueba la entrega según ese procedimiento. Contrasta el resultado, los criterios y la evidencia TDD con el código y las pruebas. Completa las comprobaciones pendientes. Encarga al worker las correcciones necesarias dentro del alcance antes de avanzar. Separa los fallos previos demostrados de los introducidos por el bloque.
4. Actualiza en la misma SPEC las tareas realizadas y los criterios `CA-NN` efectivamente verificados. Conserva sin marcar los que fallen o no puedas comprobar y registra el impedimento junto al elemento correspondiente. Anota junto al bloque los comandos y resultados, incluida la evidencia RED y GREEN observada por el worker o el principal y cualquier excepción o evidencia no disponible. Mantén el estado `Aprobada` mientras la implementación esté parcial o falte aceptación.
5. Da el bloque por verificado cuando su resultado verificable esté comprobado y sus validaciones obligatorias hayan pasado. Si algo queda bloqueado, registra el impedimento en la SPEC y en Engram y detente antes de avanzar.
6. Guarda los cambios del bloque y el progreso de la SPEC en uno o varios commits locales según el workflow. Confirma el resultado y los hashes antes de continuar. Si no puedes guardar el cierre, registra lo pendiente en la SPEC y en Engram y detente. Una restricción explícita del usuario permite continuar sin commit, comunicando ese pendiente.
7. Guarda en Engram el resultado, las validaciones, los commits y el siguiente paso según el workflow. Comunica el resultado, los cambios principales, las validaciones y los commits locales. En `--block`, si quedan bloques, muestra el siguiente y espera aprobación. En `--all`, continúa directamente con el siguiente bloque. Tras el último, pasa a la verificación final sin una aprobación adicional.

Un bloqueo técnico justifica detenerse cuando no puedas resolverlo dentro del alcance o necesites acceso, información o una decisión del usuario. El modo completo conserva las mismas exigencias de validación, seguridad y compatibilidad. Las ampliaciones de alcance requieren un acuerdo explícito y su actualización en la SPEC, o una SPEC aparte cuando sean independientes.

Al pausar o interrumpir el trabajo, deja registrados en la SPEC el bloque, lo realizado, las validaciones ejecutadas y cualquier impedimento. Si hay un ciclo TDD en curso, indica su punto y el siguiente paso según la guía. Distingue lo guardado en commits de lo que permanece sin commit. Guarda ese resumen en Engram si aún puedes usar las herramientas y el último guardado no cubre esos datos. Usa las tareas existentes como punto de reanudación, sin crear un sistema de seguimiento paralelo.

## 4. Verificar la aceptación y cerrar

1. Comprueba todos los criterios de aceptación contra el resultado integrado. Reutiliza evidencia vigente de los bloques cuando los cambios posteriores no la invaliden y ejecuta las comprobaciones finales exigidas por la SPEC y el repositorio. Si reanudaste una SPEC en `Implementada` y no puedes confirmar su aceptación, informa, registra el impedimento en Engram y detente sin reabrirla ni ofrecer integración.
2. Ejecuta la revisión acumulada con subagentes según [el procedimiento de revisión aislada](../ox-code-review/execution.md), que debes leer completo. Usa el `cwd` de esta SPEC y el hash comprobado de `dev` como referencia fija del paquete, con la comparación por ancestro común predeterminada. Así, una integración de otra SPEC no invalida el paquete por mover el nombre `dev`. Incluye los cambios sin commit y los archivos nuevos pertinentes, y pasa esta SPEC con todos sus criterios como fuente de requisitos. La revisión cubre estándares, requisitos y correctitud por separado. No la limites al diff del directorio de trabajo, que puede estar vacío tras los commits de los bloques. Valida las conclusiones de los revisores y conserva pendiente cualquier eje incompleto o fallido. Si reanudaste una SPEC en `Implementada` y la revisión requiere cambios, informa y pide acordarlos antes de corregir. Encarga las regresiones y los incumplimientos confirmados a `ox-worker` según [el procedimiento de delegación](delegation.md). Acota el encargo a los hallazgos aceptados y los criterios afectados. Comprueba la entrega y la evidencia TDD antes de guardar las correcciones como commits de los bloques afectados. Repite la revisión afectada sobre ese estado antes del cierre documental. Una validación no ejecutable permanece pendiente, con su motivo y el procedimiento necesario para completarla.
3. Marca la SPEC como `Implementada`, o su equivalente en el proyecto, solo cuando todos los bloques y criterios estén completos y las comprobaciones exigidas, incluida la revisión delegada, hayan pasado. En otro caso, conserva `Aprobada` y comunica exactamente qué falta. Si reanudaste un cierre en `Implementada` que no puedes confirmar, aplica la detención del paso 1 sin reabrirlo por tu cuenta.
4. Con la aceptación completa, lee las [reglas de la evidencia](../ox-spec/template.md#reglas-de-la-evidencia) y completa `Evidencia` con los commits comprobados y las verificaciones reales. Resume la revisión en las verificaciones existentes, con la base y la versión revisadas, el resultado por eje y la resolución de los hallazgos. No uses un enlace temporal como única evidencia durable. Añade la sección si falta en una SPEC antigua, sin reestructurar el resto del documento. Sustituye el texto de pendiente por el resultado de la aceptación final.
5. Guarda la SPEC en un commit documental de cierre, separado de los cambios de implementación, solo cuando la aceptación esté completa. Aplica el workflow y reutiliza el cierre existente si no hay cambios nuevos. Una restricción explícita del usuario mantiene el documento sin commit y debe figurar como pendiente.
6. Guarda en Engram el resultado de la verificación final, los commits verificados y los pendientes según el workflow. Distingue la implementación validada de su integración o despliegue. Entrega el resumen del resultado, la rama utilizada, las validaciones, los commits locales y cualquier pendiente. Mantén la rama de la SPEC activa hasta una decisión explícita de integración. El cierre no autoriza push, merge ni despliegue.

## 5. Ofrecer integración en dev

1. Ofrece este paso solo con la aceptación completa y el cierre documental confirmado, también en `--all`. Si quedan validaciones o commits de la SPEC pendientes, comunica el impedimento sin ofrecer integrar. Respeta las reglas del repositorio que exijan PR u otra vía de integración.
2. Muestra la rama real `spec-NN-slug`, su carpeta, el destino `dev` y sus puntas locales comprobadas. Pregunta si el usuario quiere integrarla. Usa una herramienta de preguntas si está disponible o una lista en el chat. Ofrece estas opciones:
   - Integrar localmente en `dev`.
   - Revisar los cambios antes de decidir.
   - Dejar la integración pendiente.
3. Espera una elección explícita. Revisar muestra el resumen, los commits y el diff frente a `dev`, pero no autoriza el merge. Después de esa revisión, espera la decisión. Si el usuario deja la integración pendiente o no responde, conserva la rama de la SPEC y no integres.
4. Solo si elige integrar, lee completo [integration.md](../ox-spec/integration.md) y ejecuta su procedimiento. Si las reglas del repositorio impiden el merge local, explica el requisito sin crear ni publicar una PR por tu cuenta.
5. Guarda la decisión y el resultado en Engram según el workflow, tanto si se integra como si queda pendiente o bloqueada. Comunica origen, destino, rama activa, comprobaciones y commit de integración verificado, si existe. Distingue integración local de publicación y despliegue. No añadas estados ni registros de integración a la SPEC.
