
# Plantilla para una spec útil

Este archivo es la referencia que consulta la skill `/skill:ox-to-spec` al generar specs. Cada sección incluye su propósito y un ejemplo mínimo. **No es texto que deba copiarse literalmente**: es la estructura que la skill debe respetar.

---

## Cabecera

Toda spec comienza con metadatos en formato de cita en bloque (sin tablas ni bloques adicionales; de forma sencilla, como se muestra a continuación):

```markdown
# SPEC NN — Título breve y descriptivo

> **Status:** Draft
> **Depends on:** SPEC 01, SPEC 02
> **Date:** YYYY-MM-DD
> **Objective:** Descripción breve de lo que se quiere construir.
```

**Estados válidos:** `Draft`, `In review`, `Approved`, `Implemented`, `Obsolete`.

> Las etiquetas anteriores son los valores predeterminados en inglés. Las skills también aceptan equivalentes en cualquier idioma (por ejemplo, en español: `Borrador` / `En revisión` / `Aprobado` / `Implementado` / `Obsoleto`). Elige un conjunto por repositorio y úsalo de forma consistente.

**Regla del objetivo:** describe de forma breve qué se va a construir. Si el alcance parece demasiado grande, explica los motivos y consulta al usuario antes de dividirlo.

Si la spec procede de una historia con ID estable, añade a la cabecera una línea como `> **Historia de origen:** H-02 en backlogs/2026-06-10-catalogo.md`. La ruta es relativa a la raíz del repositorio y, junto con el ID, identifica la historia aunque se reordene el backlog. Si el usuario pegó la historia sin ruta o sin ID, conserva su texto como origen proporcionado por el usuario y no inventes una referencia.

---

## Sección 1 — Por qué existe esta spec (opcional)

Para las specs que toman decisiones poco evidentes o rompen los patrones del proyecto, incluye una sección breve que explique el **porqué** del trabajo. No el qué: eso viene después.

Omítela en las specs sencillas.

---

## Referencia visual (opcional)

Si el usuario eligió un prototipo, registra un enlace al archivo local, la variante exacta, el alcance visual y las simulaciones pertinentes. Resuelve el enlace relativo al archivo de la spec. Por ejemplo:

```markdown
## Referencia visual

- Prototipo: [Catálogo](../prototypes/catalogo/index.html)
- Variante elegida: opción B, cuadrícula con filtros laterales.
- Alcance: distribución del catálogo y comportamiento visual de los filtros.
- Simulaciones: los productos y resultados son datos ficticios.
```

`prototypes/` se ignora en Git: el enlace necesita los archivos locales y no permite recuperarlos del repositorio. No inventes una variante ni una ruta. Si aún no hay una selección, no la presentes como aprobada.

Para las decisiones de presentación o interacción que requieren explorar alternativas, incluye una subsección **Decisiones visuales pendientes**. Registra cada pregunta, su objetivo, las restricciones conocidas y `/skill:ox-prototype` como siguiente paso. Si ya hubo una prueba sin elección, resume la evidencia pertinente junto a la pregunta pendiente.

---

## Sección 2 — Alcance

Dos apartados explícitos. **Ambos son obligatorios.**

```markdown
## Alcance

**Incluye:**

- Primer elemento concreto.
- Segundo elemento concreto.

**Fuera de alcance (para futuras specs):**

- Algo que podría hacerse, pero no ahora.
- Algo que surgió en la conversación, pero que no se incluirá.
```

**Por qué importa lo que queda fuera:** permite registrar los elementos que el usuario mencionó durante la fase de preguntas, pero que se decidió posponer. Sin ese registro, durante la implementación puede surgir la tentación de incluirlos «ya que estamos».

---

## Sección 3 — Plan de implementación

Organiza el plan en bloques numerados con nombres descriptivos. Cada bloque contiene pasos numerados y relacionados, ordenados según sus dependencias. Cada paso debe tener un resultado identificable.

```markdown
## Plan de implementación

### Bloque 1: preparar la configuración

1. Crear el archivo X con la configuración acordada.
2. Comprobar que el proyecto carga esa configuración.

### Bloque 2: conectar la funcionalidad

1. Conectar X con el módulo existente W.
2. Ejecutar Y y comprobar Z.
```

**Reglas:**

- Agrupa el trabajo relacionado en bloques coherentes. Una spec pequeña puede tener un solo bloque. No fijes una cantidad de bloques.
- Describe los pasos y las comprobaciones necesarias para cada bloque. Respeta el alcance, el orden y las dependencias de la spec.
- Divide un paso cuando sea demasiado amplio o difícil de comprobar, no por una cantidad fija de líneas.
- No exijas un commit por paso o bloque. El usuario decide cuándo guardar los cambios.
- Los criterios de aceptación describen cómo verificar el resultado completo.

---

## Sección 4 — Criterios de aceptación

Checklist de condiciones booleanas. Cada elemento debe poder verificarse con un sí o un no.

```markdown
## Criterios de aceptación

- [ ] El juego carga sin errores en la consola.
- [ ] Romper un bloque añade exactamente 10 puntos.
- [ ] Recargar la página conserva las puntuaciones máximas.
```

**Antipatrones que debes evitar:**

- ❌ «Que funcione bien». → No es verificable.
- ❌ «Buena UX». → Es subjetivo.
- ❌ «Sin bugs». → No es un criterio operativo.
- ✅ «Pulsar Esc pausa el juego y muestra el menú». → Es verificable y booleano.

---

## Sección 5 — Decisiones tomadas y descartadas

La sección que tendrá más valor dentro de 3 meses. Registra **qué opciones consideraste**, no solo cuál elegiste.

```markdown
## Decisiones

- **Sí:** localStorage para la persistencia. Ocupa menos de 5 MB y no necesitamos consultas.
- **No:** IndexedDB. Sería overengineering para este caso.
- **Sí:** clave versionada (`save:v1`). Permite migrar el esquema más adelante sin causar fallos.
- **No:** sincronización en la nube. Se tratará en otra spec si llega a implementarse.
```

Lo ideal es que cada decisión incluya una razón breve. Las decisiones sin justificación son las primeras que se cuestionan más adelante.

---

## Sección 6 — Riesgos identificados (opcional)

Solo cuando existan riesgos que no sean evidentes. Tabla sencilla:

```markdown
## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| localStorage deshabilitado en modo privado | Fallback a un objeto en memoria. El juego sigue funcionando, pero los datos no persisten. |
| Esquema futuro incompatible | La clave incluye `:v1`. La migración se documenta en `persistence.js`. |
```

Omite esta sección para specs pequeñas o funcionalidades de alcance muy limitado.

---

## Reglas globales para todo el documento

- **Una oración por idea.** Si una oración tiene dos comas y un punto y coma, divídela.
- **Detalles concretos.** Indica nombres, rutas o claves exactos cuando formen parte de un requisito o una decisión aprobada. Deja al implementador las decisiones internas que no afecten el comportamiento acordado.
- **Sin TODOs.** Un TODO en una spec significa que no se tomó una decisión. Tómala o regístrala como decisión pendiente con una justificación.
- **Markdown estándar.** Sin extensiones extrañas. Debe renderizarse en GitHub sin sorpresas.
