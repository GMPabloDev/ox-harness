# Colores de estado de herramientas

`tool-status` añade un borde izquierdo y una cabecera de estado a las herramientas nativas `read`, `bash`, `powershell`, `edit`, `write`, `grep`, `find` y `ls`.

| Estado | Texto y borde | Fondo |
|---|---|---|
| Éxito | `success`, actualmente `#5fd7a0` | `toolSuccessBg`, actualmente `#102620` |
| Error | `error`, actualmente `#ff5c7a` | `toolErrorBg`, actualmente `#2b1420` |

El cuerpo de un error usa el color de error. El cuerpo de un resultado correcto conserva su formato y su resaltado de sintaxis. Las herramientas en curso conservan su presentación nativa.

La extensión usa `registerToolRenderer`. No sustituye las funciones de ejecución ni modifica los resultados enviados al modelo. Las herramientas desconocidas y las extensiones con `renderShell: "self"` conservan su presentación.

Los colores proceden de `~/.config/theme-palette/ox-theme.json` y del generador `~/.config/theme-palette/sync.py`. Los tokens `status_success` y `status_error` son independientes del rojo y del verde originales del tema.

`/reload` carga la extensión en una sesión abierta. Focus sigue ocultando las herramientas rutinarias correctas y mostrando sus errores. `/focus off` permite comparar ambos estados en el chat.

Las comprobaciones compartidas se ejecutan desde `~/.pi/agent`:

```sh
node extensions/focus/tests/run.mjs
node extensions/focus/tests/typecheck.mjs
python3 extensions/focus/tests/live-smoke.py
```
