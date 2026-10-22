---
name: ox-principle-experience-first
description: Compara decisiones de producto, interacción y alcance por el resultado que recibe quien usa o mantiene el trabajo.
disable-model-invocation: true
metadata:
  source: https://github.com/cursor/plugins/blob/main/pstack/skills/principle-experience-first/SKILL.md
---

# Elegir por la experiencia del consumidor

Aplica este principio ante decisiones de producto, UX, alcance o ergonomía de una API. El consumidor puede ser el usuario final, quien importa una biblioteca, quien ejecuta una CLI o el siguiente mantenedor.

## Comparar el resultado

- Identifica quién usa el trabajo, qué tarea necesita completar y qué resultado espera. Compara las alternativas desde esa tarea, no desde la comodidad de implementarlas.
- Justifica cada capacidad, control y opción. Propón reducir alcance cuando eso permita resolver mejor el recorrido principal. Conserva los requisitos acordados hasta que el usuario apruebe cambiarlos.
- Considera el recorrido completo y los detalles que lo afectan, como respuesta a las acciones, estados de error, recuperación, foco y accesibilidad. En una API, incluye el significado de entradas, resultados y errores.
- Si ya estás ejecutando [ox-prototype](../ox-prototype/SKILL.md), usa ese experimento para comparar las alternativas. Si la decisión necesita observar una interacción o un comportamiento y no hay un experimento autorizado, propón uno acotado y espera autorización.
- Distingue lo observado de tu juicio de diseño. Una preferencia o una captura no demuestra una mejora de usabilidad, conversión o rendimiento.

## Ajustar la calidad a la entrega

En producción, prioriza un recorrido principal bien resuelto frente a capacidades adicionales incompletas. En un prototipo, construye solo el detalle que permita evaluar la decisión; el acabado del producto pertenece a la implementación posterior.

Valora las alternativas dentro del presupuesto, el alcance y las garantías de seguridad y accesibilidad acordados. Foundational Thinking orienta la representación y el orden del trabajo. Este principio orienta el resultado que esas decisiones deben servir.
