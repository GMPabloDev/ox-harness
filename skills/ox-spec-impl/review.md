# Revisar y corregir antes del cierre

El principal implementa, ejecuta las comprobaciones y corrige. `ox-reviewer` revisa sin editar y devuelve evidencia. La revisión independiente forma parte del cierre de `/skill:ox-spec-impl`. No requiere otra aprobación al terminar el último bloque. No añade un verificador por bloque ni una segunda revisión completa del principal.

## Preparar la revisión completa

1. Ejecuta las comprobaciones finales exigidas por la SPEC y el repositorio. Reutiliza evidencia de los bloques solo si sigue vigente. No sustituyas una comprobación pendiente por la opinión del revisor.
2. Identifica la raíz Git, la rama de la SPEC, `HEAD`, la punta de `main` y su ancestro común. Captura el cambio acumulado desde ese ancestro, no solo el último commit o el diff del directorio de trabajo.
3. Incluye los cambios sin commit y los archivos nuevos pertinentes. Guarda el diff, las rutas y la evidencia en artefactos fuera del proyecto. Registra también el estado del índice y del directorio, y las huellas del contenido pendiente cuando exista. Una referencia a `HEAD` no identifica por sí sola un checkout con cambios.
4. Prepara un encargo que contenga el objetivo, el repositorio, el `cwd`, las referencias, las rutas de los artefactos, la SPEC, los fundamentos e instrucciones pertinentes, los criterios de aceptación y las validaciones realizadas con sus límites. Identifica las decisiones aprobadas y las incógnitas. Prepara también [la entrega selectiva de principios al revisor fresh](../ox-mode/principles.md#revisión-con-contexto-nuevo), con rutas absolutas e instrucciones de lectura. No envíes solo el resumen del implementador ni una conclusión que el revisor deba confirmar. Excluye secretos y datos sensibles.
5. Mantén estable el código durante la revisión. No edites, cambies de rama ni permitas otro escritor en esa carpeta mientras el revisor inspecciona el resultado.

El principal captura el diff y ejecuta Git porque `ox-reviewer` solo tiene herramientas de lectura. El revisor puede leer los archivos y contratos del checkout estable y contrastarlos con la evidencia recibida.

## Encargar la revisión

1. Usa las herramientas de `pi-subagents`. Si aún no están disponibles, habilítalas con `subagents_enable`. Comprueba que `ox-reviewer` esté disponible y respeta su modelo, sus herramientas y los límites del perfil. No habilites agentes builtin ni alteres otros perfiles para suplirlo.
2. Anuncia el agente, el alcance y el beneficio en una frase. Encarga una revisión completa a un solo `ox-reviewer`, con el `cwd` explícito, `async: true` y `options.context: "fresh"`. Usa una llamada directa a `subagent` para esa pasada. No bifurques la conversación del implementador.
3. Exige un informe con cobertura, versión, hallazgos sustentados, prioridades y comprobaciones pendientes. El revisor no puede editar, ejecutar comandos, escribir tests, hacer commits ni aprobar integración.
4. Conserva la salida `file-only` del perfil. Omite `output` para usar su destino gestionado o indica una ruta fuera del proyecto. No pases `output: false` ni pidas al revisor crear informes dentro del repositorio.
5. Mientras trabaja, solo realiza tareas que no alteren lo revisado. Registra fuera del checkout el id de ejecución, el número de pasada, la versión y los artefactos para reanudar sin duplicar la revisión ni reiniciar el contador. Si no queda trabajo seguro, cede el turno y reanuda tras la notificación nativa. No marques el cierre como completo, no sondees en bucle ni uses `bg_wait` para un subagente ordinario con notificación nativa.
6. Lee el informe completo y comprueba que la versión y el contenido siguen siendo los revisados. Si cambiaron, no reutilices una conclusión obsoleta; actualiza la evidencia y revisa el alcance afectado.

Un fallo de arranque, modelo, herramientas o ejecución deja la revisión pendiente. Registra el error y el estado del repositorio. No cambies de modelo, uses otro ejecutor ni sustituyas la revisión independiente por autorrevisión sin autorización explícita.

## Confirmar y corregir hallazgos

Esta regla también se aplica a los bugs detectados durante un bloque o comunicados por el usuario.

1. Contrasta cada hallazgo con el código actual y el contrato aprobado. Clasifícalo como fallo confirmado dentro del alcance, problema previo o ajeno, mejora opcional, hipótesis pendiente, resuelto o inválido. Justifica los descartes con evidencia. No aceptes ni rechaces un hallazgo solo por su prioridad. Una hipótesis sin evidencia ni contradicción del contrato no bloquea por sí sola. Si impide comprobar un criterio obligatorio, registra esa aceptación pendiente.
2. Para un bug, identifica el comportamiento esperado, el observado, la reproducción y la causa. Busca el mismo fallo en los recorridos relacionados dentro del alcance. Si requiere una decisión de producto, modifica un requisito o amplía el alcance, consulta antes de corregir.
3. Corrige los fallos confirmados dentro del alcance autorizado sin pedir un permiso adicional por cada uno, salvo que el usuario haya pedido esa pausa. Si la SPEC ya figura `Implementada`, acuerda su reapertura antes de cambiar código o progreso. Una petición explícita de corregir ese bug puede aportar ese acuerdo; registra el motivo y conserva lo que siga vigente.
4. Lee y aplica [ox-tdd](../ox-tdd/SKILL.md) cuando el usuario pida TDD o un test de regresión, o cuando el bug tenga una vía de prueba local clara y económica. En esa vía, escribe el test, demuestra que falla por el motivo esperado y solo entonces modifica el código de producción. Confirma después que pasa.
5. No fuerces un test que requiera infraestructura desproporcionada, mocks frágiles o datos inaccesibles. Usa la comprobación ejecutable útil más cercana y explica si no pudiste demostrar el fallo previo. Evitar un test nuevo no autoriza omitir validación. No impongas TDD a features ni a tareas no funcionales.
6. Corrige la causa con un cambio enfocado y conserva los contratos cercanos. No debilites aserciones para acomodar una implementación incorrecta. Separa mejoras opcionales y trabajo ajeno; no los conviertas en requisitos de cierre por tu cuenta.
7. Ejecuta las comprobaciones afectadas y revisa el diff correctivo. Registra lo comprobado, las limitaciones y los hallazgos resueltos en las verificaciones existentes de la SPEC. Guarda los arreglos y su progreso según las reglas de commits de `SKILL.md`.

## Revisar los arreglos

Después de corregir hallazgos de la revisión final, encarga una comprobación enfocada a `ox-reviewer` con contexto nuevo. Recalcula y entrega [los principios pertinentes a los arreglos](../ox-mode/principles.md#revisión-con-contexto-nuevo) en ese nuevo encargo. Incluye los identificadores, su disposición, la versión anterior, el diff correctivo completo, la versión actual y la evidencia de las nuevas comprobaciones.

Pide comprobar si los fallos aceptados se resolvieron, si el arreglo introduce problemas en los recorridos afectados y si las observaciones pendientes siguen vigentes. No repitas toda la revisión por cada arreglo localizado. Si cambian contratos, diseño o varias áreas de forma que la revisión anterior ya no cubra el resultado, amplía la revisión o repítela completa.

Usa como máximo tres pasadas por intento de cierre, incluida la revisión inicial y las revisiones de arreglos. No consumas pasadas en pulido opcional. Si al alcanzar el límite siguen existiendo fallos exigibles o cobertura relevante pendiente, conserva el cierre pendiente, informa y pide decidir cómo continuar. El límite no convierte un fallo en aceptable.

Una revisión completa sin hallazgos no necesita otra pasada por rutina. El principal acepta la evidencia, resuelve discrepancias y comprueba los contratos decisivos, sin repetir automáticamente toda la auditoría ni todos los comandos del revisor.

## Resolver bugs antes de integrar

Si el usuario encuentra un bug al probar la aplicación, suspende la oferta de integración y confirma el fallo antes de parchear. Sigue la regla de corrección anterior y vuelve a comprobar el arreglo con `ox-reviewer`. Una revisión completa adicional solo corresponde si el alcance o la clase de fallo lo justifican.

Si la corrección reabre una SPEC `Implementada`, devuelve su estado a `Aprobada` tras el acuerdo y deja pendiente la aceptación afectada. Repite el cierre antes de ofrecer integrar. Una corrección posterior invalida la evidencia anterior que dependa del código cambiado y exige confirmar la integración sobre la versión corregida.

## Registrar la aceptación

Cierra solo con criterios y comprobaciones exigidos completos, cobertura suficiente de la revisión y fallos confirmados dentro del alcance resueltos. Una revisión parcial con cobertura relevante pendiente o una validación obligatoria no ejecutada mantienen pendiente la aceptación. No conviertas sugerencias o conjeturas sin evidencia en bloqueos.

Resume en la evidencia existente de la SPEC el agente, el modelo efectivo, la versión revisada, la cobertura, la disposición de los hallazgos y las comprobaciones posteriores. Guarda el informe extenso fuera del proyecto. No dependas solo de una ruta temporal para explicar el resultado.

El commit documental de cierre puede cambiar `HEAD` después de la revisión. Comprueba que solo registre estado y evidencia, sin cambiar código ni contratos revisados, y distingue ambos commits al comunicar el resultado. Si introduce otros cambios, revisa lo afectado antes de aceptar el cierre.

Un informe limpio no autoriza merge, push ni despliegue. El principal conserva la aceptación técnica y el usuario decide la integración según `SKILL.md`.
