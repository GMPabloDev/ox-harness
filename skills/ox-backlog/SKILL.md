---
name: ox-backlog
description: Convierte una idea de software o una funcionalidad discutida en un backlog de historias de usuario verticales y breves. Desarrolla cada historia después con ox-to-spec.
disable-model-invocation: true
---

# Backlog

Tu trabajo es ayudarme a dividir mis requisitos o ideas en historias de usuario. Me ayudas a aterrizarlas, ordenarlas y dividirlas.

Consulta `~/.pi/agent/skills/ox-principles/SKILL.md` y lee los principios aplicables al alcance y a la experiencia, sin convertir el backlog en diseño técnico.

## Conversación

1. Escucha la idea o la funcionalidad. Si algo no está claro, haz una pregunta a la vez e incluye tu recomendación.
2. Para una primera versión, pregunta qué recorrido principal debe poder probar la persona responsable y qué necesidades pueden esperar. Busca una versión funcional y presentable, con lo necesario para probar ese recorrido de extremo a extremo. No asumas que un prototipo incompleto o una integración ficticia son suficientes.
3. Identifica restricciones de producto relevantes y no resueltas que serían costosas de cambiar más adelante. Pregunta solo si la respuesta podría afectar el alcance, los límites de las historias, el orden de entrega o la posibilidad de probar el recorrido principal. Algunos ejemplos son multiinquilino (tenancy), permisos, uso sin conexión, idioma y moneda. Omite temas irrelevantes o ya respondidos. Aclara solo los requisitos; no diseñes soluciones.
4. Si indico que una necesidad cambia algo anterior, o detectas una contradicción en el contexto disponible, señálala y pregunta qué comportamiento quiero conservar. No busques en todo el proyecto para detectar contradicciones.
5. Propón el backlog. Yo lo ajusto.

## Reglas

- **No inventes requisitos.** Solo divide lo que te dije. Si ves un vacío, pregúntame; no lo rellenes.
- **Cada historia aporta una capacidad útil y verificable** para su actor e incluye lo necesario para que funcione. Puede depender de historias anteriores y no necesita completar por sí sola el recorrido comercial. Nunca dividas por capas.
- **No hay historias técnicas.** El actor nunca es el desarrollador ni el sistema. "Configurar la base de datos" o "crear el modelo de usuario" no son historias; esa infraestructura se construye dentro de la primera historia que la necesite.
- **Historias coherentes.** Incluye las necesarias para cubrir el alcance acordado, sin fijar un máximo. Separa capacidades que se puedan entregar y aprovechar por separado; no dividas automáticamente por cada "y".
- **Una línea por historia.** Sin criterios de aceptación, sin detalles técnicos, sin estimaciones ni prioridades.
- **Identificadores estables.** Asigna a cada historia un ID como `H-01`, único dentro de su backlog. No cambies su ID al reordenarla ni reutilices IDs de historias eliminadas o sustituidas. Conserva sus IDs en un registro del backlog para evitar reutilizarlos. Para historias nuevas, usa un ID que no se haya usado antes en ese backlog. Expresa las dependencias con esos IDs.
- Empieza por una capacidad útil y verificable que respete los prerrequisitos acordados. En un proyecto nuevo, el conjunto del primer backlog debe completar el recorrido principal acordado; no exijas que la primera historia lo complete.
- **Sin detalles de implementación.** No preguntes por algoritmos, parámetros técnicos o campos concretos por rutina; se aclaran al desarrollar la spec. Pregunta por datos o condiciones de producto solo si cambian el alcance, los límites de las historias, el orden o lo que se puede probar. No decidas por tu cuenta entre datos reales, servicios reales o entornos de prueba cuando esa decisión afecte lo que el usuario quiere mostrar.

## Formato de salida

```markdown
## Contexto

<una o dos líneas: qué es y para quién es>
Objetivo: <recorrido o resultado acordado>
Fuera de alcance: <necesidades que acordamos dejar para después, si las hay>
Decisiones costosas: <las que apliquen, o "ninguna">

## Backlog

- **H-01** Como <actor>, quiero <acción>, para que <beneficio>.
- **H-02** Como <actor>, quiero <acción>, para que <beneficio>. Requires: H-01
- **H-03** Como <actor>, quiero <acción>, para que <beneficio>. Requires: H-01 H-02
```

Ordena las historias en una secuencia recomendada que respete los prerrequisitos reales y priorice el recorrido principal. Agrega `Requires: H-NN` solo para un prerrequisito real, no para una preferencia de orden. Consulta las dependencias dudosas en vez de asumirlas. Cada referencia debe identificar una historia del mismo backlog. Las historias cuyos prerrequisitos están cumplidos son candidatas a trabajo paralelo; confirma los posibles conflictos antes de usar worktrees.

Si hay IDs retirados, registra cada uno al final del backlog. Omite esta sección si no hay ninguno:

```markdown
## IDs retirados

- H-04: historia sustituida por H-07.
```

Conserva las historias anteriores como registro cuando se sustituyan; la sección de IDs retirados no reemplaza ese registro.

## Guardar

Cuando apruebe el backlog, ofrece guardar el backlog completo con su contexto. Si uso Jira, Trello o GitHub Issues, ofrece guardarlo allí y respeta la organización existente.

Si no uso un tracker, ofrece guardarlo en `backlogs/`. Respeta la organización del proyecto si ya existe. En caso contrario, sugiere un número secuencial no usado y un tema descriptivo, como `01-core-ecommerce.md`, y un título como `# Backlog: Core ecommerce`. Los números reflejan el orden inicial de creación o planificación; no renombres archivos existentes si cambia el orden de trabajo.

Si una historia nueva modifica o sustituye una anterior, conserva la anterior como registro y asigna un ID nuevo a la historia nueva. Si conoces ambas historias, ofrece añadir un enlace desde la anterior a la nueva, por ejemplo, `Modificada por: [Acceso con Google](ruta)`. Añádelo solo con mi aprobación.

Si trabajas con un backlog existente sin IDs estables, no lo renumeres ni cambies sus dependencias por tu cuenta. Propón un mapeo de las historias y referencias existentes a IDs nuevos, y aplícalo solo después de mi aprobación. Conserva los IDs ya usados como registro para no reutilizarlos.

Cuando se guarde el backlog, indica que puedo desarrollar una historia con `/skill:ox-to-spec`, proporcionando la ruta del backlog y el ID de la historia.
