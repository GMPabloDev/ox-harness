---
name: ox
description: Elige el siguiente comando de ox según la tarea, sin iniciar trabajo ni imponer todas las fases.
disable-model-invocation: true
---

# Elegir el siguiente paso de ox

Este comando orienta al usuario hacia un procedimiento existente. No es otro agente ni ejecuta el flujo completo.

1. Usa la petición y el contexto disponible para identificar el objetivo. Si falta, pregunta qué quiere construir, corregir o revisar.
2. Elige una entrada de la tabla. Respeta una elección explícita del usuario y las instrucciones del proyecto.

| Necesidad | Siguiente comando | Procedimiento |
| --- | --- | --- |
| Definir una funcionalidad o un cambio relevante | `/skill:ox-spec <descripción>` | [Definir la SPEC](../ox-spec/SKILL.md) |
| Implementar una SPEC aprobada o retomar su cierre | `/skill:ox-spec-impl NN-slug --block` | [Implementar la SPEC](../ox-spec-impl/SKILL.md) |
| Corregir un bug pequeño sin un plan por bloques | `/skill:ox-tdd-bugfix <bug>` | [Corregir con TDD](../ox-tdd-bugfix/SKILL.md) |
| Añadir comportamiento pequeño ya definido, sin una SPEC necesaria | `/skill:ox-tdd-feature <comportamiento>` | [Desarrollar con TDD](../ox-tdd-feature/SKILL.md) |
| Revisar cambios existentes | `/skill:ox-code-review` | [Revisar los cambios](../ox-code-review/SKILL.md) |
| Resolver acuerdos técnicos compartidos todavía abiertos | `/skill:ox-foundation <proyecto>` | [Definir fundamentos](../ox-foundation/SKILL.md) |
| Observar o comparar una decisión antes de implementarla | `/skill:ox-prototype <pregunta>` | [Probar una alternativa](../ox-prototype/SKILL.md) |

3. Para una SPEC, comprueba si el proyecto tiene Git, al menos un commit y una rama local `dev`. Si falta esa preparación, explica qué debe autorizar el usuario antes de iniciar. Este comando no inicializa Git, crea ramas ni hace commits.
4. Devuelve el comando elegido con los argumentos conocidos y una explicación breve. Sustituye los marcadores de la tabla. Para implementar, usa `--block` salvo que el usuario haya elegido `--all`. La SPEC debe estar aprobada; elegir el comando no la aprueba.

Termina después de orientar. Espera la invocación del procedimiento elegido antes de editar o delegar. El usuario puede omitir este índice e invocar directamente cualquier skill.

No exijas fundamentos ni prototipos cuando el cambio no los necesite. Los procedimientos leen los principios pertinentes por ruta; el usuario no tiene que invocarlos todos. La revisión final ya forma parte de `ox-spec-impl`, por lo que no hace falta pedirla otra vez para cerrar la misma versión. La integración sigue necesitando su confirmación explícita.
