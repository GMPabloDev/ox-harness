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
| `read`, `bash`, `powershell`, `edit`, `write`, `grep`, `find`, `ls`, `todowrite` | Ocultos si no fallan. |
| `tool_search`, `web_enable`, `subagents_enable` | Ocultos si no fallan. |
| `codemode` | Oculto, con resúmenes de sus llamadas anidadas a web, memoria o subagentes. |
| `web_search`, `source_check`, `fetch_content`, `get_search_content` | Una línea con la consulta, la URL o la operación. |
| Herramientas `mem_*` | Una línea con la operación de Engram, sin el contenido de la memoria. |
| `subagent`, `subagent_supervisor`, `bg_wait` | Una línea con el agente, la tarea o la operación. |
| Notificaciones de subagentes con éxito confirmado | Una línea con el agente y el estado. |
| Errores, respuestas truncadas y cancelaciones | Visibles. |
| Permisos, solicitudes de decisión y avisos de atención | Visibles con su interfaz nativa. |
| Herramientas y mensajes de extensiones desconocidas | Visibles con su interfaz nativa. |

Los paneles, los diálogos, el editor y el indicador de actividad de Pi conservan su comportamiento. El panel de tareas permanece visible. Los paneles que el usuario abre desde otras extensiones, como la actividad web, no se cierran.

`/focus off` recupera las llamadas y el pensamiento sin volver a ejecutar nada. Los controles nativos de expansión siguen determinando cuánto detalle muestra esa vista.

## Compatibilidad y límites

El adaptador está habilitado para Pi `1.4.x`. Usa el contenedor nativo del chat en los modos `regular` y `fullscreen`, sin sustituir el editor ni el contenedor del panel de tareas. Si la versión o la estructura no coinciden, la extensión muestra un aviso y conserva la vista normal.

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

Las pruebas unitarias usan los componentes reales de Pi. Las pruebas PTY cubren ambos modos de terminal, el panel de tareas, los permisos, el redimensionado, la salida interactiva y la recarga. El proveedor de prueba es local, determinista y no hace llamadas de red.

Las pruebas PTY comprueban que el contenido oculto sigue en el historial y en las siguientes peticiones del modelo. También comparan las peticiones con Focus activo y desactivado, sin las marcas de tiempo, las duraciones ni los campos de texto `id`.
