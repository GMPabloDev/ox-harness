---
name: ox-mode
description: Elige la siguiente fase de ox para una petición y conecta los principios pertinentes sin cargar todos ni ampliar la autorización.
disable-model-invocation: true
---

# /ox-mode

Usa ox para la tarea indicada. Elige el siguiente procedimiento existente y aplica los principios según la decisión que debas tomar. Este comando no ejecuta todas las fases ni activa un estado persistente.

## 1. Identificar la tarea y su autorización

Usa los argumentos y la conversación para identificar el resultado pedido, el proyecto y el trabajo ya autorizado. Sin una tarea identificable, pregunta cuál es antes de actuar. Si falta información que cambie la fase o su autorización, pregunta solo por esa diferencia.

`on`, `off` y `status` no son controles de esta versión. Si constituyen toda la petición, explica el uso `/ox-mode [petición]` y termina sin iniciar trabajo.

Trata la petición concreta como entrada al procedimiento elegido, con la autorización que este reconoce y sus comprobaciones previas. Elegirlo no aprueba requisitos ni amplía permisos. Conserva las instrucciones del proyecto y las decisiones vigentes. No cambies modelos, herramientas, perfiles de agentes ni textos de principios para activar ox. Activar el comando sin una petición de trabajo no autoriza commits, experimentos, implementación, integración ni publicación.

## 2. Elegir el siguiente procedimiento

Lee completo el procedimiento elegido y sigue sus comprobaciones, autorizaciones y condiciones de cierre. Conserva la referencia de la SPEC y las opciones indicadas por el usuario. En implementación, la ausencia de opción conserva el modo `--block` de la skill.

| Petición actual | Procedimiento |
| --- | --- |
| Definir o revisar acuerdos globales del proyecto | [ox-foundation](../ox-foundation/SKILL.md). |
| Ejecutar un prototipo desechable para resolver una decisión | [ox-prototype](../ox-prototype/SKILL.md), solo si ese experimento está autorizado. |
| Definir o revisar una SPEC antes de implementar | [ox-spec](../ox-spec/SKILL.md). |
| Implementar o reanudar una SPEC identificada | [ox-spec-impl](../ox-spec-impl/SKILL.md). Su aprobación y las demás comprobaciones previas siguen siendo necesarias. |
| Revisar el cambio de una SPEC o sus arreglos sin iniciar implementación | [Guía de revisión](../ox-spec-impl/review.md), dentro del alcance solicitado. |
| Corregir un bug con petición de TDD, un test que falle o una regresión, o con una vía local clara y económica | [ox-tdd](../ox-tdd/SKILL.md). Conserva el procedimiento de corrección de la SPEC cuando corresponda. |

Para una tarea acotada que no necesite esos procedimientos, sigue la petición directamente dentro de su autorización y usa el selector de principios. No crees una SPEC, un prototipo ni infraestructura de pruebas solo para completar el recorrido.

Si falta definición para implementar un cambio relevante, propone concretarla con `ox-spec`. No sustituyas la aprobación que falta por la activación de ox. Si una decisión necesita un experimento aún no autorizado, propón ese paso y espera.

## 3. Seleccionar los principios y continuar

Lee el [selector común de principios](principles.md) antes de la siguiente decisión. Usa sus activadores para leer completos los originales pertinentes. No cargues todos por fase ni una selección fija para toda la tarea.

Comunica brevemente la fase elegida y, cuando aclare una decisión, qué principio la activa. Continúa solo con el trabajo autorizado. El principal implementa y verifica. La revisión final independiente y la comprobación de arreglos de una SPEC corresponden a `ox-reviewer` según su guía, sin añadir verificadores por bloque.

Respeta la pausa o el final del procedimiento elegido. Terminar una fase no autoriza iniciar la siguiente. Al reanudar la tarea, comprueba de nuevo su estado y la siguiente decisión. No guardes la activación de `/ox-mode` como una preferencia global ni la extiendas a tareas futuras.

## Comprobar esta conexión

Desde la raíz de esta configuración, ejecuta `node --test skills/ox-mode/tests/*.test.mjs`. Estas pruebas comprueban los loaders de Pi, la expansión del comando y las rutas. No demuestran por sí solas que un modelo seleccione bien los principios o complete una SPEC real. Usa `/reload` para descubrir el comando en una sesión abierta.
