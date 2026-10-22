# Revisar estándares

Evalúa la mantenibilidad del cambio con los acuerdos vigentes del repositorio. Los requisitos funcionales pertenecen al eje Spec y los errores de comportamiento al eje Correctitud. Si un problema cruza ejes, conserva la evidencia y señala esa relación.

1. Lee los estándares identificados en `context.md` y los contratos aplicables a los archivos modificados. Distingue una regla documentada de una convención observada o una preferencia.
2. Contrasta cada cambio pertinente con esos estándares. Examina límites de módulos, responsabilidades, duplicación, nombres y calidad de las pruebas cuando el cambio los afecte.
3. Usa los code smells de Fowler para buscar costes concretos. Aplica solo las heurísticas pertinentes al lenguaje y al diseño del proyecto.
4. Informa infracciones sustentadas y mejoras justificadas. Cita la regla cuando exista y explica el coste de no corregir el problema.

Lee completo el principio pertinente cuando el cambio presente alguno de estos costes:

- [Laziness Protocol](../../ox-principle-laziness-protocol/SKILL.md) para capas innecesarias, decisiones repetidas o crecimiento del diff ajeno al objetivo.
- [Subtract Before You Add](../../ox-principle-subtract-before-you-add/SKILL.md) para piezas sin uso o responsabilidades redundantes que la ampliación conserve.

## Aplicar las heurísticas de Fowler

Estas categorías orientan la inspección, no imponen refactors:

- **Bloaters**: métodos o clases grandes, Primitive Obsession, listas largas de parámetros y Data Clumps. Busca conceptos mezclados, invariantes dispersas o cambios difíciles de localizar.
- **Object-orientation abusers**: interfaces incoherentes, Refused Bequest, condicionales repetidos por tipo y Temporary Field. Comprueba si producen estados inválidos o reglas duplicadas. Una jerarquía no es la solución predeterminada.
- **Change preventers**: Divergent Change, Shotgun Surgery y jerarquías paralelas. Identifica qué cambio concreto exige tocar responsabilidades que deberían evolucionar juntas.
- **Dispensables**: comentarios redundantes, Duplicate Code, Lazy Class, Data Class, Dead Code y Speculative Generality. Distingue código innecesario de tipos de datos válidos, comentarios que explican una decisión y duplicación incidental.
- **Couplers**: Feature Envy, Inappropriate Intimacy, Message Chains y Middle Man. Busca dependencias que expongan detalles internos o dificulten probar y modificar el comportamiento.

Los estándares documentados prevalecen sobre estas heurísticas. La longitud, un `switch`, un objeto de datos o un comentario no constituyen por sí solos un hallazgo. Sugiere la corrección más pequeña que elimine el coste demostrado. Evita añadir abstracciones o ampliar el cambio por aplicar una receta.

La revisión está completa cuando examinaste los cambios pertinentes y puedes indicar qué estándares y heurísticas aplicaste. Si faltó material relevante, devuelve cobertura parcial en vez de declarar que el cambio cumple todos los estándares.
