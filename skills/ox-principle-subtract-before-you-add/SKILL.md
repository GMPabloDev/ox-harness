---
name: ox-principle-subtract-before-you-add
description: Simplifica la parte afectada antes de ampliarla cuando exista código, validación o documentación demostrablemente redundante.
disable-model-invocation: true
metadata:
  source: https://github.com/cursor/plugins/blob/main/pstack/skills/principle-subtract-before-you-add/SKILL.md
---

# Simplificar antes de ampliar

Aplica este principio al ordenar una adición, un refactor o una reescritura sobre una base con complejidad innecesaria identificada. No exige una limpieza general antes de cada tarea.

## Comprobar qué sobra

- Verifica los consumidores, los contratos y los efectos antes de considerar una pieza muerta o redundante. La ausencia de una referencia evidente no prueba que se pueda borrar.
- Elimina código sin uso y responsabilidades duplicadas dentro del alcance autorizado. Conserva validaciones y guardas que protejan entradas externas, seguridad o estados legítimos, aunque una SPEC no las enumere.
- Diseña para el uso conocido y las garantías requeridas. Añade validadores, parsers y opciones cuando exista una necesidad concreta, no para escenarios imaginados.
- Simplifica prompts y documentos quitando instrucciones repetidas y plantillas sin utilidad. Sustituye la repetición por referencias con disparadores claros cuando el agente pueda leerlas. Conserva el contexto necesario para cada encargo aislado.
- Cuando una referencia ya no aporte contenido propio, elimina el archivo y corrige sus enlaces y consumidores. Conserva los documentos que sigan teniendo una función operativa.

## Ordenar la simplificación

Retira primero lo innecesario cuando puedas verificar esa retirada por separado. Si quitar y construir deben ocurrir juntos para conservar un estado coherente, entrégalos como un incremento verificable.

Mantén las pruebas afectadas en GREEN. Una limpieza ajena al requisito se propone aparte; un bug localizado no autoriza reorganizar el módulo. El resultado debe reducir complejidad sin perder comportamiento requerido ni ampliar los permisos de la fase activa.
