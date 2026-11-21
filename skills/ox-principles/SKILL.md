---
name: ox-principles
description: Selecciona principios ox según la situación de trabajo y dirige al archivo original de cada principio.
disable-model-invocation: true
---

# Seleccionar principios ox

Antes de tomar decisiones, identifica las situaciones de la tarea en el índice. Lee con `read` el `SKILL.md` completo de cada principio aplicable; las rutas son relativas a este directorio. Aplica solo los pertinentes y vuelve a consultar el índice si cambia la tarea. Para verificar un resultado, aplica `prove-it-works` cuando exista un artefacto o comportamiento que se pueda comprobar. No cargues todos los principios por rutina.

La spec aprobada, las instrucciones aplicables y las decisiones del usuario delimitan el trabajo. Los principios no autorizan por sí solos a cambiar requisitos, modificar comportamiento de producto, hacer commits ni alterar Git. Si hay conflicto, informa y pide una decisión. Las autorizaciones concretas del flujo, como el rebase local de `ox-spec-impl` y las correcciones relacionadas de `ox-spec-fix`, siguen vigentes.

## Índice por situación

| Situación | Principio que debes leer |
| --- | --- |
| Decidir alcance, recorrido principal o experiencia de quien usa el resultado | [experience-first](../ox-principle-experience-first/SKILL.md) |
| Organizar tareas, migraciones o cambios repetidos en unidades comprobables | [sequence-verifiable-units](../ox-principle-sequence-verifiable-units/SKILL.md) |
| Verificar un resultado antes de declararlo terminado | [prove-it-works](../ox-principle-prove-it-works/SKILL.md) |
| Escribir, cambiar o evaluar pruebas | [test-behavior-not-implementation](../ox-principle-test-behavior-not-implementation/SKILL.md) |
| Investigar o corregir un bug | [fix-root-causes](../ox-principle-fix-root-causes/SKILL.md) |
| Realizar trabajo no trivial de edición, migración, análisis o verificación | [build-the-lever](../ox-principle-build-the-lever/SKILL.md) |
| Corregir una instrucción o error recurrente con una protección estructural | [encode-lessons-in-structure](../ox-principle-encode-lessons-in-structure/SKILL.md) |
| Integrar un requisito en un diseño existente | [redesign-from-first-principles](../ox-principle-redesign-from-first-principles/SKILL.md) |
| Elegir estructuras fundamentales o secuenciar preparación y funcionalidad | [foundational-thinking](../ox-principle-foundational-thinking/SKILL.md) |
| Diseñar lógica con estados, reglas o estructuras de dominio complejas | [model-the-domain](../ox-principle-model-the-domain/SKILL.md) |
| Validar entradas externas, errores o adaptadores de infraestructura | [boundary-discipline](../ox-principle-boundary-discipline/SKILL.md) |
| Diseñar tipos o firmas en un lenguaje tipado | [type-system-discipline](../ox-principle-type-system-discipline/SKILL.md) |
| Diseñar comandos u operaciones sujetas a reintentos y reinicios | [make-operations-idempotent](../ox-principle-make-operations-idempotent/SKILL.md) |
| Coordinar actores que podrían modificar el mismo estado | [separate-before-serializing-shared-state](../ox-principle-separate-before-serializing-shared-state/SKILL.md) |
| Migrar una API interna cuyos consumidores pueden cambiarse juntos | [migrate-callers-then-delete-legacy-apis](../ox-principle-migrate-callers-then-delete-legacy-apis/SKILL.md) |
| Ejecutar una migración o reescritura planificada con límites de verificación | [outcome-oriented-execution](../ox-principle-outcome-oriented-execution/SKILL.md) |
| Evaluar una refactorización, una abstracción nueva o el tamaño del cambio | [laziness-protocol](../ox-principle-laziness-protocol/SKILL.md) |
| Planear una adición o refactorización que puede simplificarse primero | [subtract-before-you-add](../ox-principle-subtract-before-you-add/SKILL.md) |

Para comparar prototipos, usa `ox-prototype`. No inicies un prototipo sin autorización.
