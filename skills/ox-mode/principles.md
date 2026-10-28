# Seleccionar principios por la decisión

Este archivo conecta los procedimientos con los principios originales. El momento del trabajo orienta la búsqueda. Un hecho concreto activa la lectura. Las filas no son paquetes obligatorios por fase.

## Seleccionar antes de actuar

1. Identifica la decisión pendiente, el resultado que vas a comprobar o el riesgo observado. Usa el índice para elegir los principios pertinentes. Si no hay un activador, continúa sin cargar principios por costumbre.
2. Lee completo cada original seleccionado antes de aplicarlo. Resuelve sus rutas desde este archivo, no desde el repositorio de producto. Reutiliza una lectura que siga completa en el contexto actual. Después de una pérdida de contexto, vuelve a leer lo necesario, no todo el catálogo.
3. Reconsidera la selección si aparece otro riesgo o cambia la decisión. No la repitas por cada herramienta, archivo o subtarea. Explica la selección solo cuando ayude a entender el trabajo o a preparar su revisión.

El índice es una ayuda para llegar al original, no un resumen que lo sustituya. Una selección del principal tampoco limita los principios que un revisor pueda considerar pertinentes por su propia inspección.

## Conservar el flujo y el alcance

Las instrucciones aplicables, los contratos aprobados y el procedimiento de la fase delimitan cómo aplicar los principios. Leer un principio no concede herramientas ni autoriza trabajo adicional.

- Conserva los bloques aprobados y sus límites de verificación. Sequence Verifiable Units no autoriza rebase, reescritura de historial ni controles por archivo. Su secuencia canónica de test y arreglo no impone TDD a features. Las migraciones conservan las roturas temporales planificadas y la aceptación final exigidas por el flujo vigente.
- Limita la simplificación al alcance autorizado. Comprueba consumidores y garantías antes de retirar código. Si todavía hay consumidores internos, coordina su migración. Conserva la compatibilidad externa exigida y las validaciones que protejan entradas, seguridad o estados legítimos.
- Usa los principios de diseño para decidir dentro del alcance. Una ampliación de requisitos, una reescritura independiente o un experimento no autorizado requieren consulta. No conviertas una fase documental en implementación.
- Conserva un único escritor por carpeta. Si ya están autorizados intentos de implementación independientes en paralelo, cada uno necesita su rama y worktree, sin locks para compartir ese checkout. Comprueba también otros recursos mutables, como datos y archivos fuera del worktree. Si un objeto debe ser único por contrato, conserva su exclusión estructural.
- El principal ejecuta comandos, escribe pruebas y corrige. El revisor solo lee y contrasta la evidencia. Ningún principio cambia esas atribuciones ni permite cambiar modelos o permisos.

Si otra cláusula contradice el flujo o requiere cambiar un acuerdo, señala la contradicción y consulta antes de actuar. No reescribas el principio ni cambies el procedimiento por tu cuenta.

## Índice de activadores

| Hecho que activa la lectura | Momento habitual | Original |
| --- | --- | --- |
| Hay que comparar alcance, recorridos de usuario o ergonomía de un contrato. | Fundamentos, SPEC, prototipo o diseño. | [Experience First](../ox-principle-experience-first/SKILL.md) |
| Hay que elegir estructuras centrales, tipos compartidos, estado concurrente u orden de preparación técnica. | Fundamentos, SPEC o implementación. | [Foundational Thinking](../ox-principle-foundational-thinking/SKILL.md) |
| Un requisito nuevo cuestiona responsabilidades o invariantes del diseño existente. | SPEC o implementación. | [Redesign from First Principles](../ox-principle-redesign-from-first-principles/SKILL.md) |
| Una adición o refactor parte de código muerto o complejidad redundante identificados. | Plan o implementación. | [Subtract Before You Add](../ox-principle-subtract-before-you-add/SKILL.md) |
| Una decisión nueva de interacción o arquitectura, sin precedente suficiente, necesita comparar alternativas. | Prototipo autorizado. | [Exhaust the Design Space](../ox-principle-exhaust-the-design-space/SKILL.md) |
| Hay un refactor o una elección sobre abstracciones, capas, parámetros o tamaño del cambio. | Diseño, implementación o revisión. | [Laziness Protocol](../ox-principle-laziness-protocol/SKILL.md) |
| El trabajo no trivial justifica una herramienta para realizarlo o comprobarlo. | Preparación o implementación. | [Build the Lever](../ox-principle-build-the-lever/SKILL.md) |
| Un síntoma o fallo necesita reproducción y diagnóstico. | Corrección o revisión de arreglos. | [Fix Root Causes](../ox-principle-fix-root-causes/SKILL.md) |
| Una instrucción o corrección se repite y conviene proponer una protección estructural. | Corrección o aprendizaje. | [Encode Lessons in Structure](../ox-principle-encode-lessons-in-structure/SKILL.md) |
| Hay estados o ramificaciones repetidas que deben representar reglas del dominio. | SPEC, diseño o implementación. | [Model the Domain](../ox-principle-model-the-domain/SKILL.md) |
| Hay que diseñar tipos o firmas en un lenguaje estático. | Implementación de contratos. | [Type System Discipline](../ox-principle-type-system-discipline/SKILL.md) |
| Se conecta validación o un adaptador de framework con la lógica interna. | Diseño o implementación de una frontera. | [Boundary Discipline](../ox-principle-boundary-discipline/SKILL.md) |
| Una nueva API interna sustituye otra que aún tiene consumidores. | Plan de migración o implementación. | [Migrate Callers Then Delete Legacy APIs](../ox-principle-migrate-callers-then-delete-legacy-apis/SKILL.md) |
| Una reescritura o migración tiene fases explícitas y un resultado final acordado. | Plan o ejecución de la migración. | [Outcome-Oriented Execution](../ox-principle-outcome-oriented-execution/SKILL.md) |
| Hay trabajo de varios pasos que necesita unidades y entregas verificables. | Plan, ejecución o preparación de commits. | [Sequence Verifiable Units](../ox-principle-sequence-verifiable-units/SKILL.md) |
| Una operación puede repetirse por reintento, reanudación o fallo parcial. | Diseño o implementación de operaciones. | [Make Operations Idempotent](../ox-principle-make-operations-idempotent/SKILL.md) |
| Actores concurrentes podrían escribir el mismo archivo, rama, clave u objeto de estado. | Diseño o preparación de ejecución concurrente. | [Separate Before Serializing Shared State](../ox-principle-separate-before-serializing-shared-state/SKILL.md) |
| Se escribe, cambia o evalúa una prueba. | Verificación o revisión. | [Test Behavior, Not Implementation](../ox-principle-test-behavior-not-implementation/SKILL.md) |
| Se va a declarar terminado un resultado. | Verificación de bloque, aceptación o revisión de evidencia. | [Prove It Works](../ox-principle-prove-it-works/SKILL.md) |

Por ejemplo, antes de añadir un cuarto adaptador sobre otros obsoletos, lee Subtract y comprueba su retirada. Si todavía tienen consumidores, considera también Migrate Callers. Si una importación solo ha pasado el build, lee Prove It Works, ejecuta su recorrido en un entorno permitido y lee los registros escritos. Ante dos intentos autorizados que compartirían rama y carpeta, lee Separate antes de lanzarlos y separa sus destinos.

## Revisión con contexto nuevo

En cada pasada fresh, incluida la comprobación de arreglos, el principal incluye en el encargo:

- La ruta absoluta de este selector y la instrucción de leerlo antes de seleccionar principios.
- La ruta absoluta de cada original pertinente y el hecho concreto que activa su lectura. Vincula el criterio o contrato aprobado cuando corresponda. No envíes todos los originales ni una lista histórica de todo lo leído.
- La SPEC, las instrucciones aplicables, la versión estable, el diff, los archivos nuevos y la evidencia de ejecución que exige la guía de revisión. Incluye comandos, resultados observados y límites, no solo conclusiones del implementador.

Pide al revisor que lea completos los originales pertinentes y que añada otros si el diff o los contratos activan su lectura. No presentes la selección como una lista cerrada ni como una conclusión que deba confirmar. En una revisión de arreglos, recalcula la selección para los hallazgos y recorridos afectados, sin repetir la revisión completa por costumbre.

El revisor evalúa el cambio y la evidencia dentro de su autoridad de solo lectura. Puede pedir al principal una comprobación necesaria, pero no ejecutarla ni atribuirse su resultado. Registra los principios considerados en la cobertura cuando afecten a la conclusión. Si falta un original necesario, declara qué parte no pudo evaluar.

Un principio no crea un requisito de producto ni convierte una preferencia en bug. Mantén el contrato de hallazgos de la guía de revisión: evidencia concreta, separación entre fallos, hipótesis y mejoras opcionales, y ninguna autorización para integrar.
