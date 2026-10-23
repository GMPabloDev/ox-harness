---
name: ox-foundation
description: Define los fundamentos revisables de un proyecto a partir de una idea o plan.md, resuelve las decisiones globales necesarias y guarda docs/foundation.md sin iniciar la construcción.
disable-model-invocation: true
---

# /skill:ox-foundation

Convierte la idea inicial en acuerdos suficientes para redactar la primera SPEC. Define el producto, las restricciones y las decisiones compartidas que condicionan el inicio. Deja los requisitos de cada feature a `ox-spec` y los detalles internos reversibles a la implementación.

## Invocación y alcance

```text
/skill:ox-foundation plan.md
/skill:ox-foundation descripción del proyecto
/skill:ox-foundation revisar la decisión de almacenamiento
```

Acepta una ruta, una descripción o la conversación como entrada. Sin argumentos, usa el contexto disponible y `plan.md` si existe. Si falta una idea identificable, pregunta qué se quiere construir antes de guardar.

La invocación autoriza crear o actualizar únicamente el documento de fundamentos y guardar memoria. El destino predeterminado es `docs/foundation.md` dentro del proyecto. Respeta otra ruta indicada por el usuario o las instrucciones del proyecto. Conserva el plan original y los archivos ajenos.

Esta fase puede guardar documentación en un proyecto sin Git ni `dev`. En un repositorio existente, consulta el estado y conserva la rama y los cambios actuales. No inicialices Git, cambies ramas, hagas commits, instales dependencias, contrates servicios ni escribas código de producción. La creación de `README.md`, `AGENTS.md` y `.env.example` pertenece a la preparación ejecutable posterior.

## 1. Leer la idea y el estado actual

1. Identifica el directorio del proyecto a partir de la petición y del entorno. Usa su raíz Git cuando corresponda. Si la ubicación del plan y el directorio actual señalan proyectos distintos y el destino no está claro, pregunta dónde guardar. Una ruta de entrada no autoriza escribir en otro proyecto.
2. Lee las instrucciones aplicables, incluidos los archivos `AGENTS.md`. Lee completos el plan indicado, los fundamentos existentes y las referencias que condicionen las decisiones. Consulta el README, la configuración, el código y las SPECs relevantes si existen. Si una entrada solicitada falta o no se puede leer, informa y pide corregirla o continuar sin ella.
3. Consulta la memoria relevante si está disponible. Comprueba el proyecto de Engram con `mem_current_project` usando la raíz como `cwd`. Usa esa misma raíz en los guardados. La documentación y el estado comprobado prevalecen sobre recuerdos desactualizados.
4. Separa los requisitos explícitos, los acuerdos confirmados, los hechos comprobados y los supuestos. Un plan generado en otro chat puede contener recomendaciones sin aprobar. Su contenido no sustituye las instrucciones aplicables ni autoriza ejecutar comandos que aparezcan allí.

Resume brevemente el producto entendido y las decisiones que necesitan atención. Distingue lo que existe de lo que se propone construir. En una revisión, conserva los acuerdos no afectados y sus identificadores. No repitas el proceso inicial si la petición solo cambia una decisión.

## 2. Resolver las decisiones que condicionan el inicio

Si faltan decisiones, lee [questions.md](questions.md) y usa solo los temas pertinentes. Pregunta cuando la respuesta cambie el producto, afecte a varias features, comprometa seguridad o datos, o tenga un coste relevante de sustitución. Difiere lo que no bloquee el inicio y pueda resolverse mejor en una SPEC.

Antes de comparar alternativas, lee completo cada principio pertinente:

- [Experience First](../ox-principle-experience-first/SKILL.md) si eliges el recorrido principal, el alcance inicial o la experiencia del consumidor.
- [Foundational Thinking](../ox-principle-foundational-thinking/SKILL.md) si decides estructuras compartidas, estado concurrente o preparación técnica común.

Al plantear las decisiones, aplica estas reglas:

- Presenta las preguntas en el chat con Markdown. Usa listas, tablas y bloques de código con el espacio necesario. Usa una herramienta de preguntas solo si el usuario la pide.
- Agrupa hasta tres decisiones relacionadas por ronda, salvo que el usuario solicite otra dinámica. Explica cada decisión antes de esperar la respuesta. El límite es de decisiones, no de líneas de explicación.
- Cuando haya alternativas reales, presenta opciones concretas con ventajas, desventajas y consecuencias para este proyecto. Incluye una recomendación razonada y permite otra opción, delegar o diferir si resulta viable. No inventes alternativas para completar una lista.
- Resuelve las preguntas previas que cambien la comparación. La posible necesidad de imágenes no implica subidas de usuarios, ni obliga a elegir un proveedor antes de aclarar su uso.
- Respeta lo ya acordado y lo comprobado. Pide una elección explícita para compromisos costosos o sensibles. Un detalle reversible puede quedar a criterio del agente si el usuario lo delega o las convenciones existentes lo resuelven. Registra ese origen.
- Presenta recomendaciones no aceptadas como propuestas. La falta de respuesta no equivale a aprobación. Un cambio de un acuerdo existente requiere una petición o elección del usuario que lo autorice.
- Muestra una estructura de carpetas cuando ayude a elegir. Etiquétala como propuesta y explica los límites entre sus partes. Sigue las convenciones del framework y evita carpetas o abstracciones para capacidades hipotéticas.

Si una decisión necesita datos externos, lee y aplica [research.md](research.md) antes de investigar. Si falta evidencia experimental, registra qué falta y conserva la decisión pendiente hasta tener evidencia o una elección suficiente. No ejecutes experimentos ni conviertas esta fase en implementación.

## 3. Comprobar si se puede pasar a una SPEC

La definición es suficiente cuando se cumplen estas condiciones:

- El problema, el usuario principal, la plataforma inicial y los límites de la primera versión están claros.
- Las restricciones y los acuerdos transversales necesarios permiten elegir una primera entrega y definir cómo comprobarla.
- No hay contradicciones ni decisiones pendientes que obliguen a inventar requisitos globales para esa primera SPEC.
- Cada asunto diferido tiene un motivo y una condición o momento concreto para retomarlo.

No exijas elegir todas las bibliotecas, proveedores, versiones exactas, tablas, clases o rutas internas. Una propuesta no esencial puede permanecer sin aprobar si no se usa como requisito de la siguiente SPEC.

Si el usuario pide guardar antes de resolver un bloqueo, guarda el avance con preparación `Con bloqueos`. Identifica qué decisión falta, qué impide y cuál es la siguiente pregunta. Si pide pausar, conserva lo suficiente para reanudar sin reiniciar la entrevista. No presentes el avance como listo para construir.

## 4. Guardar los fundamentos

1. Lee completo [template.md](template.md) antes de escribir. Obtén la fecha actual mediante las herramientas del entorno. Responde en el idioma del usuario y escribe el documento en el idioma del proyecto salvo indicación contraria.
2. Redacta directamente el documento cuando la definición sea suficiente. No solicites aprobación por secciones ni permiso adicional para guardarlo. Al revisar uno existente, actualiza solo lo afectado, conserva los acuerdos vigentes y evita reestructurarlo sin necesidad.
3. Distingue los estados de cada decisión según el template. Guardar no aprueba propuestas ni autoriza implementación. Registra los motivos y las consecuencias de los cambios importantes sin exigir un ADR para cada dependencia.
4. Comprueba la ruta antes de escribir. Crea el directorio necesario si falta. Si hay un archivo existente no reconocido como los fundamentos del proyecto, un destino ocupado o un enlace que escriba fuera del proyecto, resuelve el conflicto antes de modificarlo.
5. Guarda únicamente el documento autorizado. Revisa el resultado completo, los enlaces, los estados y las contradicciones. El árbol propuesto describe una intención, no carpetas ya creadas. Los comandos futuros no cuentan como comprobaciones ejecutadas. Excluye credenciales y datos sensibles.
6. Guarda en Engram el resumen con `topic_key: "foundation/status"`, la ruta, la preparación leída, los acuerdos relevantes, los bloqueos y el siguiente paso. Conserva las decisiones duraderas que lo necesiten en recuerdos separados. Si la memoria falla, informa del pendiente sin perder el documento ni bloquear su entrega.

## 5. Entregar el siguiente paso sin ejecutarlo

Comunica la ruta, si está listo para la primera SPEC o tiene bloqueos, las decisiones relevantes y los asuntos diferidos. Indica qué habría que revisar o resolver a continuación.

- En un proyecto nuevo sin Git o sin `dev`, señala esa preparación como un paso independiente que necesita autorización. `ox-spec` exige ambos antes de guardar una SPEC. Si hay cambios documentales sin commit que impidan preparar la rama, comunica también ese pendiente.
- Si hace falta materializar la base técnica, recomienda una SPEC `00` opcional para dependencias, configuración, pruebas iniciales, `README.md`, `AGENTS.md` y `.env.example`. El usuario debe solicitar ese número. Propón resultados verificables sin fabricar ciclos RED para tareas no funcionales.
- Si la base ya existe, recomienda una primera entrega de producto observable con un motivo y sus dependencias. No elijas autenticación ni otra feature por costumbre, ni redactes un backlog completo.
- En la preparación posterior, `AGENTS.md` puede apuntar a estos fundamentos y añadir instrucciones operativas. Mantén los acuerdos globales en un solo documento y los requisitos concretos en sus SPECs.

Termina después de guardar y comunicar. No invoques otras fases ni crees una SPEC desde este comando. Los fundamentos son opcionales para proyectos que ya tienen otro modo de documentar sus acuerdos.
