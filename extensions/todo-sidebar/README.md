# Sidebar de agentes y plan

Extensión local para Pi. No instala paquetes ni modifica Pi, Herdr, `settings.json` o el tema.

## Estructura

La columna derecha se compone de cajas compactas. La etiqueta va incrustada en la
línea superior del marco, con el meta alineado a la derecha. Las secciones se apilan
desde arriba y dejan libre el espacio que no usan.

```text
╭─ ▾ AGENTS ────────────────────────── 2 activos ╮
│ ● ox-explore                             1m12s │
│ ✓ ox-committer                           2m14s │
╰────────────────────────────────────────────────╯

╭─ ▾ PLAN ────────────────────────────────── 1/3 ╮
│ ✓  Leer contratos                              │
│ ●  Implementar panel                           │
│ ○  Probar redimensionado                       │
╰────────────────────────────────────────────────╯
```

El marco usa el color `border` del tema. La etiqueta usa el color `text` en negrita y
el meta usa `muted`. La columna mide 50 caracteres desde 140 columnas de ancho y se
oculta en terminales más angostas o de menos de 16 filas.

## Agentes

Cada fila corresponde a una ejecución de subagente. Muestra el icono de estado, el
nombre con el color de su tarjeta en el chat y el tiempo transcurrido.

| Icono | Estado |
| --- | --- |
| `●` | en marcha |
| `◆` | esperando una decisión |
| `○` | en cola |
| `✓` | terminado |
| `✗` | fallido |
| `■` | detenido |
| `‖` | en pausa |

La línea superior muestra `N activos` cuando hay filas activas e `idle` cuando no queda
ninguna. Las filas activas van primero, ordenadas por urgencia. Después
aparecen las tres ejecuciones terminadas más recientes. La caja
muestra hasta ocho filas. Si quedan más, la última fila es `+N más · /agents`.

Los datos vienen de cuatro fuentes.

- Los eventos de la herramienta `subagent` aportan el lanzamiento y el progreso de los hijos en primer plano.
- El mensaje `subagent-notify` aporta el estado final de los hijos en segundo plano.
- Las solicitudes `subagent_supervisor_request` marcan `◆ esperando` hasta que llega la respuesta.
- La rama de la sesión reconstruye el historial al recargar o cambiar de rama.

El panel pertenece a la sesión y a su rama. Conserva hasta 40 filas, descarta las
terminadas más antiguas y no comparte estado entre sesiones. En fullscreen, un
temporizador de un segundo actualiza el tiempo transcurrido mientras hay filas activas.
En modo regular, el tiempo cambia con los eventos de la herramienta y de la sesión.

Una limitación conocida. Al recargar, la lista reconstruye las ejecuciones terminadas
desde la sesión. Una ejecución en segundo plano que siga viva no reaparece hasta que
llega su aviso de finalización.

## Plan

El marco crece con la lista y usa el espacio libre de la columna. No tiene scroll propio.

- Las tareas completadas y canceladas aparecen atenuadas y tachadas.
- La tarea en curso lleva un punto ámbar y texto en negrita.
- La línea superior muestra `completadas/total`. Sin tareas muestra `vacío`, y la caja muestra `sin tareas · /todos`.
- Cuando la lista no entra en el alto disponible, las terminadas más recientes llenan las filas libres. El resto se agrupa en `✓ N · /todos` (y `− M` si hay canceladas), y las pendientes que sobran en `+N más · /todos`. La tarea en curso queda siempre visible.
- El panel conserva la última lista cuando termina el agente. Nunca completa tareas ni borra la lista por su cuenta.
- El estado pertenece a la sesión y a su rama. Se recupera al recargar o reanudar la sesión.

## Ciclo de vida del plan

El plan pertenece a la sesión y a su rama. Mientras el trabajo sea el mismo, cada
actualización conserva las tareas completadas y los ids estables.

Cuando el usuario empieza un trabajo no relacionado, el modelo reemplaza el plan
completo con ids y título nuevos. La extensión no deduce la relación desde el texto:
entrega el plan actual al modelo en cada turno y le indica que lo reemplace si la
petición es ajena. Si el plan nuevo no recibe título, la extensión vuelve a
`Plan de trabajo`.

Para borrar un plan que ya no aplica, el modelo llama a `todowrite` con una lista vacía.
El equivalente manual es `/todos clear`, que pide confirmación. Un plan terminado no se
borra solo al acabar el turno, porque el usuario todavía puede estar leyendo el
resultado o pidiendo un ajuste sobre el mismo trabajo.

## Información de sesión

La sidebar ya no repite modelo, contexto y coste en un bloque superior.

- En fullscreen, el encabezado fijo sobre el panel muestra proyecto, rama, modelo, esfuerzo, contexto, tokens y coste.
- En modo regular, el footer nativo de Pi conserva esa información.

## Comandos

| Comando | Efecto |
| --- | --- |
| `/agents` | Abre la lista completa de subagentes con estado y tarea. |
| `/agents clear` | Quita del panel las filas terminadas. Conserva las activas. |
| `/todos` | Abre el plan completo. Flechas y PgUp/PgDn desplazan el contenido. Esc cierra la vista. |
| `/todos hide` | Oculta el panel hasta volver a mostrarlo o recargar. |
| `/todos show` | Muestra el panel si hay espacio suficiente. |
| `/todos clear` | Borra el plan después de pedir confirmación. |

## Actualización del plan

`todowrite` recibe `title`, opcional, y `todos`, la lista completa. Cada tarea tiene
`id`, `content` y `status`.

Los estados son `pending`, `in_progress`, `completed` y `cancelled`. Los ids son únicos.
Se permiten hasta 80 tareas, con 300 caracteres por tarea.

La herramienta incluye instrucciones para que el modelo cree un plan en trabajos de
varios pasos y lo actualice durante el trabajo. El progreso depende de esas llamadas.
El panel no intenta deducirlo de los nombres de herramientas o del texto del chat.

Cada llamada guarda una entrada `todo-sidebar-state` en la sesión. No se escribe un
archivo global de tareas ni se comparte el plan entre sesiones. Un plan nuevo con ids
distintos reemplaza al anterior y reinicia el título si no se envía uno. Una lista vacía
borra el plan y el panel muestra `sin tareas`; la herramienta responde `Plan borrado`.

## Integración con la TUI

En fullscreen, un `HStack` envuelve el layout original. El sidebar es un `VStack` con
secciones de altura propia. El header de sesión ocupa tres filas y el panel recibe el
alto restante. Se conservan el scroll del chat, el editor, el footer de Pi y las
coordenadas de ratón del motor de layout nativo.

El raíl no tiene scroll interno. La rueda sobre la sidebar desplaza el chat, igual que
en el resto de la columna central.

En modo regular, un `Container` compone los componentes originales y dibuja el panel
solo en el viewport visible. El documento no guarda copias históricas del panel. La
terminal conserva el control del ratón y del scrollback.

La extensión no usa overlays permanentes, otro renderer ni procesos auxiliares. El único
temporizador actualiza el tiempo transcurrido de los agentes activos en fullscreen.

Pi ofrece `setLayoutRoot()` pero no un getter. La extensión lee `layoutRoot` con una
comprobación de compatibilidad, aislada en `mountSidebar()`. Si cambia ese contrato, el
modo fullscreen conserva la interfaz nativa sin montar el panel. Esta lectura requiere
comprobación al actualizar Pi.

El widget de ciclo de vida desmonta la composición al recargar, cambiar de sesión o
salir. Los modos JSON, print y RPC conservan las herramientas, pero no montan una TUI.

## Pruebas

Estas comprobaciones usan las dependencias ya instaladas de Pi. Los runners crean sus
archivos temporales fuera del proyecto.

```bash
node extensions/todo-sidebar/tests/typecheck.mjs
node extensions/todo-sidebar/tests/run.mjs
python extensions/todo-sidebar/tests/live-smoke.py
```

Los runners de TypeScript aceptan `PI_GLOBAL_NODE_MODULES` para localizar otra
instalación global. La prueba de terminal abre procesos Pi aislados, sin peticiones al
modelo ni notificaciones a Herdr. Cubre los modos regular y fullscreen, el crecimiento
y la compactación del plan, el redimensionado, `/todos`, `/agents` y la recarga.
