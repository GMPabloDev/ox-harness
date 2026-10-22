# Carpetas aisladas para SPECs de ox

Lee esta guía al preparar una SPEC, retomar una rama desde otro checkout o coordinar implementaciones paralelas. `ox_worktree` prepara y localiza las carpetas. Git conserva su identidad. Para definir requisitos, sigue [ox-spec](SKILL.md). Para implementarlos, sigue [ox-spec-impl](../ox-spec-impl/SKILL.md) y comprueba su aprobación antes de lanzar trabajo. La SPEC sigue siendo la única fuente de requisitos y progreso.

## Elegir la carpeta

La invocación de `ox-spec` admite `--worktree` y `--here`. Son opciones de esta skill, no flags nativos del ejecutable `pi`.

- Sin opción, usa `mode: "auto"`. Conserva el flujo sencillo cuando la carpeta está limpia y no hay otra SPEC activa en los worktrees del repositorio. Si hay otra SPEC o cambios que conservar, prepara una carpeta aislada sin mover ese trabajo.
- Usa `mode: "worktree"` si el usuario pide aislamiento, trabajo paralelo o `--worktree`.
- Usa `mode: "here"` solo si pide `--here`. Requiere una carpeta limpia que no pertenezca a otra SPEC. Si no cumple esas condiciones, explica el impedimento en lugar de cambiar el modo silenciosamente.
- Para retomar una SPEC existente, usa `spec` en vez de `slug`. Reutiliza el checkout que Git ya le asigna, incluso si contiene cambios sin commit. No recrees su rama ni actualices su base.

Si falta `ox_worktree`, pide `/reload` o reparar la extensión antes de preparar carpetas. No pidas al usuario crear worktrees a mano ni sustituyas el fallo por cambios de rama durante una ejecución activa.

## Preparar una SPEC nueva

1. Resuelve requisitos y deriva un slug ASCII kebab-case. Retira las opciones de ubicación de la descripción funcional.
2. Llama a la herramienta antes de escribir el documento:

```json
{"action":"prepare","slug":"exportar-facturas","mode":"auto"}
```

3. Usa exactamente `spec`, `branch`, `cwd` y `specPath` del resultado. La herramienta reserva el número entre procesos, consulta documentos y ramas existentes y crea desde el commit comprobado de `dev`. Para fundamentos técnicos, pasa `number: 0` solo si el usuario pidió `00`.
4. Relee en ese `cwd` las instrucciones, fundamentos y contratos afectados. Una carpeta nueva no contiene cambios sin commit de otra. Resuelve diferencias relevantes con el contexto inicial antes de escribir.
5. Guarda la SPEC directamente en `specPath`. Usa rutas absolutas para leer y escribir. Ejecuta los comandos con ese directorio explícito, por ejemplo `git -C "$SPEC_CWD" ...` o `cd "$SPEC_CWD" && ...`. La herramienta no cambia el directorio de la sesión actual.
6. Verifica el documento guardado y registra el resultado. Si `cwd` difiere del de esta sesión, abre su sesión con `action: "open"` y `spec` después de guardar. Sin `task`, abre Pi sin iniciar implementación. Conserva el foco del usuario salvo petición contraria.

La extensión no hace commits ni guarda una SPEC por sí sola. No copies un documento pendiente a otra rama para sortear una colisión. Si la preparación falla a mitad, conserva la rama y la carpeta devueltas por Git y revisa su identidad antes de reintentar.

## Retomar o implementar desde otra sesión

1. Localiza la SPEC con `action: "resolve"` y su referencia. Lee el documento de su `specPath`, no una copia antigua de otra rama. Si la rama no tiene checkout, usa `prepare` con `spec` para materializarlo sin alterar su historia.
2. Compara el `cwd` de la SPEC con la raíz Git de esta sesión. Un subdirectorio del mismo checkout cuenta como la carpeta actual. Si coinciden, continúa aquí. Si son checkouts distintos, usa `open`. Para iniciar una implementación autorizada, pasa en `task` la invocación completa de `ox-spec-impl`, su modo y un encargo autocontenido con acuerdos relevantes, instrucciones aplicables y restricciones. La nueva sesión vuelve a comprobar la aprobación y las dependencias. Abrirla no aprueba una SPEC.
3. Comprueba `disposition` y `taskDelivered`. `started` indica que Pi arrancó. `reused` indica una sesión ya existente a la que no se envió otra tarea. Con `current`, continúa en esta sesión; no hubo un traspaso. Un error de arranque conserva el workspace para resolver confianza, autenticación o permisos desde su interfaz.
4. Tras entregar la implementación a otra sesión, termina esta invocación indicando la SPEC y el workspace. Esa sesión es el principal de la SPEC y coordina sus propios workers. No lances otro escritor desde la sesión de origen.

No inyectes un segundo encargo en una sesión existente, aunque Herdr la muestre `idle` o `done`. Puede mantener trabajo asíncrono. El usuario puede abrirla con `/ox-worktree` y continuar allí. La extensión conserva el archivo de sesión original cuando existe. Para una sesión nueva usa el identificador estable `ox-spec-NN-slug`, que permite retomarla después de cerrar Pi. Las sesiones son independientes, no subagentes con permisos ampliados.

Fuera de Herdr, Git puede preparar la carpeta, pero la apertura automática se detiene con su ruta. Conserva el trabajo y explica que debe abrirse desde una sesión de Pi dentro de Herdr. No cambies el directorio del proceso actual ni uses otro lanzador sin autorización.

## Comprobar independencia y entorno

Antes de iniciar una segunda implementación, contrasta `Depende de`, `Modifica`, `Reemplaza` y los contratos reales. Distintos archivos no prueban independencia. Dos cambios sobre el mismo contrato necesitan un acuerdo común o ejecución en serie. Una dependencia ausente permite definir la SPEC, pero bloquea la implementación que la necesita. Las ramas apiladas requieren un acuerdo aparte.

Mantén un único escritor por checkout. Dentro de cada SPEC, el principal cede la edición al worker y conserva su carpeta, rama e índice mientras trabaja. Pasa el mismo `cwd` a los revisores y a sus capturas. No añadas `worktree: true` a cada bloque: el aislamiento persistente ya lo aporta la carpeta de la SPEC.

Comprueba antes de validar o implementar:

- Las instrucciones y la configuración de proyecto disponibles en el worktree. Los archivos `.pi`, instrucciones o scripts locales ignorados pueden no existir allí. Identifica la diferencia y acuerda cómo preparar lo necesario sin copiar configuración ejecutable a ciegas.
- Las dependencias y el procedimiento de instalación del repositorio. Guarda esa preparación por carpeta. No enlaces entornos mutables entre ramas por defecto.
- Los puertos, bases de datos y recursos externos usados por pruebas y servidores. Separa los que puedan interferir. Un worktree no es un contenedor ni limita los permisos de archivos del agente.
- Los secretos necesarios. No copies todos los archivos ignorados, no publiques valores y no ejecutes instalaciones desde `ox-spec`. Prepara el entorno durante la implementación autorizada.

## Integrar, recuperar y limpiar

Integra solo después de aceptación completa y confirmación explícita, siguiendo [integration.md](integration.md). La reserva de integración es compartida por todos los worktrees del repositorio. Si otro principal la tiene, deja la integración pendiente y conserva la SPEC implementada. No cambies las puntas confirmadas por las que haya al terminar la espera.

El estado operativo vive en el directorio Git compartido, bajo `ox-worktrees/`. Contiene asignaciones de carpetas, paneles y reservas, no tareas ni aprobaciones. No lo incluyas en commits. `repositoryRoot` identifica el checkout principal para resolver la memoria del mismo proyecto desde todas las carpetas.

`/ox-worktree` muestra las SPECs y abre la elegida. `list` consulta sin abrir. `open NN-slug` retoma una. Ninguno integra ramas.

`remove NN-slug` pide confirmación y conserva la rama. Solo elimina desde otra carpeta un worktree creado por ox, integrado en `dev`, limpio, sin archivos ignorados y sin procesos comprobables. Cierra primero su workspace desde Herdr. Si el sistema impide comprobar procesos, conserva la carpeta y comunica ese límite. No uses `--force`, `rm -rf` ni un borrado alternativo para sortear la protección.

`recover` pide confirmar que los procesos del intento interrumpido están detenidos. Solo libera reservas cuyos propietarios terminaron en la misma máquina y cuyo estado Git permite recuperarlas. No aborta merges, no desbloquea worktrees ajenos y no elimina carpetas. Una operación Git pendiente requiere inspección antes de recuperar su reserva.
