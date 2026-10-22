# Integración local de una SPEC en dev

Aplica este procedimiento solo después de que el usuario elija integrar la rama concreta de la SPEC en `dev`. La aceptación y el commit documental de cierre deben estar completos. Conserva las reglas de permisos y memoria de [workflow.md](workflow.md). La integración conserva la carpeta de la SPEC y usa el checkout real de `dev`.

## Reservar la integración

1. Revisa las reglas del repositorio. Si exigen PR o una estrategia incompatible, informa y pide acordar cómo continuar. La autorización no incluye publicar una PR, hacer push ni sincronizar ramas.
2. Confirma el repositorio y la rama de la SPEC. Obtén los hashes completos de origen y de `dev` y compáralos con los presentados al usuario. Si cambiaron, revisa y pide confirmar las puntas nuevas. Conserva esa elección concreta, no un permiso abierto para integrar cualquier versión posterior.
3. Llama a `ox_worktree` con `action: "integration_acquire"`, `spec`, `sourceHead`, `devHead` y `confirmed: true`. Usa ese valor solo porque el usuario eligió expresamente integrar estas puntas. La herramienta comprueba el origen limpio y reserva la integración entre todas las sesiones. Devuelve `token`, `devCwd` y los hashes reservados. Si falta la herramienta, solicita `/reload` antes de integrar. No hagas un merge alternativo sin la reserva.
4. Si otra sesión tiene la reserva, deja esta integración pendiente y conserva la SPEC. Cuando puedas reintentar, comprueba otra vez las puntas. Un cambio de `dev` necesita nueva revisión y confirmación. No sondees continuamente ni liberes una reserva ajena.
5. Usa `devCwd` en todos los comandos de integración. Si `dev` ya estaba activa en otro worktree, la herramienta usa ese checkout tras comprobarlo. Si no tenía checkout, prepara uno dedicado sin mover la rama de la SPEC. Conserva la reserva hasta confirmar el resultado o abortar el intento con seguridad.

La reserva no hace un merge, no demuestra aceptación y no sustituye la verificación del estado Git. Solo coordina las sesiones que siguen este flujo. Detente si otro actor modifica el checkout de `dev` durante el procedimiento.

## Preparar y confirmar el merge

En los siguientes pasos, todos los comandos Git usan `git -C "$DEV_CWD"`, donde `DEV_CWD` es el `devCwd` reservado. Las comprobaciones del origen usan la carpeta de la SPEC.

1. Confirma que la rama de `devCwd` sea `dev`, su `HEAD` coincida con el hash reservado y el índice y el directorio estén limpios, incluidos los archivos sin seguimiento. Comprueba que no haya otra operación Git en curso. Confirma también la punta de la rama de origen. Ante cambios, detente y renueva la revisión y la confirmación antes de otro intento.
2. Comprueba si el origen ya es ancestro de `dev` con `git merge-base --is-ancestor`. Si lo es, comunica que ya está integrado y libera la reserva con `integration_release`, su `token` y el mismo repositorio. Distingue ese resultado de un error de Git.
3. Prepara el merge del hash de origen reservado con `git merge --no-ff --no-commit`. Usa ese hash como argumento, no una referencia que pueda moverse. `--no-ff` impide que un fast-forward actualice `dev` antes de validar. Tras una preparación correcta, `HEAD` y `dev` deben seguir en su commit inicial y `MERGE_HEAD` debe identificar el origen acordado.
4. Revisa el diff del índice y ejecuta `git hook run --ignore-missing pre-merge-commit`. El merge con `--no-commit` no ejecuta por sí solo ese hook. Un fallo impide continuar. Si el hook altera contenido, revísalo antes de validar.
5. Prepara el entorno de validación de `devCwd` según las instrucciones del repositorio y [worktrees.md](worktrees.md). Ejecuta allí las comprobaciones exigidas y los criterios de aceptación afectados sobre el resultado combinado. Las pruebas de la SPEC por separado no sustituyen esta verificación, tampoco cuando Git combina ambas ramas sin conflictos de texto.
6. Comprueba que los archivos rastreados coincidan con el índice antes y después de las pruebas. Si las comprobaciones modifican archivos o el índice, detente para revisarlos. Las correcciones de implementación se acuerdan y realizan en la carpeta de la SPEC, no directamente en `dev`. Conserva el identificador del árbol validado obtenido con `git write-tree`.
7. Confirma el commit de merge solo si las comprobaciones pasan, las puntas siguen siendo las acordadas y el contenido preparado coincide con lo validado. Aplica las convenciones de mensajes y verificación de hooks de [workflow.md](workflow.md), con la referencia `SPEC: NN-slug`. No añadas otros archivos al índice para completar la integración.
8. Comprueba el commit creado, sus dos padres y la inclusión del origen en `dev`. El primer padre debe ser el commit inicial de `dev` y el segundo el origen acordado. Comprueba que el árbol del commit coincida con el validado y revisa el estado final antes de declarar el resultado.
9. Libera la reserva con `ox_worktree`, `action: "integration_release"` y su `token` desde esta misma sesión. La herramienta exige que `devCwd` esté limpio y sin operación pendiente. Si falla, conserva el token y comunica la reserva pendiente. Deja `dev` activa en su checkout y la rama de la SPEC en el suyo. No edites la SPEC para registrar el hash de merge.

## Si la integración no se puede confirmar

- Ante conflictos, comprobaciones fallidas o un fallo de commit, detente sin confirmar la integración. No elijas un lado por defecto ni cambies requisitos para hacer pasar las pruebas.
- Si el merge fue iniciado por este procedimiento desde un estado limpio y solo contiene cambios atribuibles al intento, usa `git merge --abort` en `devCwd`. Comprueba que `dev` conserva su commit inicial y que el checkout está limpio. Libera entonces la reserva. La carpeta de la SPEC no necesita cambiar de rama.
- Si hay cambios de procedencia incierta, otra operación en curso o no puedes abortar con seguridad, conserva el estado y la reserva. Informa de la carpeta afectada, la rama, los cambios pendientes y el merge en curso. No uses reset, clean, stash ni descartes para recuperar un estado aparentemente limpio.
- Si el commit ya se creó antes de detectar un problema, comunica su hash y el estado real de `dev`. No lo deshagas ni reescribas historial. Una comprobación posterior fallida no permite afirmar que quedó validado. Libera la reserva solo cuando el estado Git permita hacerlo y comunica por separado el problema observado.
- Tras una interrupción que cierre el proceso propietario, `/ox-worktree recover` permite revisar reservas. Primero confirma que no quedan workers ni comandos del intento. La recuperación no aborta merges ni elimina trabajo. Una reserva de un proceso activo se conserva.
- Resume el resultado o bloqueo en Engram según el workflow, con el checkout de origen y `devCwd`. Cualquier corrección que cambie el origen necesita validación y una nueva confirmación antes de otro intento. No borres ramas, worktrees ni workspaces como continuación automática del merge.
