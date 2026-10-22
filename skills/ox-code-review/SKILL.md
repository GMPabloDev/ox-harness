---
name: ox-code-review
description: Revisa cambios acumulados con subagentes de solo lectura y separa estándares, requisitos y correctitud.
disable-model-invocation: true
---

# /skill:ox-code-review

```text
/skill:ox-code-review [base] [--exact-base] [--committed] [--spec <ruta>] [--block <N>]
```

La invocación autoriza una revisión delegada, no correcciones, commits ni integración. Revisa los cambios acumulados de la rama y el estado actual del directorio de trabajo. `--committed` limita la revisión a commits y requiere un checkout limpio.

Si no se indica base, usa la rama local `dev` cuando exista. Si falta, pide una base. La comparación normal parte del merge-base con `HEAD`. `--exact-base` compara literalmente con la referencia elegida. Pide resolver argumentos desconocidos o incompatibles antes de ejecutar.

Usa `--spec` para indicar la fuente de requisitos. Sin esa opción, busca la SPEC vinculada a la rama. `--block` limita los requisitos exigibles al bloque indicado y a lo ya implementado. No cambia por sí solo el diff acumulado. Si falta o es ambiguo el bloque, pide identificarlo.

1. Lee completo [execution.md](execution.md). Resuelve la base, el alcance y las fuentes antes de delegar.
2. Captura el paquete según esa guía. Selecciona explícitamente los archivos nuevos pertinentes y registra las exclusiones.
3. Ejecuta los ejes independientes con `ox-reviewer` y contexto fresco. El eje Spec requiere una fuente de requisitos identificada.
4. Comprueba la vigencia del paquete y valida los informes. Entrega los hallazgos separados por eje y comunica cualquier cobertura pendiente.

Termina cuando cada eje tenga un resultado comprobado o un motivo explícito de omisión, fallo o revisión incompleta. La revisión no sustituye las pruebas ni autoriza el merge.

Adaptación para Pi de [code-review de Matt Pocock](https://raw.githubusercontent.com/mattpocock/skills/main/skills/engineering/code-review/SKILL.md).
