# Diseñar y verificar pruebas

Usa estas reglas al elegir o cambiar una interfaz de prueba, un nivel de prueba o un sustituto. Aplica también las condiciones de RED, las excepciones y el registro de evidencia durante la ejecución.

## Elegir la interfaz y el nivel

Prueba a través de una interfaz estable que permita observar el comportamiento, como una función exportada, una API de dominio, un endpoint, una CLI o un recorrido de usuario. Elige la comprobación más estrecha que demuestre el requisito sin simular el comportamiento que necesitas comprobar.

- Usa una prueba unitaria para una regla o un cálculo con un contrato estable.
- Usa una prueba de integración cuando el requisito dependa de módulos reales, persistencia, handlers o adaptadores. Prefiere una base de datos de prueba cuando importe la persistencia.
- Usa una prueba E2E cuando necesites demostrar un recorrido entre componentes que las pruebas más estrechas no cubren. Mantén esas pruebas deterministas.

Elige por comportamiento y riesgo, sin cuotas de pruebas ni una pirámide obligatoria. Inspecciona directamente una base de datos o un archivo cuando ese contrato sea el objeto de la prueba. Para comprobar otro comportamiento, usa su interfaz responsable.

## Definir una prueba que detecte el fallo

- Nombra el comportamiento con los términos del dominio, no con llamadas internas.
- Obtén los resultados esperados de una fuente independiente, como la especificación, un ejemplo resuelto o una invariante razonada por separado. Evita repetir el algoritmo de producción en la expectativa.
- Comprueba resultados y efectos observables. Un comportamiento puede necesitar varias aserciones relacionadas.
- Conserva las pruebas ante refactors que no cambien comportamiento. Evita métodos privados, orden interno de llamadas y snapshots de salida volátil.
- Mantén las expectativas acordes al contrato requerido. Para cambiar una expectativa existente, comprueba que el requisito haya cambiado y registra el motivo.

## Elegir colaboradores y recursos

Prefiere colaboradores reales que controles. Sustituye límites externos cuando haga falta por determinismo, coste o seguridad, como APIs externas, relojes, aleatoriedad u operaciones destructivas. Usa fakes o stubs pequeños con contratos realistas en lugar de cadenas de mocks internos. Justifica un sustituto interno cuando sea necesario para que la prueba sea útil.

Comprueba llamadas o sus cantidades solo cuando la interacción sea parte del contrato observable. Verifica los adaptadores con servicios de prueba o contratos conocidos cuando el riesgo lo requiera.

Resuelve las elecciones rutinarias con las convenciones del proyecto. Pregunta si el contrato público es ambiguo, la elección compromete la arquitectura o requiere recursos externos costosos o destructivos. Una prueba de integración no es por sí sola motivo para omitir una regresión.

## Preparar la ejecución y confirmar RED

Antes de modificar el comportamiento, ejecuta las pruebas existentes relevantes para identificar fallos previos. Acota esa comprobación al cambio. Si no puedes ejecutarlas, registra la limitación sin atribuirles un resultado.

Reutiliza el runner y las fixtures del proyecto. Un runner roto, una dependencia ausente o una fixture inválida no demuestran RED. Corrige la preparación y vuelve a ejecutar la prueba. La ausencia del contrato que la prueba intenta usar sí puede demostrar RED si la ejecución funciona y ese es el fallo esperado.

Si la primera ejecución pasa, comprueba si el comportamiento ya existe, si la prueba no lo distingue o si el escenario es incorrecto. Conserva el código correcto. Ajusta la prueba solo para representar el requisito pendiente, sin fabricar un fallo. Si la capacidad ya está satisfecha, verifica y registra ese hecho sin afirmar un ciclo TDD nuevo.

## Cuando RED no sea viable

Si una prueba significativa requiere preparación desproporcionada, estado inaccesible o sustitutos frágiles, busca una comprobación ejecutable viable. Puede ser un script de regresión, un comando de reproducción o una prueba de integración enfocada. Conserva la cobertura del requisito al reducir el coste.

Registra el motivo, lo que demuestra la alternativa y sus límites. Usa la indicación `TDD no verificado` si no observaste RED antes de implementar. Si el usuario, la SPEC o las reglas del repositorio exigen un ciclo TDD verificable, detente y pide resolver el impedimento antes de sustituir el método.

La alternativa no elimina los criterios de aceptación ni las comprobaciones obligatorias. Mantén pendiente cualquier criterio que no puedas demostrar y explica cómo verificarlo. Si ninguna alternativa demuestra el requisito, informa del bloqueo en lugar de darlo por validado.

## Conservar evidencia y reanudar

Anota en el registro de progreso existente la prueba y el comportamiento esperado, el comando ejecutado, el fallo RED observado y el comando y resultado GREEN. Distingue lo ejecutado de lo pendiente y resume los refactors y las comprobaciones adicionales. Registra solo resultados reales, sin copiar salidas extensas ni crear otro sistema de seguimiento.

Antes de una pausa, deja indicado el punto del ciclo y el siguiente paso. Al reanudar, contrasta las notas con el código y ejecuta las comprobaciones necesarias. Continúa desde el estado comprobado, sin deshacer trabajo correcto para recrear RED. Si ya existe la implementación pero falta evidencia histórica de RED, declara esa ausencia y verifica GREEN sin atribuir un ciclo TDD que no observaste.
