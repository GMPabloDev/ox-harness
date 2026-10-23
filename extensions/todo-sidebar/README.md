# Sidebar de tareas

Extensión local para Pi 1.4.0. No instala paquetes ni modifica Pi, Herdr, `settings.json` o el tema.

## Comportamiento

- Columna derecha de altura completa, incluido el espacio junto al editor y al footer.
- Fondo y colores del tema activo, sin borde izquierdo y con una fila de margen sobre el título. En Tokyo Night, el título y el progreso usan el ámbar de `mdHeading`.
- Las tareas en curso tienen un punto ámbar y texto destacado. Las completadas tienen un check, texto atenuado y tachado. Las canceladas también aparecen tachadas.
- El panel conserva la última lista cuando termina el agente. Nunca completa tareas ni borra la lista por su cuenta.
- El estado pertenece a la sesión y a su rama. Se recupera al recargar o reanudar la sesión.
- El panel se oculta con menos de 120 columnas o 16 filas. Reaparece al recuperar espacio.
- La columna ocupa entre 30 y 42 caracteres. El chat recibe el ancho restante.
- El título se ajusta al ancho en varias líneas, sin elipsis por falta de espacio.
- El encabezado queda fijo. La lista tiene scroll independiente y una barra discreta cuando hay contenido fuera de la vista. No hay footer de ayuda.
- En fullscreen, la rueda sobre el panel desplaza las tareas sin mover el chat, incluso en los extremos de la lista.
- El panel sigue la tarea en curso hasta que se desplaza manualmente. Conserva esa posición durante las actualizaciones del mismo plan. `/todos auto` reactiva el seguimiento.

Pi descubre `index.ts` en este directorio. `/reload` carga la extensión en una sesión abierta.

## Actualización del plan

`todowrite` recibe `title`, opcional, y `todos`, la lista completa. Cada tarea tiene `id`, `content` y `status`.

Los estados son `pending`, `in_progress`, `completed` y `cancelled`. Los ids son únicos. Se permiten hasta 80 tareas, con 300 caracteres por tarea.

La herramienta incluye instrucciones para que el modelo cree un plan en trabajos de varios pasos y lo actualice durante el trabajo. El progreso depende de esas llamadas. El panel no intenta deducirlo de los nombres de herramientas o del texto del chat.

Cada llamada guarda una entrada `todo-sidebar-state` en la sesión. No se escribe un archivo global de tareas ni se comparte el plan entre sesiones.

## Comandos

| Comando | Efecto |
| --- | --- |
| `/todos` | Abre la lista completa. Flechas y PgUp/PgDn desplazan el contenido. Esc cierra la vista. |
| `/todos down` | Desplaza la lista tres líneas hacia abajo. |
| `/todos up` | Desplaza la lista tres líneas hacia arriba. |
| `/todos top` | Desplaza la lista al principio. |
| `/todos bottom` | Desplaza la lista al final. |
| `/todos auto` | Vuelve a seguir la tarea en curso. |
| `/todos hide` | Oculta el panel hasta volver a mostrarlo o recargar. |
| `/todos show` | Muestra el panel si hay espacio suficiente. |
| `/todos clear` | Borra el plan después de pedir confirmación. |

`Ctrl+Alt+↑` y `Ctrl+Alt+↓` desplazan el panel tres líneas sin quitar el foco al editor. Funcionan en ambos modos si la terminal entrega esas teclas.

## Integración con la TUI

En fullscreen, un `HStack` envuelve el layout original. El panel es un `VStack` con encabezado fijo y un `ScrollView` nativo no primario para las tareas. Conserva el scroll del chat, el editor, el footer de Pi y las coordenadas de ratón del motor de layout nativo.

El scroll lateral consume todo el delta de rueda para evitar que Pi 1.4 propague el sobrante al chat en los extremos.

En modo regular, un `Container` compone los componentes originales y dibuja el panel solo en el viewport visible. El documento no guarda copias históricas del panel. La terminal conserva el control del ratón y del scrollback. El desplazamiento independiente del panel está disponible por teclado y comandos, no por rueda.

La extensión no usa overlays permanentes, otro renderer, procesos auxiliares o temporizadores.

Pi ofrece `setLayoutRoot()` pero no un getter. La extensión lee `layoutRoot` con una comprobación de compatibilidad, aislada en `mountSidebar()`. Si cambia ese contrato, el modo fullscreen conserva la interfaz nativa sin montar el panel. Esta lectura requiere comprobación al actualizar Pi.

El widget de ciclo de vida desmonta la composición al recargar, cambiar de sesión o salir. Los modos JSON, print y RPC conservan la herramienta, pero no montan una TUI.

## Pruebas

Estas comprobaciones usan las dependencias ya instaladas de Pi. Los runners crean sus archivos temporales fuera del proyecto.

```bash
node extensions/todo-sidebar/tests/typecheck.mjs
node extensions/todo-sidebar/tests/run.mjs
python extensions/todo-sidebar/tests/live-smoke.py
```

Los runners de TypeScript aceptan `PI_GLOBAL_NODE_MODULES` para localizar otra instalación global. La prueba de terminal abre procesos Pi aislados, sin peticiones al modelo ni notificaciones a Herdr.
