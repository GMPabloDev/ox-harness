---
name: ox-principle-foundational-thinking
description: Elige las estructuras de datos y la preparación técnica que permiten implementar el comportamiento requerido sin coordinación innecesaria.
disable-model-invocation: true
metadata:
  source: https://github.com/cursor/plugins/blob/main/pstack/skills/principle-foundational-thinking/SKILL.md
---

# Elegir los datos antes de la lógica

Aplica este principio antes de escribir lógica que necesite nuevos tipos, estructuras de datos o estado compartido. Úsalo también para ordenar la preparación técnica y las capacidades que dependen de ella.

## Representar el comportamiento

- Identifica los datos, las invariantes y las operaciones que necesita el contrato actual. Elige estructuras que faciliten sus consultas y actualizaciones habituales.
- Define los tipos centrales antes de implementar las reglas que los usan. Mantén una representación coherente entre componentes en vez de repetir supuestos mediante condiciones dispersas.
- Reutiliza estructuras existentes que sigan representando el problema. La similitud entre unas líneas no obliga a extraer una abstracción.
- Antes de compartir estado, comprueba qué ocurre si otro actor lo modifica durante la operación. Prefiere datos y destinos independientes cuando esa modificación pueda afectar al resultado. Si el recurso debe compartirse, define cómo conservar sus invariantes.

## Preparar lo que necesita la siguiente entrega

Reutiliza las herramientas del proyecto y prepara lo que necesitan las entregas previstas, como el runner de pruebas, los tipos compartidos o las comprobaciones de integración. Evita infraestructura para capacidades hipotéticas.

Si la base afectada contiene código muerto o responsabilidades redundantes, lee completo [Subtract Before You Add](../ox-principle-subtract-before-you-add/SKILL.md) antes de ordenar esa simplificación y la construcción.

Cada incremento debe dejar una capacidad coherente y verificable. Conserva el orden de pruebas e implementación de la guía TDD activa.

## Mantener el nivel de detalle

Este principio no exige ejecutar `ox-foundation` ni diseñar todo el sistema antes de empezar. Los acuerdos globales pertenecen a los fundamentos disponibles. La SPEC fija las reglas de datos y contratos necesarias. Los tipos y estructuras internos reversibles se resuelven durante la implementación.
