# Ejecutar el encargo del worker

Aplica este procedimiento dentro de `ox-worker` para implementar un bloque autorizado o corregir hallazgos aceptados. El principal prepara el encargo y conserva el progreso de la SPEC, los commits y la aceptación.

## 1. Comprobar el encargo

1. Comprueba que recibes el repositorio, la rama, `HEAD`, la ruta de la SPEC, el bloque o los hallazgos aceptados y los criterios exigibles. Identifica las rutas que puedes editar, los cambios previos que debes conservar y las validaciones obligatorias.
2. Comprueba la raíz Git, la rama y `HEAD` reales antes de editar. Si no coinciden con el encargo, devuelve el impedimento sin cambiar de rama ni restaurar archivos.
3. Lee las instrucciones del repositorio, la SPEC aprobada y los contratos indicados. Lee los fundamentos vigentes cuando existan. Contrasta el punto de reanudación con el código y las pruebas.
4. Confirma que las rutas y las capacidades disponibles permiten obtener el resultado asignado. Escala los requisitos contradictorios o una autorización insuficiente antes de escribir.

La SPEC es una fuente de requisitos de solo lectura para este encargo. El principal registra su progreso. Conserva el índice y los cambios previos. No hagas commits, checkout, stash, reset, rebase, push, merge ni cambios de configuración de Git. Aplica el límite de edición también a los comandos de shell.

## 2. Implementar y validar

Lee completos solo los principios que correspondan al siguiente cambio:

- [Foundational Thinking](../ox-principle-foundational-thinking/SKILL.md) antes de escribir lógica con nuevos tipos, estructuras de datos o estado compartido.
- [Laziness Protocol](../ox-principle-laziness-protocol/SKILL.md) al refactorizar, dimensionar el diff o considerar abstracciones, capas o decisiones repetidas.
- [Redesign from First Principles](../ox-principle-redesign-from-first-principles/SKILL.md) si el requisito aprobado cuestiona el modelo o las responsabilidades existentes.
- [Experience First](../ox-principle-experience-first/SKILL.md) al elegir entre alternativas de interacción o ergonomía dentro del contrato autorizado.
- [Subtract Before You Add](../ox-principle-subtract-before-you-add/SKILL.md) si hay complejidad demostrablemente innecesaria en la parte que debes ampliar.

1. Identifica el siguiente comportamiento pendiente del encargo. Resuelve elecciones internas reversibles con las convenciones del proyecto. Una decisión de producto, un cambio de contrato no aprobado o una ampliación de alcance requiere consultar al principal.
2. Antes de cambiar comportamiento, lee completa la guía correspondiente. Usa [la guía de TDD para capacidades](../ox-tdd-feature/SKILL.md) al añadir comportamiento o cambiar deliberadamente el contrato aprobado. Usa [la guía de TDD para bugs](../ox-tdd-bugfix/SKILL.md) al corregir un incumplimiento. Un encargo mixto puede necesitar ambas.
3. Ejecuta sus ciclos y conserva la evidencia real de RED y GREEN. Aplica sus excepciones y reglas de reanudación. En tareas sin cambio funcional, usa las comprobaciones adecuadas sin fabricar RED.
4. Completa solo los comportamientos autorizados. Conserva los refactors dentro de su alcance y mantén las pruebas afectadas en GREEN.
5. Ejecuta las validaciones exigidas del encargo y las del repositorio que correspondan. Comprueba el resultado verificable, los errores y los casos límite requeridos. Corrige los fallos introducidos dentro del alcance. Separa los fallos previos que hayas podido demostrar.
6. Inspecciona el diff y los archivos nuevos. Confirma que cada cambio pertenezca al encargo y que la rama, `HEAD`, el índice y la SPEC sigan intactos.

Conserva en el informe la evidencia que las guías TDD piden registrar. El principal la traslada al progreso existente de la SPEC. No crees `progress.md` ni otro registro de tareas. Guarda las salidas extensas en el directorio externo indicado en el encargo. Si no tienes una ruta autorizada, solicita una o devuelve una salida acotada.

Ante un posible secreto, detente sin reproducir su valor. Si necesitas ampliar las rutas de edición, ejecutar una operación no autorizada o resolver un impedimento fuera del alcance, consulta al principal. Conserva el trabajo parcial y distingue los fallos reales de las comprobaciones que no pudiste ejecutar.

## 3. Entregar la evidencia

Responde en el idioma del encargo. Incluye estas secciones en la respuesta final:

- `Estado`: `Implementación validada`, `Parcial` o `Bloqueada`. El primer estado exige completar el encargo y sus validaciones obligatorias.
- `Identidad`: repositorio, rama, `HEAD`, ruta de la SPEC y bloque o hallazgos recibidos.
- `Cambios`: archivos modificados o nuevos, comportamiento implementado y cambios previos conservados.
- `Criterios`: evidencia para cada criterio exigible, con rutas y líneas. Conserva pendientes los criterios no demostrados.
- `TDD`: comportamiento, prueba, comando y fallo RED observado, comando y resultado GREEN, o excepción y límite de verificación.
- `Validaciones`: comandos, resultados y códigos de salida reales. Enlaza las salidas extensas e indica qué estado del código validan.
- `Pendientes`: fallos, decisiones necesarias, punto del ciclo interrumpido y siguiente paso.
- `Estado de Git`: confirma las comprobaciones finales de rama, `HEAD`, índice y SPEC. Declara cualquier diferencia sin intentar ocultarla o repararla por tu cuenta.

Termina con el informe estructurado `acceptance-report` que solicite el motor. Usa los campos y los criterios de su contrato. Declara `noStagedFiles` según el índice real, aunque el encargo ya incluyera cambios staged. El motor comprueba por separado que el índice conserve el estado inicial.

Una ejecución interrumpida conserva su estado parcial. La ausencia de evidencia no se convierte en una validación satisfactoria. El principal comprueba la entrega antes de registrar el bloque, crear commits o iniciar la revisión.
