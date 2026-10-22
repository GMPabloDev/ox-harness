# Revisar correctitud

Busca bugs y regresiones introducidos o agravados por el cambio, aunque los requisitos no los mencionen. Prioriza consecuencias observables sobre preferencias de diseño.

1. Sigue los caminos modificados y sus llamadores relevantes. Contrasta entradas, salidas, invariantes y comportamiento anterior con el diff capturado.
2. Examina los riesgos que correspondan al cambio. Incluye límites, valores ausentes, errores, recursos, estado compartido, concurrencia, persistencia y compatibilidad cuando resulten aplicables.
3. Si el cambio trata entradas no confiables, credenciales, permisos o datos sensibles, examina las garantías de seguridad afectadas. Ante un posible secreto, identifica la ubicación sin copiar su valor.
4. Comprueba si las pruebas detectan los fallos relevantes y si la evidencia aportada corresponde a la versión revisada. Cuando evalúes pruebas nuevas o modificadas, lee las [reglas de diseño de pruebas](../../ox-tdd-feature/test-design.md). Úsalas para revisar, no para implementar ni ejecutar comandos.
5. Sustenta cada hallazgo con la ruta, las condiciones que lo activan y su consecuencia. Si requiere ejecución para confirmarlo, indica esa limitación y la comprobación necesaria.

Separa un bug demostrado por lectura de un riesgo pendiente de confirmar. Una posibilidad genérica, la ausencia de una prueba sin un caso relevante o un problema previo no agravado no justifican por sí solos un hallazgo del cambio.

La revisión termina cuando puedes explicar los caminos y riesgos examinados y los límites de esa cobertura. Si un camino relevante queda inaccesible o no puede razonarse con la evidencia disponible, devuelve una revisión parcial.
