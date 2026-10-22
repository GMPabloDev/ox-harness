# Ejecutar una revisión aislada

Aplica este procedimiento al invocar `ox-code-review` o durante la revisión final de `ox-spec-impl`. El agente principal prepara el alcance, delega la lectura y valida las conclusiones. Los revisores no modifican el proyecto.

## 1. Resolver el alcance y las fuentes

1. Comprueba la raíz Git, la rama, el estado y la referencia base. Conserva los cambios existentes. No hagas checkout, stash, commits ni cambios de configuración para facilitar la revisión.
2. Fija si revisas toda la implementación o un bloque. Para un bloque, enumera los criterios exigibles, las garantías ya implementadas y los bloques futuros excluidos. El diff sigue siendo acumulado salvo que el usuario acuerde otro alcance.
3. Elige los requisitos en este orden: fuente explícita del usuario, SPEC de la rama, issues vinculados al cambio. Copia al paquete el texto aprobado que solo exista en el chat o en una fuente externa. Si las fuentes se contradicen, pide resolverlo. Si no existe ninguna, omite Spec con ese motivo. Una fuente solicitada pero inaccesible deja Spec bloqueado, no omitido por falta de requisitos.
4. Identifica los estándares vigentes en las instrucciones del repositorio, los documentos aplicables y los fundamentos del proyecto. Usa solo acuerdos vigentes de `docs/foundation.md` o su equivalente. Su ausencia no bloquea Standards. Las propuestas sin aprobar no son requisitos.
5. Inspecciona los nombres de los archivos nuevos antes de seleccionarlos. Incluye los que pertenezcan al cambio. Si detectas un posible secreto, detente sin reproducirlo ni copiarlo al paquete. Identifica los archivos excluidos y su efecto sobre la cobertura.

Continúa cuando cada referencia sea inequívoca y los archivos pertinentes estén identificados. Si no hay cambios, informa de ello sin lanzar revisores.

## 2. Capturar el mismo cambio para todos

Resuelve `SKILL_DIR` desde la ubicación de esta guía. Usa la raíz del repositorio como `REPO` y la referencia acordada como `BASE`.

```bash
python3 "$SKILL_DIR/scripts/review_packet.py" capture --repo "$REPO" --base "$BASE"
```

Añade `--untracked=RUTA` por cada archivo nuevo inspeccionado, con su ruta exacta relativa al repositorio. Traslada `--exact-base` y `--committed` cuando correspondan. Consulta `capture --help` para las opciones del helper. Requiere Python 3.9 o posterior y Git.

El helper devuelve la ruta de un paquete temporal fuera del repositorio. `manifest.json` fija los SHAs, la comparación, el alcance, los archivos y las exclusiones. `diff.patch` representa el cambio neto frente a la base, con la versión actual del archivo cuando difieren el índice y el directorio de trabajo. `commits.txt` conserva el historial incluido.

El helper rechaza conflictos sin resolver y submódulos modificados. Revisa cada submódulo por separado antes de afirmar cobertura del conjunto. Los binarios, archivos generados y cambios demasiado grandes requieren evidencia específica. Declara la limitación si no puedes inspeccionarlos.

Crea `context.md` en el paquete con este contrato breve:

- Objetivo de la revisión e idioma del informe.
- Alcance completo o bloque, criterios incluidos y trabajo futuro excluido.
- Rutas y secciones de los requisitos aprobados y los estándares aplicables. Incluye las fuentes externas capturadas, no la conversación completa.
- Validaciones ejecutadas por el principal, sus resultados comprobados y las comprobaciones pendientes. Enlaza las salidas extensas.
- Exclusiones y limitaciones conocidas del paquete.

Usa `manifest.json` como fuente de identidad. Evita repetir los SHAs en otro registro. Mantén el paquete y sus fuentes sin cambios mientras se revisan. Pide pausar otros escritores del checkout. Las herramientas readonly no congelan el sistema de archivos ni crean un sandbox de lectura.

## 3. Comprobar y lanzar el motor

1. Lee la skill instalada `pi-subagents` y sus referencias para ejecución y revisión. Usa su API instalada, no formas heredadas de `tasks` o `chain`.
2. Si falta `subagent`, llama `subagents_enable({})` cuando esa herramienta exista. Usa `subagent` en la siguiente solicitud al modelo. Si tampoco está disponible, deja la revisión pendiente y solicita recargar o reiniciar Pi. Una CLI alternativa o la revisión del principal no sustituyen silenciosamente la revisión delegada.
3. Consulta `subagent` con `action: "get"`, `agent: "ox-reviewer"` y `options: { agentScope: "user" }`. Comprueba que el modelo efectivo coincida con la selección del usuario para este perfil y exista en el registro. Si una configuración del proyecto lo sustituye, pide resolver la diferencia. Un fallo del proveedor queda pendiente, sin cambiar de modelo por iniciativa propia.
4. Comprueba que el perfil efectivo conserve solo `read`, `grep`, `find` y `ls`, contexto fresco y extensiones ambientales desactivadas. Si una configuración o extensión obligatoria amplía esas capacidades, resuelve el conflicto antes de lanzar. La identidad readonly no basta por sí sola.
5. Valida `scripts/review.workflow.js` con `action: "validate"` antes de ejecutarlo. Usa las mismas rutas y argumentos que en el lanzamiento.
6. Lanza un único workflow asíncrono con esta forma. Sustituye las rutas y el booleano por los valores comprobados.

```js
subagent({
	workflow: "/ruta/absoluta/ox-code-review/scripts/review.workflow.js",
	cwd: "/raiz/del/repositorio",
	args: {
		repo: "/raiz/del/repositorio",
		packet: "/ruta/del/paquete",
		skillDir: "/ruta/absoluta/ox-code-review",
		hasSpec: true
	},
	async: true,
	options: { agentScope: "user", mission: false, share: false }
});
```

El workflow asigna Standards, Spec y Correctitud al mismo perfil con encargos distintos. Con `hasSpec: false`, registra Spec como omitido. Cada hijo devuelve su informe y el motor lo guarda. Consume las referencias reales devueltas, no una ruta deducida del nombre solicitado. Conserva los informes fuera del árbol de código.

Mientras los revisores trabajan, conserva el checkout. En una sesión interactiva, cede el turno y espera la notificación nativa. Inspecciona un estado concreto para resolver una incidencia, no para hacer sondeo continuo. Un timeout, cancelación o fallo de infraestructura deja la revisión incompleta. Registra el error y el estado real antes de decidir un reintento por el mismo motor.

## 4. Validar y entregar los resultados

1. Ejecuta `python3 "$SKILL_DIR/scripts/review_packet.py" verify "$PACKET"` antes de aceptar los informes. Si cambian el checkout, el índice, la rama, `HEAD`, la base o el diff capturado, invalida la revisión. Captura de nuevo el estado que deba revisarse. El helper excluye solo los metadatos sin seguimiento de `.pi/subagents/` para que la ejecución no se invalide a sí misma.
2. Comprueba el estado de ejecución de cada hijo y lee todos los informes finales. Un workflow completado prueba ejecución, no ausencia de problemas. Un archivo vacío, informe truncado o cobertura insuficiente no cuenta como revisión completa.
3. Valida cada hallazgo contra el diff y las fuentes. Confirma la ubicación, la consecuencia y su relación con el cambio. Descarta falsos positivos con el motivo. Agrupa duplicados sin ocultar a qué ejes pertenecen y resuelve contradicciones mediante evidencia. Pregunta al usuario cuando falte una decisión de producto o alcance.
4. Entrega un resumen por eje con el estado real, los hallazgos confirmados y las comprobaciones pendientes. Distingue `Completa sin hallazgos`, `Completa con hallazgos`, `Omitida`, `Parcial`, `Bloqueada`, `Fallida` y `Cancelada`. Una omisión o revisión parcial no equivale a un resultado limpio.
5. Propón las correcciones necesarias y separa las mejoras opcionales. La invocación de revisión por sí sola no autoriza editar. En `ox-spec-impl`, encarga las correcciones a `ox-worker` según [el procedimiento de delegación](../ox-spec-impl/delegation.md). Comprueba su entrega y la evidencia TDD antes de guardar los commits del bloque. El principal conserva la coordinación y la aceptación. Repite la revisión de los ejes afectados sobre un paquete nuevo e identifica la evidencia aún vigente de los demás. Cambios posteriores que alteren contratos compartidos invalidan también esos ejes.

Para cerrar `ox-spec-impl`, Standards, Spec y Correctitud necesitan cobertura completa. Los hallazgos confirmados que incumplan requisitos o garantías deben estar resueltos. Una sugerencia menor justificada puede quedar pendiente con su motivo. Un impedimento mantiene pendiente la aceptación. El principal conserva la decisión de cierre y el merge sigue necesitando autorización explícita.
