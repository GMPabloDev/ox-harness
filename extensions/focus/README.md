# Focus

`/focus` filtra la vista del chat de Pi. Oculta el pensamiento estructurado, los comentarios intermedios y las herramientas rutinarias. La respuesta aparece completa cuando Pi emite `agent_settled`.

La extensión no cambia el historial, el contexto, los resultados de herramientas ni el nivel de razonamiento. Tampoco reduce el consumo de tokens.

## Comandos y preferencia

| Comando | Comportamiento |
|---|---|
| `/focus` | Alterna el filtro y guarda la preferencia. |
| `/focus on` | Activa el filtro y guarda la preferencia. |
| `/focus off` | Restaura la vista nativa completa y guarda la preferencia. |
| `/focus status` | Muestra el estado y la ruta de la preferencia. |

Focus está activo por defecto. La preferencia se guarda en `<agent-dir>/focus.json`, normalmente `~/.pi/agent/focus.json`. Ese archivo no contiene conversaciones ni memorias.

```json
{
	"version": 1,
	"enabled": true
}
```

La carpeta `~/.pi/agent/extensions/focus/` se descubre como extensión global. `/reload` carga los cambios en una sesión abierta.

## Elementos visibles

| Elemento | Vista con Focus activo |
|---|---|
| Pensamiento estructurado | Oculto, sin etiquetas `Thinking...`. |
| Texto del asistente durante la ejecución | Oculto hasta que termina el procesamiento automático. |
| Respuesta final o pregunta final | Completa y sin el pensamiento. |
| Lectura de `SKILL.md` o invocación `/skill:name` | Una línea con el nombre de la skill, sin sus instrucciones. |
| Otras lecturas y `bash`, `powershell`, `edit`, `write`, `grep`, `find`, `ls`, `todowrite` | Ocultos si no fallan. |
| `tool_search`, `web_enable`, `subagents_enable` | Ocultos si no fallan. |
| `codemode` | Oculto, con resúmenes de sus llamadas anidadas a web, memoria, subagentes o skills. |
| `web_search`, `source_check`, `fetch_content`, `get_search_content` | Una línea con icono, la consulta, la URL o la operación. |
| Herramientas `mem_*` | Una línea con icono, la operación de Engram y sin el contenido de la memoria. |
| `subagent` con lanzamiento | Una tarjeta por agente. |
| `subagent_supervisor`, `bg_wait`, `contact_supervisor` con `progress_update` | Una línea con el agente o la operación. |
| Notificaciones de subagentes con éxito confirmado | Una línea con el agente y el estado. |
| Errores, respuestas truncadas y cancelaciones | Visibles. |
| Permisos, solicitudes de decisión y avisos de atención | Visibles con su interfaz nativa. |
| Herramientas y mensajes de extensiones desconocidas | Visibles con su interfaz nativa. |

Los diálogos, el editor y el indicador de actividad de Pi conservan su comportamiento. El panel de tareas permanece visible. Los paneles que el usuario abre desde otras extensiones, como la actividad web, no se cierran.

En esta instalación, `~/.pi/agent/extensions/subagent/config.json` define `asyncWidget: false` y `fleetView: false` para evitar resúmenes duplicados junto a las tarjetas. Son ajustes globales de `pi-subagents`, independientes de `/focus`. El seguimiento, las notificaciones y el inspector `/subagents-fleet` siguen disponibles.

`/focus off` recupera las llamadas y el pensamiento sin volver a ejecutar nada. Los controles nativos de expansión siguen determinando cuánto detalle muestra esa vista.

Las lecturas de `SKILL.md` muestran `Cargando skill · nombre` mientras se ejecutan y `Skill cargada · nombre` al terminar correctamente. El nombre procede del frontmatter devuelto por la lectura. Si no está disponible, Focus usa el nombre de la carpeta. Las lecturas fallidas conservan su error nativo y no se muestran como cargas correctas. Las invocaciones `/skill:name` muestran el nombre aunque la expansión nativa esté activada.

Focus no enumera las skills disponibles como si estuvieran cargadas. Detecta las lecturas de `SKILL.md` mediante `read` y las invocaciones explícitas. No detecta lecturas mediante `bash` ni instrucciones que ya estaban en el contexto antes del historial visible. Las lecturas de fragmentos y las llamadas anidadas sin contenido conservado usan el nombre de la carpeta.

## Tarjetas de subagente

Cada lanzamiento de `subagent` dibuja una tarjeta por agente, con dos columnas de margen interior y una fila vacía arriba y abajo. El fondo usa `customMessageBg`.

El borde y el nombre usan colores exactos del tema, sin mezclarlos. `ox-scout` usa `toolDiffAdded` y `ox-researcher` usa `mdLink`. Otros nombres reciben un token estable del tema. La primera fila de contenido muestra el estado y el tiempo. En un terminal ancho, el modelo, el nivel de pensamiento, los tokens de contexto y de salida, el coste y el número de llamadas van a la derecha de esa fila. Después vienen la tarea y la última herramienta que usó el run, con la URL o la ruta cuando la herramienta es de web, lectura o búsqueda de archivos.

Los datos salen del `status.json` que el run escribe en su `asyncDir`. La extensión lee ese archivo como mucho una vez por segundo y lo cachea por run. Mientras un run sigue activo, un temporizador de un segundo pide un repintado para que el tiempo y la actividad avancen. Un run terminado deja de refrescar y muestra el estado final.

La tarjeta no copia el cuerpo del resultado ni el contenido de la memoria. Solo muestra argumentos de `web_search`, `source_check`, `fetch_content`, `get_search_content`, `read`, `grep`, `find` y `ls`. Los argumentos de `mem_*`, `bash` y otras herramientas quedan fuera aunque el run los haya usado.

Sin `status.json`, la tarjeta usa el resultado del lanzamiento o, si aún no existe, el agente y la tarea del propio input. Los chips de Web y de Engram usan un icono y un color fijos, para que se distingan de un subagente sin leer el texto.

## Compatibilidad y límites

El adaptador está habilitado para Pi `1.x`. En cada arranque comprueba la estructura del contenedor del chat, no el número de versión menor: pasar de `1.4` a `1.5` no lo desactiva. Usa el contenedor nativo del chat en los modos `regular` y `fullscreen`, sin sustituir el editor ni el contenedor del panel de tareas. Si la versión mayor o la estructura no coinciden, la extensión muestra un aviso y conserva la vista normal. Después de actualizar Pi, ejecuta las pruebas PTY para confirmar que el filtrado sigue funcionando.

Pi no expone una API pública para filtrar todo el chat. `view.ts` concentra el acceso a los componentes internos y crea una presentación separada para las respuestas. No modifica los mensajes originales. La limpieza restaura los métodos de los componentes al recargar o cambiar de sesión. Durante `/reload`, Pi desmonta las extensiones y puede mostrar brevemente la vista nativa antes de reinstalar el filtro.

El filtro no elimina pensamiento que un proveedor envía como texto normal, por ejemplo etiquetas dentro de una respuesta. Tampoco adivina qué herramientas renombradas son búsquedas web. Las herramientas desconocidas conservan su vista nativa para evitar ocultar preguntas o permisos.

Los eventos de las llamadas anidadas permiten mostrar su actividad mientras se ejecutan. Al reanudar una sesión, Focus usa los metadatos `nestedCalls` conservados por Pi. Los registros incompletos y los fallos mantienen el resultado nativo del padre.

El historial reanudado conserva la última respuesta sin herramientas de cada prompt. Las respuestas que Focus ya mostró permanecen visibles durante las continuaciones posteriores. La extensión no filtra `/tree`, las exportaciones, los modos RPC, JSON ni print. Focus no es un mecanismo de privacidad.

## Verificación

Las pruebas se ejecutan desde `~/.pi/agent` con las dependencias ya instaladas de Pi. `PI_GLOBAL_NODE_MODULES` permite cambiar la ruta de esas dependencias.

```sh
node extensions/focus/tests/run.mjs
node extensions/focus/tests/typecheck.mjs
python3 extensions/focus/tests/live-smoke.py
```

Las pruebas unitarias usan los componentes reales de Pi. Las pruebas PTY cubren ambos modos de terminal, los nombres de las skills consultadas, el panel de tareas, los permisos, el redimensionado, la salida interactiva y la recarga. El proveedor de prueba es local, determinista y no hace llamadas de red.

Las pruebas PTY comprueban que el contenido oculto sigue en el historial y en las siguientes peticiones del modelo. También comparan las peticiones con Focus activo y desactivado, sin las marcas de tiempo, las duraciones ni los campos de texto `id`.
