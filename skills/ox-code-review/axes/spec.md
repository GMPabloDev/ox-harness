# Revisar requisitos

Comprueba si el cambio satisface los requisitos aprobados incluidos en `context.md`. La fuente puede ser una SPEC, instrucciones explícitas o issues vinculados. Esa fuente define el contrato, no las conclusiones previas de quien implementó.

1. Lee completos los requisitos incluidos y los contratos que necesiten para interpretarse. Aplica solo los acuerdos vigentes de los fundamentos del proyecto.
2. Relaciona cada criterio exigible con el código y la evidencia de validación disponible. Examina también errores, casos límite y compatibilidad cuando formen parte del contrato.
3. Comprueba que el resultado observable satisfaga el requisito. Una tarea marcada, un nombre de prueba o un commit no demuestran cumplimiento por sí solos.
4. Identifica requisitos ausentes, comportamientos contradictorios y ampliaciones de alcance no acordadas. Distingue una ampliación de los detalles internos necesarios para cumplir el contrato.

Incluye una matriz breve con el identificador o cita del requisito, la evidencia, el resultado y lo pendiente. Conserva los identificadores `CA-NN` cuando existan. Usa `Satisfecho por la evidencia disponible`, `Incumplido` o `No verificable` según corresponda. La lectura de una prueba no demuestra su ejecución.

Para una revisión por bloques, exige solo los criterios del bloque y las garantías ya implementadas que el cambio pueda romper. Los bloques futuros quedan fuera del cumplimiento exigible. Una aceptación final requiere cubrir todos los criterios, no solo el último bloque.

Si una contradicción cambia el requisito esperado, devuelve el impedimento para que el principal lo resuelva con el usuario. Si un criterio importante no puede comprobarse, indica la evidencia que falta y devuelve cobertura parcial. No sustituyas la fuente aprobada por una interpretación propia.
