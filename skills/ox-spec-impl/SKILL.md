---
name: ox-spec-impl
description: Implementa una spec aprobada en bloques consecutivos mediante el subagente ox-spec-exec, sin pausas entre bloques.
disable-model-invocation: true
---

# /skill:ox-spec-impl — Implementador de specs aprobadas

## Contexto de la sesión

Antes de comenzar, usa `bash` para consultar `git status --short`, `git branch --show-current` y el listado de `specs/`. Si existe `specs/.spec-config.yml`, léelo con `read`. Si no existe, usa el valor predeterminado `AutoCreateBranch: true`.

---

## Instrucciones

Sigue estas cuatro fases en orden estricto. **No avances a la siguiente fase si la anterior no se completó correctamente.** Consulta `~/.pi/agent/skills/ox-principles/SKILL.md` y lee los principios aplicables a cada fase.

---

### Fase 1 — Identificar la spec

Pi añade los argumentos proporcionados por el usuario a las instrucciones de esta skill.

Si no se proporcionó ningún argumento:

- Enumera los archivos disponibles en `specs/` (ya aparecen arriba).
- Pide al usuario que indique el nombre exacto de la spec.
- Detente y espera una respuesta. No continúes.

Si se proporcionó un argumento:

- Busca el archivo en `specs/`. El usuario puede haber escrito el nombre completo (`01-mvp-arkanoid`), solo el número (`01`) o solo el slug (`mvp-arkanoid`). Intenta encontrar el archivo correcto en cualquiera de esos casos.
- Si no encuentras el archivo, muestra las specs disponibles y pide al usuario que corrija el nombre.
- Si lo encuentras, continúa con la Fase 2.

---

### Fase 2 — Validar el estado de la spec

Lee el archivo de la spec que encontraste en la Fase 1 mediante la herramienta `read`.

Dentro del archivo, busca la línea que contiene el estado de la spec. La etiqueta de la cabecera suele ser `**Status:**` (inglés) o `**Estado:**` (español), pero puede estar en cualquier idioma. Identifícala por su posición (la línea de estado cerca del inicio de la spec) y por el conjunto de estados utilizado, no únicamente por el texto exacto de la etiqueta.

**Regla absoluta:** Solo puedes continuar si el estado **significa "Approved"**, independientemente del idioma utilizado.

Considera cualquiera de los siguientes valores (y sus equivalentes en otros idiomas) como estado **Approved** y continúa:

- Inglés: `Approved`
- Español: `Aprobado`
- Portugués: `Aprovado`
- Francés: `Approuvé`
- Alemán: `Genehmigt`
- Italiano: `Approvato`
- …o cualquier otra palabra que signifique claramente «aprobado» en otro idioma.

Cualquier otro estado (`Draft` / `Borrador`, `In review` / `En revisión`, `Implemented` / `Implementado`, `Obsolete` / `Obsoleto` o cualquier valor no reconocido) significa que debes **detenerte** y mostrar el siguiente mensaje de error.

| Categoría del estado                                     | Ejemplos (en cualquier idioma)                    | Acción                                                                   |
| -------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| Approved                                                 | `Approved`, `Aprobado`, `Aprovado`, `Approuvé`, … | Continuar con la Fase 3.                                                 |
| Draft                                                    | `Draft`, `Borrador`, …                            | Detenerse. Mostrar el mensaje de error indicado abajo.                   |
| In review                                                | `In review`, `En revisión`, …                     | Detenerse. Mostrar el mensaje de error indicado abajo.                   |
| Implemented                                              | `Implemented`, `Implementado`, …                  | Detenerse. Mostrar el mensaje de error indicado abajo.                   |
| Obsolete                                                 | `Obsolete`, `Obsoleto`, …                         | Detenerse. Mostrar el mensaje de error indicado abajo.                   |
| No se encuentra la línea de estado / valor no reconocido | —                                                 | Detenerse. El archivo no sigue el formato esperado. Informar al usuario. |

Si no tienes certeza de que un valor signifique «aprobado», **no hagas suposiciones**. Detente y pide al usuario que lo aclare o que actualice la spec con la denominación estándar.

**Mensaje de error estándar cuando el estado no significa Approved:**

```
❌ No puedo implementar esta spec.

Estado actual: [ESTADO ENCONTRADO]
Solo trabajo con specs cuyo estado significa "Approved" (por ejemplo, `Approved`,
`Aprobado` o el equivalente en otro idioma).

Para continuar tienes dos opciones:
  1. Si la spec está lista para implementarse, ábrela y cambia manualmente
     su estado a "Approved" (o al término equivalente que utilice tu equipo).
     Ese cambio lo realiza una persona, no el agente.
  2. Si la spec todavía necesita ajustes, usa /skill:ox-spec-revise [nombre] para retomarla.
```

No ofrezcas alternativas ni sugieras «Puedo empezar de todos modos si quieres». Este bloqueo es intencional.

---

### Fase 3 — Crear la rama de Git y cambiar a ella

Una vez confirmado que el estado significa `Approved`:

0. **Comprueba primero el working tree.** Revisa la salida de `git status --short` en el contexto de la sesión anterior. Si **no está vacía**, detente, muestra los cambios pendientes y pregunta:

   ```
   ⚠️ Hay cambios sin commit en el working tree.
   Al cambiar de rama, esos cambios se trasladarían a la otra rama. ¿Qué quieres hacer?
     1. Haz commit o stash de los cambios por tu cuenta y vuelve a ejecutar este comando (recomendado).
     2. Continuar de todos modos: los cambios se trasladarán a la nueva rama.
   ```

   Espera la respuesta. **No hagas stash ni commit en nombre del usuario** a menos que te lo pida explícitamente. Si el working tree está limpio, pasa directamente al paso 1 sin mencionarlo.

1. Obtén el nombre de la rama a partir del nombre completo del archivo de la spec, sin la extensión. Formato: `spec-NN-slug`. Ejemplos:

   - `01-mvp-arkanoid.md` → rama `spec-01-mvp-arkanoid`
   - `02-powerups.md` → rama `spec-02-powerups`

2. Lee el flag `AutoCreateBranch` de la **configuración de creación de ramas** mostrada en el contexto de la sesión anterior.

   - Si el archivo de configuración no existe, falta el valor o no se reconoce → interprétalo como `true` (valor predeterminado).
   - Solo un `false` explícito (sin importar las mayúsculas y minúsculas) desactiva la creación automática de ramas.

   **Si `AutoCreateBranch` es `true` (predeterminado):** continúa sin preguntar.

   - Si la rama **no existe**, créala con `git checkout -b spec-NN-slug`.
   - Si **ya existe**, cambia a esa rama. Después del rebase del paso 3, consulta el historial, los cambios y las pruebas pertinentes para proponer el punto de reanudación. Espera la confirmación del usuario antes de implementar.
   - En ambos casos, cambia a la rama con `git checkout spec-NN-slug` y confirma que el cambio se realizó correctamente antes de continuar.

   **Si `AutoCreateBranch` es `false`:** pregunta antes de modificar el estado de Git. Muestra:

   ```
   AutoCreateBranch está configurado en false.
   ¿Crear y cambiar a la rama spec-NN-slug? [y/N]
   ```

   - Si el usuario responde **sí**, crea la rama o cambia a ella exactamente como en el caso `true` anterior.
   - Si responde **no** o deja la respuesta vacía, **no crees ninguna rama**. Indica que implementarás en la rama actual (la que aparece en el contexto de la sesión anterior) y solicita confirmación explícita para continuar allí. No improvises: espera la respuesta.

3. **Actualiza la rama de la spec con la `main` local.** Si estás en `spec-NN-slug`, comprueba que existe `refs/heads/main`, que no hay operaciones Git en curso y que `git status --porcelain` está vacío. Si alguna comprobación falla, detente e informa; no hagas stash ni descartes cambios. Esto también se aplica si antes elegiste continuar con cambios pendientes.

   Guarda la referencia de `HEAD`, el hash de la `main` local y una huella del contenido de la spec aprobada. Ejecuta `git rebase refs/heads/main` sin preguntar. No hagas fetch ni uses una rama remota. Si el rebase falla o hay conflictos, detente y muestra el estado y el error. No resuelvas conflictos, abortes el rebase ni reescribas más historial por tu cuenta.

   Al terminar, confirma la rama activa y vuelve a leer la spec. Si falta o su contenido difiere de la versión aprobada antes del rebase, detente y solicita al usuario que revise y apruebe la versión actual antes de continuar. No deduzcas que sigue aprobada solo por su estado.

   Si el usuario eligió permanecer en `main`, no hagas rebase de `main` sobre sí misma. Si eligió otra rama actual que no sea la rama de la spec, pregunta antes de hacer rebase en ella.

4. Confirma visualmente al usuario que la spec está lista e indica qué rama está activa:

   ```
   ✅ Listo para implementar.

   Spec:   specs/NN-slug.md
   Rama:   spec-NN-slug  (activa)   (← o la rama actual si no se creó otra)
   Estado: Approved     (← muestra el valor real encontrado en la spec)
   ```

5. **Todavía no empieces a implementar.** Primero muestra un resumen de la spec al usuario para que tenga presentes sus detalles. Extrae y muestra:
   - El **objetivo** (la línea después de `**Objective:**` / `**Objetivo:**` / una etiqueta equivalente).
   - El **alcance** (la sección `## Scope` / `## Alcance` / equivalente).
   - El **plan de implementación** (la sección con bloques y pasos: `## Implementation plan` / `## Plan de implementación` / equivalente).
   - Los **criterios de aceptación** (el checklist: `## Acceptance criteria` / `## Criterios de aceptación` / equivalente).
   - La **referencia visual**, si existe: ruta local, variante elegida, alcance y simulaciones.

Si la spec referencia un prototipo, resuelve la ruta desde el directorio de la spec y comprueba que existe. Si falta, no se identifica la variante o contradice la spec, detente y pregunta al usuario. No inventes el diseño ni trates los datos simulados como comportamiento real. Los prototipos se ignoran en Git y pueden faltar en otra copia.

Identifica las cabeceras por su significado, no por su redacción exacta: la spec puede estar escrita en cualquier idioma.

---

### Fase 4 — Implementar por bloques

Después de mostrar el resumen de la spec, identifica los bloques definidos en el plan aprobado. Conserva sus nombres, pasos, orden y dependencias.

Si una spec anterior a este formato solo contiene pasos, propone una agrupación sin alterar el plan ni sus requisitos. No reescribas la spec por tu cuenta.

Muestra los bloques al usuario y dile:

```
Voy a implementar estos bloques en orden con ox-spec-exec, sin pausas entre ellos.
Me detendré si necesito una decisión o si encuentro un bloqueo.

¿Comenzamos?
```

Espera una confirmación explícita («sí», «adelante», «go» o equivalente). No empieces sin ella. Para una spec antigua, esta misma confirmación autoriza la agrupación propuesta.

Una vez recibida la confirmación, sigue estas reglas durante toda la implementación:

**Commits por bloque:** la confirmación inicial autoriza un commit de implementación por bloque y, si hay correcciones, otro commit separado con ellas. El orquestador hace los commits; los subagentes no. Incluye solo cambios atribuibles al bloque, nunca cambios ajenos. Si no puedes separar su alcance con seguridad o falla un commit, detente e informa. No hagas push ni cambies el estado de la spec.

**Una regla por encima de todas:** implementa lo que dice la spec. Si algo te parece subóptimo, menciónalo como observación, pero implementa lo acordado. Los cambios en la spec deben quedar reflejados en la propia spec; no introduzcas cambios inesperados en el código.

**Ejecución de los bloques:**

1. Antes de cada bloque registra el commit base y el estado del árbol. Habilita las herramientas de subagentes si es necesario. Lanza `ox-spec-exec` en el directorio y la rama actuales, con contexto nuevo. Usa un solo implementador a la vez y no uses un worktree separado.
2. En cada encargo indica la ruta de la spec, el número y nombre del bloque, los pasos asignados, las restricciones aplicables y el contexto relevante de los bloques anteriores. Incluye la ruta local y la variante del prototipo cuando sean pertinentes. Pide el informe definido por el subagente.
3. Al terminar el implementador, comprueba su informe, pruebas y alcance. Si terminó sin impedimentos, crea el commit de implementación con sus cambios atribuibles y registra su hash. Si no hay cambios, informa y detente para aclarar el resultado.
4. Revisa exactamente el rango desde la base hasta el commit de implementación, con la spec completa y los bloques previos como contexto. Lanza `ox-spec-auditor` y `ox-code-auditor` en paralelo y con contexto nuevo mediante `pi-subagents` `runs.all`; indica modo `bloque`, repositorio, rama, base, commit final, rutas, bloque y pasos. No les pidas marcar casillas. Comprueba que el árbol y los commits examinados no cambien durante la revisión. Si falta un informe suficiente o el alcance cambia, detente e informa; no sustituyas un auditor.
5. Contrasta y deduplica los hallazgos. Lanza una sola vez `ox-spec-fix` con todos los hallazgos sustentados que correspondan al bloque; el agente comprueba cada uno. Incluye spec, bloque, rango, evidencia y límites. Si no hay hallazgos, omite fix y commit de corrección. No relances auditores para revisar el fix. Si el corrector informa bloqueos, pruebas fallidas o correcciones parciales, detente e informa; no pases al siguiente bloque. Los hallazgos no confirmados o ya resueltos se informan sin fabricar cambios.
6. Tras correcciones, comprueba el informe y los resultados de pruebas, y crea un commit separado solo con los cambios atribuibles a las correcciones. Si no hubo cambios, no crees un commit vacío. Continúa con el siguiente bloque sin pedir confirmación. No marques casillas de la spec durante este flujo.
7. Si un subagente queda bloqueado, no puede resolver un fallo, devuelve un informe insuficiente o falla su lanzamiento, detente. Informa del error y de los cambios parciales; pregunta al usuario antes de cambiar el modo de ejecución. No sustituyas silenciosamente al subagente.

No pases al siguiente bloque mientras el anterior siga activo. Si un bloque aprobado requiere reorganización para continuar, detente y plantea el cambio al usuario. Refleja los cambios acordados en la spec y espera su aprobación antes de continuar. El orquestador mantiene las decisiones, el orden y la comunicación con el usuario.

**Si durante la implementación encuentras una ambigüedad** que afecta al comportamiento o al alcance y que la spec no resuelve:

- Detente y describe la ambigüedad con precisión.
- Presenta opciones concretas y espera la decisión del usuario. No improvises requisitos.
- Si la decisión cambia lo aprobado, refléjala en la spec y espera su aprobación antes de continuar.

Las decisiones técnicas que no cambian el comportamiento acordado pueden seguir las convenciones del proyecto sin consultar al usuario.

**Si el usuario pide algo fuera del alcance de la spec:**

- Recuérdale que queda fuera del alcance de esta spec.
- Sugiere anotarlo para la próxima spec.
- No lo implementes en esta rama.

**Al terminar el último bloque:**

Resume los bloques, commits de implementación y corrección, revisiones por bloque, hallazgos, pruebas y limitaciones. Indica que todavía falta la revisión independiente de la spec completa. Sugiere `/skill:ox-spec-review` en una sesión nueva con el nombre de la spec y el commit base anterior a la implementación.

No cambies el estado de la spec. Tras una revisión satisfactoria y la resolución de los hallazgos, el usuario lo cambiará manualmente a `Implemented` o su equivalente.

---

## Resumen del comportamiento esperado

```
/skill:ox-spec-impl 01-mvp-arkanoid

  Fase 1  →  Encuentra specs/01-mvp-arkanoid.md
  Fase 2  →  Lee el estado → "Approved" (o "Aprobado", etc.) → ✅ continúa
  Fase 3  →  Activa la rama de la spec y hace rebase sobre la main local
              Muestra objetivo, alcance, plan, criterios y referencia visual si existe
  Fase 4  →  Usa los bloques de la spec y pide una confirmación inicial
              Cada bloque: implementar, commit, revisar una vez y corregir una vez
              Las correcciones comprobadas reciben un commit separado
              Termina sugiriendo la revisión independiente de la spec completa

/skill:ox-spec-impl 02-powerups  (estado: Draft / Borrador)

  Fase 1  →  Encuentra specs/02-powerups.md
  Fase 2  →  Lee el estado → "Draft" → ❌ se detiene
              Muestra el mensaje de error estándar
              No crea ninguna rama ni modifica el código
```

**La creación de ramas se controla mediante el flag `AutoCreateBranch`** del archivo `specs/.spec-config.yml`. Su valor predeterminado es `true` (crear automáticamente la rama, como se muestra arriba). Cámbialo a `false` para que la Fase 3 solicite confirmación `[y/N]` antes de crearla.
