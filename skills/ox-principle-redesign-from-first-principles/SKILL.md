---
name: ox-principle-redesign-from-first-principles
description: Reconsidera un diseño existente cuando un requisito nuevo ya no encaja sin excepciones o cambios estructurales.
disable-model-invocation: true
metadata:
  source: https://github.com/cursor/plugins/blob/main/pstack/skills/principle-redesign-from-first-principles/SKILL.md
---

# Integrar el requisito en el diseño

Aplica este principio cuando un requisito nuevo cuestione las responsabilidades, las invariantes o la representación del diseño actual. Una ampliación que encaje en sus contratos puede seguir la estructura existente.

## Comparar antes de cambiar

1. Lee las partes afectadas y sus contratos, consumidores y pruebas. Identifica qué supuesto del diseño deja de servir.
2. Diseña una alternativa como si el requisito hubiera existido desde el inicio. Compárala con una ampliación local del diseño actual.
3. Valora el comportamiento resultante, la compatibilidad, la conservación de datos, el riesgo y el coste de transición. Elige una dirección por su beneficio para este requisito, no por la oportunidad de rehacer el sistema.
4. Define incrementos integrados y verificables hacia esa dirección. Cada uno debe conservar las garantías vigentes que el requisito aprobado no sustituya.
5. Actualiza las referencias afectadas, incluidos tipos, consumidores, documentación, ejemplos y motivos de decisiones cuando existan. Conserva lo que siga vigente.

La comparación es suficiente cuando puedes explicar qué supuesto cambia, por qué la alternativa elegida lo resuelve y cómo verificar su transición. Pensar el diseño completo no obliga a implementarlo completo en esta entrega.

## Respetar la decisión y el alcance

Durante la definición, registra la elección y su motivo en las decisiones existentes de la SPEC o de los fundamentos. Distingue una propuesta de un acuerdo aprobado.

Durante la implementación, trabaja dentro del bloque y los contratos autorizados. Si la solución requiere cambiar un requisito, ampliar rutas o asumir una migración no acordada, consulta al principal antes de ejecutarla. El principal obtiene la autorización que corresponda. Una reescritura o una mejora independiente necesita su propio alcance.
