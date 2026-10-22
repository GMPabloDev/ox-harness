# Formato de los fundamentos

El documento recoge los acuerdos vigentes del proyecto y las cuestiones que quedan abiertas. No es una SPEC, un backlog ni evidencia de implementación. Usa las secciones que aporten información y conserva el detalle proporcional al proyecto. Sustituye los marcadores por contenido real y elimina las instrucciones del formato.

## Estructura

````markdown
# Fundamentos de [nombre del proyecto]

> Actualizado: YYYY-MM-DD
> Preparación: Lista para la primera SPEC | Con bloqueos
> Entradas: [Rutas reales o conversación usada para definir la idea.]

## Producto

[Problema, público, tarea principal y plataforma inicial. Distingue lo confirmado de los supuestos todavía relevantes.]

## Alcance de la primera versión

[Resultado observable que se busca y capacidades excluidas o posteriores. No enumeres cada feature futura.]

## Restricciones y estado actual

[Restricciones conocidas que condicionan las decisiones. Diferencia código, configuración y servicios existentes de los que se propone crear. Explica las incertidumbres relevantes sin inventar cifras.]

## Decisiones del proyecto

### FND-01. [Decisión o cuestión concreta]

- Estado: [Acordada, Propuesta, Pendiente o Diferida.]
- Elección o cuestión: [La opción elegida, recomendada o todavía por resolver.]
- Motivo y consecuencias: [Por qué importa y qué compromisos introduce.]
- Origen: [Respuesta explícita, delegación, acuerdo documentado o propuesta del agente.]
- Alternativas consideradas: [Solo si se compararon y su descarte aporta contexto.]
- Revisar cuando: [Condición concreta si la decisión es diferida, provisional o costosa de sustituir.]
- Bloquea: [Qué impide definir o construir si existe un pendiente.]
- Fuentes: [Referencias realmente consultadas si la decisión depende de ellas.]

[Repite solo para decisiones relevantes. Pueden abarcar arquitectura, stack, datos, seguridad, operación, pruebas y convenciones. Omite campos opcionales que no aporten información.]

## Estructura inicial propuesta

[Incluye esta sección solo si un árbol ayuda a explicar límites o convenciones acordados. Muestra un bloque de texto con las partes pertinentes y explica sus responsabilidades. Identifica lo existente y lo propuesto.]

## Próximo paso

[Propón una primera entrega observable y su motivo. Distingue la preparación ejecutable de la primera capacidad de producto. Identifica si falta preparar Git y dev, si conviene solicitar una SPEC 00 o qué decisión bloquea la siguiente SPEC. No ejecutes esos pasos ni redactes su plan de implementación.]
````

## Estados de decisión

- `Acordada` recoge una elección explícita del usuario, un acuerdo vigente documentado o una decisión tomada dentro de una delegación suficiente. El origen debe permitir distinguirlos. Un documento externo no confirma por sí solo la aprobación de sus sugerencias.
- `Propuesta` recoge una recomendación todavía no aceptada. No es una restricción obligatoria ni puede cubrir una decisión global necesaria para la siguiente SPEC.
- `Pendiente` identifica una elección o un dato que falta resolver. Incluye su impacto, qué bloquea y la siguiente pregunta o comprobación.
- `Diferida` registra la decisión de no resolver un tema todavía. Incluye por qué puede esperar y el momento o la condición para retomarlo. No encubre un bloqueo necesario para el siguiente paso.

El estado de preparación resume si se cumplen los criterios de cierre de `ox-foundation`. `Lista para la primera SPEC` no significa aprobación de propuestas, base técnica creada ni permiso para implementar. Puede haber asuntos abiertos que no afecten a esa primera SPEC. Usa `Con bloqueos` cuando falte una decisión necesaria para definirla.

## Reglas del contenido

- Conserva identificadores `FND-NN` al revisar. Usa el siguiente número libre para una decisión nueva. Las SPECs pueden referenciar esos acuerdos sin copiar todo su contenido.
- Mantén cada acuerdo en una sola entrada. Agrupa por tema si el documento crece, sin duplicar las decisiones en otras secciones.
- Para cambiar un acuerdo, registra la nueva elección autorizada y su motivo en la entrada correspondiente. Conserva una nota breve del cambio cuando explique contratos o costes relevantes. Un ADR separado es opcional para decisiones que necesiten más historial.
- Resume las convenciones con reglas verificables. Respeta la configuración y los comandos reales como fuente de su estado actual. Los archivos y comandos que aún no existen se describen como trabajo futuro.
- Registra las fuentes junto al hecho o decisión que respaldan. Para información externa variable, incluye la fecha de consulta y las limitaciones conocidas. No añadas una sección de enlaces sin relación con decisiones concretas.
- Omite apartados opcionales y campos sin contenido útil. Un requisito todavía desconocido se registra como tal, con su impacto, en vez de dejar marcadores sin sustituir.
- Guarda en este documento los acuerdos globales. `AGENTS.md` puede enlazarlo cuando se prepare el proyecto. Cada SPEC conserva sus propios requisitos, tareas y aceptación.
