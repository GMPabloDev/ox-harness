# Parche local: error de `to` sin pendientes (pi-subagents 0.89.2)

Qué cambia:
- El error de `subagent_supervisor` con `to` pasa a listar las peticiones pendientes, igual que el error de `replyTo`.
- La descripción del tool y `docs/workflows.md` documentan que `to` casa por prefijo del id de petición, por nombre de agente o por childTarget, nunca por runId.

Motivo: fallo del 2026-11-21. Una respuesta enviada con `to:<runId>` nunca llegó al hijo, la pregunta caducó y el workflow de foreground agotó su plazo de 30 minutos.

Aplicado sobre: pi-subagents 0.89.2 en `~/.pi/agent/npm/node_modules/pi-subagents`.

Re-aplicar tras actualizar o reinstalar el paquete:

    cd ~/.pi/agent/npm/node_modules/pi-subagents && patch -p1 < ~/.pi/agent/patches/pi-subagents-0.89.2-supervisor-to.patch

Upstream: `github.com/nicobailon/pi-subagents` sigue sin listar pendientes en el error de `to` hasta 0.89.2. Este diff sirve de base para un PR.
