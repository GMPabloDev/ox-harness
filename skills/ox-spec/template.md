# Template de especificación

Usa esta estructura al crear una SPEC con `/skill:ox-spec`. Sustituye los marcadores por contenido concreto y elimina las instrucciones entre corchetes. Conserva el orden de las secciones. `Datos y contratos relevantes` es opcional; las demás se mantienen. Añade subsecciones según el cambio.

## Estructura

```markdown
# SPEC NN — Título breve y descriptivo

> **Estado:** Borrador
> **Fecha:** YYYY-MM-DD
> **Objetivo:** [Resultado principal expresado en una frase clara.]
> **Depende de:** Ninguna
> **Modifica:** Ninguna
> **Reemplaza:** Ninguna

## Contexto

[Situación actual comprobada, problema que se resuelve y restricciones relevantes del proyecto.]

## Alcance

### Incluye

- [Capacidad o cambio concreto que entrega esta SPEC.]

### No incluye

- [Capacidad relacionada que queda excluida o diferida.]

## Comportamiento esperado

### [Flujo o capacidad]

1. [Ante una condición o acción concreta, el sistema produce un resultado observable.]
2. [Reglas de validación, transiciones de estado y respuesta ante fallos relevantes.]

## Datos y contratos relevantes

[Incluye esta sección solo cuando hagan falta reglas de datos o interfaces que no estén ya claras en el comportamiento o en las referencias existentes. Omítela en los demás casos.]

- [Dato que debe conservarse, restricción de integridad o formato que condiciona el resultado.]
- [Entrada, salida o error cuyo significado o estructura deba mantenerse entre componentes o sistemas.]

## Migración y compatibilidad

- [Qué ocurre con instalaciones, datos o consumidores existentes al aplicar el cambio.]
- [Comportamiento ante una actualización fallida y estrategia de recuperación cuando aplique.]

## Seguridad y privacidad

- [Frontera de confianza, autorización y tratamiento de datos sensibles aplicables.]
- [Información permitida y excluida en respuestas, persistencia y registros.]

## Decisiones

- **DEC-01. [Decisión adoptada].** [Motivo y consecuencia relevante. Indicar si es una propuesta del agente.]
- **Descartada. [Alternativa considerada].** [Motivo concreto para descartarla.]

## Plan de implementación

### Bloque 1 — [Resultado del bloque]

- [ ] [Cambio concreto dentro del alcance.]
- [ ] [Validación del comportamiento de este bloque.]

**Resultado verificable:** [Condición que permite comprobar que el bloque está terminado.]

### Bloque 2 — [Siguiente resultado, si hace falta]

- [ ] [Integración o cambio que depende del bloque anterior.]
- [ ] [Validación de esa integración.]

**Resultado verificable:** [Condición observable al completar el bloque.]

## Criterios de aceptación

- [ ] **CA-01:** [Condición, acción y resultado que se pueden comprobar.]
- [ ] **CA-02:** [Respuesta comprobable ante un fallo o caso límite relevante.]

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| [Fallo o incertidumbre relevante] | [Medida concreta que reduce su probabilidad o impacto] |

## Evidencia

Pendiente de implementación.

| Bloque | Commits | Verificación |
| --- | --- | --- |
```

## Reglas del encabezado

- Usa `Borrador`, `En revisión`, `Aprobada`, `Implementada` u `Obsoleta`. Conserva los equivalentes del repositorio si usa otro idioma o denominación. Una SPEC nueva empieza en `Borrador`.
- Usa `Implementada` solo cuando todos los bloques y criterios de aceptación estén verificados y las comprobaciones exigidas hayan pasado. Ese estado no significa que el cambio esté integrado en `main`, publicado en remoto o desplegado.
- Obtén la fecha actual del entorno. Al editar una SPEC existente, conserva su fecha salvo que el usuario o la convención del proyecto indiquen actualizarla.
- Expresa el objetivo en una frase. Si cuesta resumirlo, revisa si hay varios objetivos independientes antes de proponer dividirlo.
- `Depende de` identifica SPECs que aportan capacidades o contratos necesarios. `Modifica` identifica SPECs cuyos requisitos cambian parcialmente. `Reemplaza` identifica SPECs que esta sustituye por completo. Las relaciones pueden coexistir cuando corresponda.
- Enlaza cada referencia con una ruta relativa existente, por ejemplo `[SPEC 00](00-fundamentos-tecnicos.md)`. En `Modifica`, precisa las secciones o reglas afectadas. Escribe `Ninguna` cuando no haya relación.
- Si el proyecto controla la vigencia por separado, conserva `Vigencia` con sus valores existentes. No la añadas por defecto ni la confundas con el estado de implementación. Una SPEC implementada puede seguir vigente.

## Reglas del contenido

- En `Contexto`, separa la situación actual del resultado requerido. No describas como existente algo que se propone construir.
- En `Alcance`, delimita ambas listas. No repitas `No incluye` al final del documento.
- En `Comportamiento esperado`, documenta flujos, reglas de negocio, estados, límites, errores y casos relevantes de concurrencia, accesibilidad o funcionamiento degradado. Incluye solo los que apliquen.
- En `Datos y contratos relevantes`, fija solo las reglas que el agente debe conocer antes de implementar para evitar resultados incompatibles con lo esperado. Por ejemplo, un identificador que permanece estable al renombrar un registro, la unicidad sin distinguir mayúsculas o el formato que consume una integración. Si esas reglas ya están claras en `Comportamiento esperado` o en una referencia vigente, omite la sección.
- Usa campos, tipos, tablas o ejemplos breves en esa sección solo cuando el contrato los requiera. Reserva el diseño de tablas, clases, tipos auxiliares y firmas internas para la implementación, salvo que formen parte de una restricción acordada. Una SPEC puede fijar reglas de datos sin diseñar el esquema completo.
- En `Migración y compatibilidad`, explica la transición desde el estado actual, la conservación de datos y los contratos afectados. Para una función nueva sin datos ni consumidores previos, indica que no hay migración o compatibilidad previa que mantener y por qué.
- En `Seguridad y privacidad`, describe las garantías y límites aplicables. Si no hay cambios respecto a otra SPEC, referencia sus reglas vigentes en vez de duplicarlas.
- En `Decisiones`, usa identificadores `DEC-NN` para las elecciones adoptadas y explica su motivo. Incluye alternativas descartadas solo si se consideraron. Distingue decisiones acordadas, propuestas del agente y cuestiones pendientes. Si el usuario pide guardar con una cuestión pendiente, especifica su impacto y qué parte de la implementación bloquea.
- En `Plan de implementación`, ordena los bloques por sus dependencias. Cada bloque debe dejar un resultado integrado y verificable, con el sistema ejecutable cuando aplique. Para cambios de comportamiento, prioriza entregas verticales que incluyan lo necesario para observar y probar una capacidad. Evita dividir solo por capas cuando eso impida verificar el resultado de cada bloque. Añade o elimina bloques según el alcance y conserva tareas de tamaño coherente, sin límites de líneas de código. Distribuye las validaciones relevantes entre los bloques. Añade una validación final de integración si hace falta.
- En `Criterios de aceptación`, usa identificadores `CA-NN` y condiciones que se puedan verificar con sí o no. Cubre las capacidades incluidas y sus garantías relevantes. El plan describe el trabajo; los criterios describen el resultado exigido. Deja todas las casillas sin marcar al crear una SPEC.
- En `Riesgos`, vincula cada riesgo concreto con una mitigación realizable. Si no se identifican riesgos específicos adicionales, indícalo sin inventar filas.
- En las secciones obligatorias que no apliquen, escribe una explicación breve y, cuando corresponda, una referencia a la SPEC que ya lo define. Omite `Datos y contratos relevantes` cuando no aporte información necesaria.
- Usa Markdown estándar, términos del proyecto y detalle proporcional al cambio. Evita requisitos vagos, texto de relleno, funciones completas y marcadores sin sustituir. No copies tecnologías ni reglas de los ejemplos si no pertenecen al proyecto.

## Reglas de la evidencia

- Al crear una SPEC, deja `Pendiente de implementación.` y la tabla sin filas. Durante la ejecución, registra el progreso y las comprobaciones junto a las tareas y los criterios existentes. Consolida esas comprobaciones en la tabla al cerrar la implementación, sin duplicar el registro.
- Usa una fila por bloque con su número y resultado. En `Commits`, anota los hashes reales y no ambiguos de sus cambios de implementación, comprobados en Git. Un bloque puede referenciar varios commits y un commit correctivo puede aparecer en los bloques afectados. Si no puedes comprobar una referencia histórica, escribe `Sin referencia verificable` y explica la limitación. Si el trabajo no tiene commit por una restricción del usuario, indica `Sin commit`.
- En `Verificación`, resume los comandos o procedimientos ejecutados, el resultado observado y los criterios `CA-NN` relacionados. Incluye los casos comprobados y los límites de la verificación. Distingue pruebas superadas, fallos y comprobaciones no ejecutadas. Usa evidencia vigente, sin inventar resultados ni copiar salidas extensas. Registra también la verificación final de aceptación en un párrafo bajo la tabla.
- Referencia los commits de implementación anteriores al cierre documental. Ese último commit guarda la tabla y el estado final, pero no se incluye a sí mismo ni necesita registrar su propio hash.
- Los hashes permiten consultar cambios históricos, no demuestran que las pruebas hayan pasado ni que el cambio esté disponible en la rama actual. Si una reescritura autorizada del historial invalida referencias, actualízalas cuando puedas comprobar su correspondencia o deja constancia de la limitación.
