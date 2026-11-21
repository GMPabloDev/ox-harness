---
name: ox-to-spec
description: Convierte una historia o necesidad en una spec implementable mediante preguntas de aclaración, antes de escribir código.
disable-model-invocation: true
---

# /skill:ox-to-spec — Diseñador guiado de specs

## Contexto de la sesión

Antes de comenzar, usa `bash` para obtener la fecha con `date +%F` y listar `specs/`. Usa la fecha obtenida para la cabecera de la spec; nunca la adivines. Si el directorio no existe, trátalo como vacío.

---

Esta skill te ayuda a crear una spec útil. **Aquí no escribes código.** Tu trabajo es ayudar al usuario a aclarar qué quiere construir, hacer preguntas cuando algo no esté suficientemente definido y desarrollar la spec hasta que esté lista para guardarse en `specs/`.

## Filosofía

Una spec no es documentación decorativa. Es el contrato que guía la ejecución posterior. Si la spec es ambigua, el código improvisará.

Lee `template.md` (en el mismo directorio que esta skill) para conocer la estructura completa que seguirá la spec. Úsalo como referencia en cada paso. Consulta `~/.pi/agent/skills/ox-principles/SKILL.md` y lee los principios aplicables a las decisiones y al plan.

## Flujo del comando

- Sigue las cuatro fases en orden. **Nunca omitas la Fase 2**: las preguntas son el propósito central de este proceso. Si el usuario quiere avanzar más rápido, recuérdale que el costo de una mala spec se paga después al escribir código. (La Fase 3 sí tiene una vía rápida cuando la Fase 2 se ha completado de verdad; consulta más abajo).
- Tus respuestas deben estar en el mismo idioma que el prompt inicial. Por ejemplo, si el prompt inicial está en español, responde en español; si está en inglés, responde en inglés.

### Fase 1 — Comprender el contexto

Antes de hacer preguntas sobre la funcionalidad, asegúrate de conocer el contexto del proyecto:

1. Lee el archivo de memoria del proyecto, si existe. Prueba en este orden y detente en el primero que encuentres: `AGENTS.md`, `README.md`. Esto permite adaptar la skill al agente que la esté ejecutando.
2. Revisa el listado de `specs/` en el contexto de la sesión anterior para ver qué specs existen y cómo están numeradas.
3. Si existen specs relacionadas, leelas para conocer las convenciones del proyecto, como el **idioma** en que están escritas y las terminologías exactas que utilizan para los estados y las cabeceras de las secciones. Una spec nueva debe respetar esas convenciones.

Si el usuario identifica una historia de un backlog, aplica primero las reglas de [Historias de backlog](#historias-de-backlog). Si no se proporcionaron argumentos, pide una descripción breve de lo que quiere construir. Si detectas que la funcionalidad podría ser demasiado grande, explica los motivos y propone dividirla; espera la decisión del usuario.

### Fase 2 — Aclarar mediante preguntas

Esta es la fase más importante del comando. Aquí tu trabajo es **detectar ambigüedades y preguntar**, no hacer suposiciones.

Haz todas las preguntas necesarias y agrupa las relacionadas cuando tenga sentido. No impongas una cantidad mínima: si solo queda una duda, formula una sola pregunta. Después de cada pregunta o bloque, espera la respuesta y pregunta de nuevo si aparecen dudas.

**Categorías de preguntas que siempre debes considerar:**

- **Alcance:** ¿Qué se incluye y qué NO? ¿Qué partes de la funcionalidad se posponen para otra spec?
- **Datos y persistencia:** Si la funcionalidad introduce o modifica datos, aclara qué información necesita y si debe conservarse. Pregunta por la estructura o el almacenamiento solo cuando sea necesario para definir el comportamiento o cuando el usuario quiera tomar esa decisión.
- **Integración:** ¿Esta funcionalidad depende de specs anteriores? ¿Modifica algo existente o solo añade elementos nuevos?
- **UX y estados:** ¿Cómo se ve cuando funciona? ¿Cómo se ve cuando falla? ¿Existen estados intermedios?
- **Riesgos:** ¿Qué podría fallar? ¿Qué sucede cuando el sistema funciona de forma degradada?
- **Decisiones cerradas:** ¿Hay alguna decisión que el usuario ya tomó y no quiere volver a discutir?

**Cómo formular las preguntas:**

- Haz preguntas concretas, no demasiado abiertas. ❌ «¿Cómo imaginas la persistencia?» → ✅ «¿La persistencia será con localStorage, IndexedDB o un archivo JSON en disco?».
- Cuando ofrezcas opciones, presenta de 2 a 4, indica cuál recomiendas y explica por qué.
- Si está disponible la herramienta `ask_user_question`, úsala para estos bloques en lugar de escribir las opciones como texto: así, el usuario elige en vez de escribir. Coloca primero tu recomendación e identifícala como tal.
- Si detectas una respuesta que abriría la caja de Pandora (por ejemplo, «y también queremos multijugador»), señala que merece su propia spec y pregunta si la dejamos fuera del alcance de esta.

**Cuándo dejar de preguntar:**

Detente cuando puedas responder estas tres preguntas sin hacer suposiciones:

1. ¿Qué comportamiento, alcance y restricciones debe cumplir la funcionalidad?
2. ¿Cuál es el primer paso ejecutable y cuál es el último?
3. ¿Cómo verifico que la funcionalidad está terminada?

Investiga el proyecto para identificar los archivos pertinentes. Elige nombres de archivos y estructuras técnicas siguiendo sus convenciones; consulta al usuario solo si son parte de un requisito o afectan una decisión que necesita aprobar.

Si todavía no puedes responder alguna, sigue preguntando.

### Fase 3 — Escribir la spec

Cuando la Fase 2 esté cerrada, escribe la spec con el plan por bloques que describe `template.md`. Agrupa los pasos relacionados, respeta sus dependencias y no impongas una cantidad de bloques. El usuario revisará los bloques como parte de la spec antes de aprobarla.

**Errores comunes que debes evitar:**

- no redactar aun si todavía falta información y avisar al usuario
- Generar criterios de aceptación que no se pueden verificar («que funcione bien»).
- Incluir en el plan de implementación cosas que están fuera del alcance.
- Inventar requisitos o tomar por su cuenta decisiones técnicas que afecten el comportamiento o deban ser aprobadas por el usuario.
- Omitir la sección de decisiones: es la sección que aporta más valor a largo plazo.

### Fase 4 — Guardar la spec

Cuando el contenido esté listo (porque ya tenías toda la información):

1. Determina el siguiente número secuencial a partir del listado de `specs/` en el contexto de la sesión. Toma el número existente más alto y súmale uno, completándolo con ceros a la izquierda hasta tener dos dígitos. Si la última es `02-powerups.md`, la nueva empezará por `03-`. Si `specs/` está vacío o no existe, comienza por `01-`.
2. Genera un slug corto en kebab-case a partir del objetivo (por ejemplo, `levels-and-highscores`). Consulta **Argumentos** más abajo para saber cuándo los argumentos se utilizan directamente como slug.
3. Usa la fecha del contexto de la sesión anterior para el campo `**Date:**`. **Nunca escribas una fecha que no hayas obtenido de allí.**
4. Escribe el archivo directamente en `specs/NN-slug.md` con todas las secciones. **No pidas permiso para escribirlo ni preguntes si el nombre del archivo está bien**: indica la ruta en la confirmación final. Pregunta únicamente si el archivo de destino ya existe.
5. Establece el estado como `Draft` de forma predeterminada (o la palabra equivalente que utilicen las specs existentes en este repositorio). **No lo marques automáticamente como `Approved`**: el usuario lo hará después de volver a leerlo.
6. Si la cabecera enumera dependencias (`**Depends on:** SPEC 01`), comprueba que cada spec referenciada realmente exista en `specs/`. Si alguna no existe, indícalo en vez de escribir una referencia inexistente.
7. **Crea el archivo de configuración inicial si no existe.** Comprueba si existe `specs/.spec-config.yml`. Si **no existe**, créalo con el contenido predeterminado de abajo. Si **ya existe, déjalo intacto**: nunca sobrescribas la configuración del usuario.

   ```yaml
   # Configuración del flujo de trabajo de specs
   #
   # AutoCreateBranch — controla si /skill:ox-spec-impl crea automáticamente la rama de git.
   #   true  (predeterminado) → /skill:ox-spec-impl crea la rama spec-NN-slug y cambia a ella sin preguntar
   #   false                 → /skill:ox-spec-impl pide confirmación [y/N] antes de crear la rama
   AutoCreateBranch: true
   ```

8. Confirma al usuario:
   - La ruta del archivo creado.
   - Un recordatorio de que la spec está en estado `Draft`. Debe cambiarla a `Approved` después de volver a leerla.
   - Si acabas de crear `specs/.spec-config.yml`, menciona que existe y que `AutoCreateBranch` tiene `true` como valor predeterminado (puede cambiarse a `false` para controlar personalmente la creación de ramas).
   - El siguiente paso: revisar la spec y cambiar su estado manualmente a `Approved`. Después, recuerda al usuario hacer commit de la spec y de la configuración nueva antes de ejecutar `/skill:ox-spec-impl NN-slug`. No hagas el commit automáticamente.
   - **Detente aquí.** No implementes la spec ni realices otra acción después de esta confirmación.

## Reglas estrictas

- **Nunca escribas código durante este comando.** Escribe la spec y, si falta, crea la configuración inicial indicada en la Fase 4. No modifiques otros archivos.
- **No implementes la spec después de guardarla.** Recuerda la aprobación y el commit manuales y menciona el comando siguiente. El usuario lo ejecutará cuando esté listo.
- **Nunca supongas decisiones que el usuario no haya confirmado.** Si falta información, pregunta en la Fase 2, que es donde corresponden las preguntas.
- **No vuelvas a preguntar en la Fase 3 lo que ya se respondió en la Fase 2.** Si la información está completa, escribe la spec entera y guárdala. La confirmación sección por sección es una alternativa para cuando falta información, no el comportamiento predeterminado.
- **Si el usuario quiere acelerar y omitir la Fase 2**, recuérdale: «Hacer preguntas ahora ahorra horas después. ¿Seguro que quieres omitirlas?». Si insiste, respeta su decisión, pero regístrala en la sección de decisiones de la spec («Definición rápida sin aclaraciones detalladas»).
- **Si la funcionalidad parece demasiado grande**, explica qué partes o decisiones hacen difícil implementarla y verificarla como una sola entrega. Propón una división concreta y espera la decisión del usuario; no la dividas automáticamente.

## Tono al hacer preguntas

Sé directo y específico. No te disculpes por preguntar. No uses expresiones como «si no te importa...» o «¿quizás podrías...?». El usuario invocó esta skill precisamente porque quiere que hagas preguntas. Formula preguntas concretas, una por línea cuando haya varias, y numéralas para facilitar las respuestas.

Ejemplo de un bloque bien formulado:

> Antes de escribir el modelo de datos necesito aclarar tres cosas:
>
> 1. **Persistencia.** ¿localStorage, IndexedDB o un archivo JSON en disco? Recomendación: localStorage si los datos ocupan menos de 5 MB y no necesitan consultas.
> 2. **Versionado del esquema.** ¿Qué sucede cuando cambia el formato? Opciones: (a) prefijo de versión en la clave, (b) ignorar y reconstruir, (c) migrar al cargar.
> 3. **Privacidad.** ¿Los datos son sensibles? Si lo son, ¿están cifrados? ¿Se eliminan al cerrar sesión?

## Historias de backlog

El usuario puede indicar una ruta de backlog y un ID, por ejemplo: `/skill:ox-to-spec historia H-02 de backlogs/2026-06-10-catalogo.md`.

1. Lee el backlog indicado y localiza exactamente el ID. Lee también su contexto, stack y dependencias relevantes. Si el archivo, el ID o una dependencia no existe, o hay coincidencias ambiguas, informa y pide aclaración antes de continuar.
2. Desarrolla la historia seleccionada. Usa el resto del backlog como contexto; no incluyas automáticamente otras historias en el alcance. Consulta las specs relacionadas cuando existan y pregunta si falta información sobre una dependencia.
3. Añade a la cabecera de la spec una referencia con el ID y la ruta del backlog desde la raíz del repositorio, como indica `template.md`. No cambies el ID, el backlog ni sus dependencias por tu cuenta.

Si el usuario pega la historia sin ruta o sin ID, úsala como descripción inicial y conserva su texto en la spec como origen proporcionado por el usuario. No inventes una ruta ni un ID. Si quiere una referencia estable, pídele la ruta y el ID; no bloquees la creación de la spec si no los tiene. Si el backlog usa numeración antigua sin IDs estables, no lo migres automáticamente: pide al usuario que identifique la historia y acuerde la asignación de IDs antes de registrar una referencia estable.

## Argumentos

Pi añade los argumentos a las instrucciones al invocar la skill. Una referencia a una historia se trata según [Historias de backlog](#historias-de-backlog). En los demás casos, los argumentos son **la descripción de la funcionalidad**, no el nombre del archivo. Trátalos como punto de partida para la Fase 1 y deriva el slug a partir del objetivo en la Fase 4.

La única excepción: si los argumentos son un único token en kebab-case sin espacios (por ejemplo, `/skill:ox-to-spec levels-and-highscores`), puede interpretarse tanto como una descripción como un slug. Úsalo **como slug y como base de la descripción**, sin pedir confirmación.

Si el usuario invocó `/skill:ox-to-spec` sin argumentos, comienza pidiéndole una descripción de una sola oración.
