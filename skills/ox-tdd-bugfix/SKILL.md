---
name: ox-tdd-bugfix
description: Corrige bugs con una regresión que falla antes del cambio y pasa después.
disable-model-invocation: true
---

# Corregir un bug con TDD

Aplica esta guía a un incumplimiento de un contrato existente. Para añadir una capacidad o cambiar deliberadamente el contrato, lee [ox-tdd-feature](../ox-tdd-feature/SKILL.md).

## Preparar la reproducción

1. Identifica el comportamiento requerido, el comportamiento actual y la reproducción observable más pequeña.
2. Lee completo [test-design.md](../ox-tdd-feature/test-design.md). Aplica sus reglas de diseño, preparación, límites de verificación y evidencia.
3. Elige una comprobación que detecte el bug a través de su interfaz responsable. Reutiliza las convenciones existentes y evita una preparación amplia ajena a la corrección. Una prueba de integración enfocada es válida cuando el contrato la requiere.

Si la corrección exige cambiar la representación de los datos o el estado compartido, lee completo [Foundational Thinking](../ox-principle-foundational-thinking/SKILL.md). Al considerar abstracciones, capas o un refactor, lee completo [Laziness Protocol](../ox-principle-laziness-protocol/SKILL.md).

## Ejecutar la regresión

1. RED. Escribe o ajusta la prueba de regresión más pequeña que habría detectado el bug. Si una prueba existente ya lo reproduce, úsala sin añadir otra equivalente. Obtén la expectativa del contrato requerido, no de la implementación defectuosa.
2. Confirma RED. Ejecuta la prueba antes de corregir el comportamiento. Comprueba que falle por el bug. Si pasa o falla por otra causa, revisa la reproducción según las reglas de [preparación y RED](../ox-tdd-feature/test-design.md#preparar-la-ejecución-y-confirmar-red).
3. GREEN. Haz el cambio de producción más pequeño que cumpla el contrato y conserve los comportamientos cercanos. Vuelve a ejecutar la regresión y confirma que pasa.
4. Si necesitas un refactor local, conserva el comportamiento y vuelve a ejecutar las pruebas afectadas. Mantén las correcciones ajenas fuera de esta tarea.

Si no puedes obtener un RED significativo, aplica los [límites de la verificación](../ox-tdd-feature/test-design.md#cuando-red-no-sea-viable). Prefiere una comprobación útil a una prueba que solo verifique mocks o detalles internos. Declara la limitación en vez de atribuir un ciclo TDD no demostrado.

## Verificar y registrar la corrección

Ejecuta las pruebas cercanas y las comprobaciones adicionales que correspondan al contrato afectado. Si el bug depende de tiempo o estado compartido, busca una reproducción determinista y registra qué condición comprueba. Cuando el bug revele otros casos de la misma clase, verifica primero la regresión original y amplía después la cobertura pertinente.

Al pausar, reanudar o terminar, aplica las reglas de [evidencia y reanudación](../ox-tdd-feature/test-design.md#conservar-evidencia-y-reanudar). Comunica el fallo anterior, el resultado posterior, las validaciones adicionales y cualquier comprobación pendiente.
