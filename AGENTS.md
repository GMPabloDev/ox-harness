# Delegación de ox

El usuario autoriza al agente principal a delegar exploración de lectura en `ox-scout` y `ox-researcher` sin pedir confirmación en cada encargo. Conserva sus permisos y modelos. El principal implementa, ejecuta las comprobaciones, corrige y acepta el resultado. La revisión final independiente de `ox-spec-impl` y la comprobación de sus arreglos corresponden a `ox-reviewer`, sin edición. Estos son los tres subagentes de ox. Esta autorización no delega la implementación.

## Elegir qué delegar

Si un informe breve y verificable evita incorporar exploración intermedia innecesaria al contexto del principal, delega una pregunta acotada. Usa `ox-scout` para código local y `ox-researcher` para fuentes externas. La complejidad y la disponibilidad de un especialista no bastan para delegar.

Resuelve directamente las consultas pequeñas y las lecturas cuyo detalle necesitas examinar de todos modos. Si la petición o las instrucciones del proyecto exigen ejecución directa, trabaja sin subagentes.

## Encargar y comprobar la exploración

1. Anuncia el agente, la pregunta y el beneficio concreto en una frase.
2. Entrega el objetivo, el repositorio y el `cwd`, las rutas o fuentes pertinentes, los límites y el criterio de cierre. Comparte solo el contexto necesario. Mantén las consultas web libres de secretos y código privado no autorizado.
3. Usa contexto nuevo y pide una conclusión breve, evidencia con rutas y líneas o enlaces, e incógnitas. Guarda los detalles extensos en artefactos fuera del proyecto. Si el perfil usa `outputMode: file-only`, omite `output` para conservar la ruta predeterminada o proporciona una ruta explícita. No pases `output: false`.
4. Empieza con un explorador. Mantén como máximo dos exploradores activos bajo esta autorización, con preguntas independientes. Mientras trabajan, avanza en otra tarea o cede el turno hasta la notificación sin repetir su exploración.
5. Lee el informe y comprueba directamente los contratos o fuentes que determinen cambios importantes. Amplía la exploración solo si falta evidencia necesaria. El principal conserva las decisiones y la aceptación. Esta autorización no permite a los exploradores editar el proyecto ni subdelegar.

## Revisar el cierre de una SPEC

1. El principal verifica los bloques y revisa sus cambios. No añadas un verificador independiente por bloque ni delegues la implementación por rutina.
2. Al cerrar `ox-spec-impl`, encarga la revisión acumulada a un `ox-reviewer` con contexto nuevo, la SPEC, las instrucciones pertinentes y evidencia de una versión estable. Sigue la guía de revisión de esa skill. No pidas otra aprobación para iniciar esta fase tras el último bloque.
3. `ox-reviewer` solo lee y devuelve hallazgos. Los comandos, tests, arreglos, commits, cambios de estado y decisiones corresponden al principal. Conserva un único escritor y no alteres el contenido mientras se revisa.
4. El principal confirma los hallazgos antes de corregir y aplica `ox-tdd` solo cuando corresponda. Después ejecuta las comprobaciones afectadas y pide una revisión enfocada de los arreglos. No repitas revisiones completas por rutina ni mantengas ciclos sin límite.
5. Una revisión incompleta o un fallo del subagente deja pendiente el cierre. No cambies sus permisos o modelo ni suplas esa revisión por autorrevisión sin autorización. Ningún informe autoriza integrar, publicar o desplegar.
