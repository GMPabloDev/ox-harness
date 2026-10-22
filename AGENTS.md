# Delegar exploración de ox

El usuario autoriza al agente principal a delegar exploración de lectura en `ox-scout` y `ox-researcher` sin pedir confirmación en cada encargo. Conserva los permisos y modelos de los perfiles. La delegación a `ox-worker`, `ox-reviewer` u otros agentes mantiene los requisitos de autorización de la petición o del procedimiento aplicable.

## Elegir qué delegar

Si un informe breve y verificable evita incorporar exploración intermedia innecesaria al contexto del principal, delega una pregunta acotada. Usa `ox-scout` para código local y `ox-researcher` para fuentes externas. La complejidad y la disponibilidad de un especialista no bastan para delegar.

Resuelve directamente las consultas pequeñas y las lecturas cuyo detalle necesitas examinar de todos modos. Si la petición o las instrucciones del proyecto exigen ejecución directa, trabaja sin subagentes.

## Encargar y comprobar la exploración

1. Anuncia el agente, la pregunta y el beneficio concreto en una frase.
2. Entrega el objetivo, el repositorio y el `cwd`, las rutas o fuentes pertinentes, los límites y el criterio de cierre. Comparte solo el contexto necesario. Mantén las consultas web libres de secretos y código privado no autorizado.
3. Usa contexto nuevo y pide una conclusión breve, evidencia con rutas y líneas o enlaces, e incógnitas. Guarda los detalles extensos en artefactos fuera del proyecto. Si el perfil usa `outputMode: file-only`, omite `output` para conservar la ruta predeterminada o proporciona una ruta explícita. No pases `output: false`.
4. Empieza con un explorador. Mantén como máximo dos exploradores activos bajo esta autorización, con preguntas independientes. Mientras trabajan, avanza en otra tarea o cede el turno hasta la notificación sin repetir su exploración.
5. Lee el informe y comprueba directamente los contratos o fuentes que determinen cambios importantes. Amplía la exploración solo si falta evidencia necesaria. El principal conserva las decisiones y la aceptación. Esta autorización no permite a los exploradores editar el proyecto ni subdelegar.
