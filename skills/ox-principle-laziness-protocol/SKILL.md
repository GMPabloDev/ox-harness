---
name: ox-principle-laziness-protocol
description: Consolida decisiones repetidas y limita el cambio a lo necesario para resolver el problema completo.
disable-model-invocation: true
metadata:
  source: https://github.com/cursor/plugins/blob/main/pstack/skills/principle-laziness-protocol/SKILL.md
---

# Resolver con el menor cambio coherente

Aplica este principio al refactorizar, evaluar el tamaño de un diff o considerar nuevas abstracciones, capas o parámetros que atraviesen varios componentes.

## Resolver una decisión una vez

Ubica cada política en un punto responsable y transmite su resultado como un dato sencillo. Los consumidores deben usar esa decisión, no volver a deducirla con condiciones equivalentes.

Introduce una abstracción cuando elimine una responsabilidad duplicada o represente un concepto necesario. Prefiere la estructura existente cuando una capa nueva solo añada delegación o configuración.

## Limitar el cambio

Elige el menor cambio que satisfaga el contrato completo y conserve los comportamientos afectados. Incluye las pruebas, los ajustes de contratos y la documentación que esa solución necesite.

Compara la complejidad que queda después del cambio, no solo las líneas del diff. Una corrección breve que repite excepciones puede costar más que modificar la representación responsable.

Mantén las mejoras independientes fuera de la entrega. Reducir líneas no justifica omitir validaciones exigidas, debilitar garantías ni sustituir una corrección por un parche que solo oculte el síntoma.
