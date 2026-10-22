---
name: ox-tdd-feature
description: Desarrolla comportamiento nuevo con ciclos TDD pequeños y evidencia verificable.
disable-model-invocation: true
---

# Desarrollar comportamiento nuevo con TDD

Aplica esta guía al añadir una capacidad o cambiar deliberadamente un comportamiento requerido, tanto en proyectos nuevos como existentes. Para corregir un incumplimiento de un contrato existente, lee [ox-tdd-bugfix](../ox-tdd-bugfix/SKILL.md).

## Preparar el siguiente comportamiento

1. Lee completo [test-design.md](test-design.md). Aplica sus reglas de diseño, preparación, límites de verificación y evidencia.
2. Identifica el comportamiento requerido, sus criterios de aceptación y el siguiente resultado observable por el usuario o por quien llama al código. Consulta las pruebas, convenciones, términos del dominio y decisiones de arquitectura relevantes.
3. Elige la interfaz de prueba y el nivel que demuestren ese resultado. Resuelve las elecciones rutinarias con las convenciones existentes. Consulta al usuario solo ante las decisiones indicadas en la referencia.
4. Planifica una entrega vertical pequeña. Comprueba un comportamiento con su implementación antes de escribir las pruebas del siguiente. Si falta un runner, prepara el mínimo necesario para ejecutar una prueba antes de implementar la capacidad.

Si el comportamiento necesita nuevos tipos, estructuras de datos o estado compartido, lee completo [Foundational Thinking](../ox-principle-foundational-thinking/SKILL.md) antes de escribir la lógica. Al considerar abstracciones, capas o un refactor, lee completo [Laziness Protocol](../ox-principle-laziness-protocol/SKILL.md).

## Ejecutar un ciclo

1. RED. Escribe la prueba más pequeña para el comportamiento pendiente a través de la interfaz elegida. Conserva la implementación sin ese comportamiento hasta ejecutar la prueba.
2. Confirma RED. Ejecuta la prueba y comprueba que falle por el contrato ausente o por el resultado incorrecto. Si pasa o falla por otra causa, aplica las reglas de [preparación y RED](test-design.md#preparar-la-ejecución-y-confirmar-red) antes de modificar el comportamiento.
3. GREEN. Implementa solo lo necesario para satisfacer el comportamiento probado. Vuelve a ejecutar la prueba y las pruebas anteriores que el cambio pueda afectar. Confirma que pasan antes de continuar. Deja las capacidades posteriores para sus propios ciclos.
4. REFACTOR, cuando haga falta. Mejora nombres, duplicación o diseño sin cambiar comportamiento. Ejecuta las pruebas afectadas después de cada cambio y conserva GREEN antes de continuar. Mantén las reestructuraciones ajenas fuera de la tarea.
5. Registra la evidencia del ciclo en el progreso existente. Continúa con el siguiente comportamiento pendiente solo después de confirmar GREEN.

Si no puedes obtener un RED significativo, aplica los [límites de la verificación](test-design.md#cuando-red-no-sea-viable). Esa alternativa no demuestra un ciclo TDD.

## Verificar el resultado

Ejecuta las pruebas cercanas y las comprobaciones de integración, tipos o lint que correspondan al cambio. Comprueba los errores y casos límite requeridos, además del caso satisfactorio.

Al pausar, reanudar o terminar, aplica las reglas de [evidencia y reanudación](test-design.md#conservar-evidencia-y-reanudar). Comunica los resultados comprobados y lo que siga pendiente.
