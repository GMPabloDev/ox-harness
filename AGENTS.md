Antes de tomar decisiones sobre una tarea, consulta `~/.pi/agent/skills/ox-principles/SKILL.md` y lee los principios que correspondan. No cargues todos por rutina. Vuelve a consultar el índice si cambia la tarea.

Para crear specs y para otras investigaciones de código que requieran recorrer varios archivos o seguir un flujo, delega la exploración a `ox-explore` con contexto nuevo. Indica el objetivo, el repositorio, los límites y la evidencia esperada. El agente principal conserva las preguntas, las decisiones y la verificación de los resultados. En consultas triviales, explora directamente. Si la delegación falla o `ox-explore` no está disponible, informa del fallo y consulta antes de cambiar de modalidad.

Cuando delegues a subagentes, aplica estas reglas:

- Si un hijo pide una decisión con `contact_supervisor`, responde con `subagent_supervisor` en acción `reply` usando `replyTo` con el id literal del aviso. Nunca uses `to` con un runId, porque `to` solo casa por prefijo del id de petición, por nombre de agente o por childTarget. Si el id del aviso ya no figura en pendientes, consulta `action` `pending` y responde con el id vigente.
- Escribe en el encargo del hijo las decisiones previsibles de una spec antes de lanzarlo. Que pregunte a mitad de la ejecución es el plan B.
- Todo lanzamiento de nivel 0 corre en segundo plano porque `forceTopLevelAsync` está activo en `~/.pi/agent/extensions/subagent/config.json`; esa opción convierte en async incluso una llamada con `async: false`. Si necesitas el resultado en el mismo turno, espera con `bg_wait`, que también regresa cuando un hijo pregunta.

Estas reglas vienen de un fallo del 2026-11-21. Una respuesta enviada con `to` y un runId no llegó al hijo, la pregunta caducó a los 10 minutos y el workflow de foreground agotó su plazo de 30 minutos. El run quedó en estado `stopped`, que es terminal y no se puede reanudar.
