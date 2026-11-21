---
name: ox-spec-revise
description: Retoma una spec existente, aclara cambios y actualiza el documento con aprobación del usuario, sin modificar código.
disable-model-invocation: true
---

# /skill:ox-spec-revise — Retomar una spec

Ayuda al usuario a revisar y actualizar una spec existente. No crees otra spec, no modifiques código y no hagas commits ni cambies de rama. La aprobación de la spec corresponde al usuario.

Consulta `~/.pi/agent/skills/ox-principles/SKILL.md` y lee los principios aplicables a los cambios solicitados.

## 1. Identificar la spec

Pi añade los argumentos proporcionados por el usuario a estas instrucciones. Acepta una ruta dentro de `specs/`, el nombre del archivo, su número o su slug. El usuario también puede indicar el motivo de la revisión.

Si no se identifica una spec, enumera los archivos disponibles en `specs/` y pide al usuario que elija. Si no hay coincidencias o hay varias, muestra las opciones y pide aclaración. No crees un archivo nuevo.

Lee la spec completa con `read`. Identifica su estado por su significado, incluida la denominación equivalente usada en el idioma del repositorio. Si no hay estado o no puedes reconocerlo, informa y pide al usuario que lo aclare antes de modificar nada.

## 2. Comprobar el estado

- **Draft o equivalente:** puedes proponer cambios. Conserva ese estado al aplicarlos.
- **Approved o equivalente:** avisa de que modificarla invalida la aprobación anterior. Si el usuario confirma cambios, aplica los cambios acordados y cambia el estado a `Draft` o al equivalente usado en el repositorio. No cambies el estado si no se aplican cambios.
- **Implemented o equivalente:** no la modifiques para añadir o cambiar funcionalidad. Explica que, para esos cambios, el usuario puede crear una spec nueva con `/skill:ox-to-spec`. Detente.
- **Otros estados, incluidos In review y Obsolete:** informa del estado y pregunta cómo quiere proceder el usuario. Detente sin modificar la spec hasta recibir una decisión explícita. No interpretes esa decisión como aprobación de una spec modificada.

Si no conoces el equivalente de `Draft` en el idioma del repositorio, consulta otras specs. Si sigue sin estar claro, pregunta antes de cambiar el estado. Nunca marques una spec como aprobada por iniciativa propia.

## 3. Aclarar y proponer

Resume la ruta, el estado y el objetivo. Si el usuario no indicó qué quiere revisar, pregúntalo. Lee el contexto del proyecto y las referencias pertinentes para entender el cambio; no amplíes el alcance por tu cuenta.

Aclara las dudas que afecten al comportamiento, al alcance o a decisiones pendientes. Agrupa preguntas relacionadas cuando convenga, sin exigir una cantidad mínima. Si una respuesta abre nuevas dudas, sigue preguntando.

Comprueba qué partes de la spec se ven afectadas: alcance, decisiones, dependencias, plan por bloques, criterios de aceptación y referencia visual. Si el usuario eligió un prototipo, registra su ruta local relativa a la spec, la variante exacta, el alcance y las simulaciones pertinentes. Recuerda que `prototypes/` no se guarda en Git. No inventes una elección. Propón los cambios concretos y señala cualquier contradicción o consecuencia para una implementación ya empezada. Si la spec estaba aprobada, indica que pasará a `Draft` al modificarla.

Espera la confirmación explícita del usuario antes de escribir. Si no confirma, no modifiques el archivo. Si la spec cambia durante la conversación, vuelve a leerla y revisa la propuesta con el usuario antes de aplicarla.

## 4. Aplicar e informar

Aplica solo los cambios confirmados en el mismo archivo. Mantén coherentes las secciones afectadas y conserva el origen de la historia, las decisiones y el contenido que no cambia. No inventes requisitos. Si la spec estaba aprobada, actualiza su estado a `Draft` en la misma modificación.

Resume la ruta, el estado resultante y los cambios. Si la implementación ya había empezado, advierte que el código existente podría necesitar ajustes. Recuerda que el usuario debe revisar y aprobar la spec manualmente antes de implementar o continuar. Menciona que puede guardar los cambios con un commit cuando corresponda; no lo hagas por él.

Si no se aplicó ningún cambio, informa del resultado sin afirmar que la spec fue modificada ni cambiar su estado.
