# Trabajar con SPECs en paralelo

Esta extensión conecta las carpetas Git de ox con sesiones de Pi en Herdr. Conserva los perfiles, modelos, TDD y permisos de integración existentes. No necesita paquetes nuevos ni ofrece un flag nativo `pi --worktree`.

## Activar la extensión

1. Ejecuta `/reload` en Pi. La extensión se descubre en `~/.pi/agent/extensions/ox-worktrees/index.ts`.
2. Comprueba que `/ox-worktree help` aparece. La apertura automática de otras sesiones requiere estar dentro de Herdr.
3. Conserva la integración oficial de Herdr con Pi instalada mediante `herdr integration install pi`. Recárgala en las sesiones que ya estuvieran abiertas.

## Definir e implementar

Si necesitas elegir por dónde empezar, usa `/skill:ox`. Ese índice propone el siguiente comando sin iniciar trabajo ni exigir todas las fases.

Antes de crear una SPEC, el proyecto necesita Git, al menos un commit y una rama local `dev`. Si falta esa preparación, autorízala por separado. Ox no inicializa el repositorio ni elige otra base por su cuenta.

Define una SPEC como hasta ahora:

```text
/skill:ox-spec Permitir exportar las facturas a CSV
```

El modo automático usa la carpeta actual si está limpia y no hay otra SPEC activa. Cuando hay otra SPEC o cambios que conservar, crea una carpeta aislada desde `dev` sin cambiar la anterior.

Para pedir aislamiento desde el principio:

```text
/skill:ox-spec Permitir exportar las facturas a CSV --worktree
```

Revisa el documento en su carpeta. Si ox abrió otro workspace, entra en él desde Herdr o con `/ox-worktree`. Aprueba la versión actual y pide implementar allí:

```text
/skill:ox-spec-impl NN-slug --all
```

Sustituye `NN-slug` por el nombre que ox devolvió. `--all` ejecuta los bloques sin pausas intermedias. No aprueba requisitos ni autoriza integrar en `dev`.

Mientras trabaja, puedes abrir otra SPEC independiente en otro workspace. Una dependencia ausente sigue bloqueando su implementación. El estado `done` de Herdr no demuestra que una SPEC haya superado sus validaciones.

Usa `--here` al definir solo si quieres exigir una tarea secuencial en una carpeta limpia. Ox se detiene si esa carpeta pertenece a otra SPEC.

## Retomar una SPEC

Ejecuta `/ox-worktree` y selecciona la SPEC. También puedes abrirla directamente:

```text
/ox-worktree open NN-slug
```

Ox reutiliza la carpeta y la sesión existentes. No envía otra tarea a un Pi que ya esté abierto. Continúa en esa sesión con sus comandos habituales. Para consultar las rutas exactas, usa `/ox-worktree list`. Una interrupción de Herdr no autoriza crear un segundo escritor ni borrar la carpeta.

## Integrar y conservar el trabajo

Cuando termina la aceptación, ox ofrece integrar la SPEC en `dev`. Revisa y confirma esa integración concreta. El flujo reserva el checkout de `dev` para una sola sesión y ejecuta allí las pruebas del resultado combinado.

Si otra integración cambió `dev`, ox presenta las puntas nuevas antes de otro intento. No hace push ni borra ramas o carpetas como continuación del merge.

Para consultar las carpetas, ejecuta `/ox-worktree list`. Para eliminar una que ya no necesitas, cierra primero su workspace y ejecuta `/ox-worktree remove NN-slug`. La extensión pide confirmación y conserva la rama. Se detiene ante cambios pendientes, commits sin integrar, archivos ignorados o procesos que no pueda descartar. En sistemas que restringen la lectura de `/proc`, la carpeta puede conservarse por ese límite de comprobación.

Si una sesión terminó durante una reserva, usa `/ox-worktree recover` después de comprobar que sus workers y comandos terminaron. No recupera reservas de procesos activos ni aborta un merge por ti.

Las carpetas nuevas no copian `.env`, dependencias ni configuración ignorada. Ox prepara el entorno durante la implementación autorizada. Las bases de datos, los puertos y otros recursos externos necesitan su propio aislamiento.

## Comprobar la instalación

Desde esta carpeta, ejecuta las pruebas sin abrir terminales adicionales:

```bash
node --test tests/*.test.mjs
node tests/typecheck.mjs
```

Para probar la apertura real, usa un servidor Herdr temporal y dos sesiones Pi sin encargos de modelo:

```bash
OX_HERDR_SMOKE=1 node --test tests/live-herdr.smoke.mjs
```

La prueba crea y detiene solo su sesión Herdr con nombre propio. No usa tus repositorios ni tus credenciales. La guía que sigue el agente está en [worktrees.md](../../skills/ox-spec/worktrees.md).
