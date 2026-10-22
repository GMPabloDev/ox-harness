# Temas para decidir los fundamentos

Esta referencia relaciona señales del proyecto con decisiones que pueden condicionar el inicio. No es un cuestionario obligatorio ni un catálogo de tecnologías recomendadas. Un tema puede estar resuelto, no aplicar o quedar diferido.

## Producto y restricciones

El público y su tarea principal permiten comparar soluciones. Una lista de tecnologías no define el resultado de la primera versión.

| Señal o incertidumbre | Información que cambia la decisión |
| --- | --- |
| La idea describe funcionalidades, pero no un problema | Quién las necesita, qué hace hoy y qué resultado espera obtener. |
| Hay varias plataformas posibles | Dónde se realiza la tarea, dispositivos, distribución, acceso al sistema y necesidad de funcionar sin conexión. |
| El plan tiene muchos objetivos | Recorrido principal de la primera versión, resultado observable y capacidades excluidas por ahora. |
| No hay límites operativos conocidos | Presupuesto recurrente, plazo, tamaño del equipo, experiencia, preferencias y capacidad de mantenimiento. |
| Se espera crecimiento sin datos que lo respalden | Demanda conocida, compromisos reales y restricciones que ya existen. Las previsiones desconocidas siguen siendo desconocidas. |

## Distribución, arquitectura y carpetas

Estas decisiones pertenecen a niveles diferentes y pueden combinarse:

- La distribución define procesos desplegables y comunicación entre ellos. Un monolito y unos servicios independientes difieren en operación y coordinación.
- La organización interna define módulos, capas y dirección de dependencias. Un monolito puede tener límites hexagonales.
- El modelado del dominio define cómo se representan las reglas del negocio. Algunas técnicas de DDD pueden ser útiles sin adoptar todo su vocabulario o estructura.

La comparación depende de los despliegues independientes necesarios, los límites del negocio, la coordinación del equipo y la complejidad operativa asumible. Los nombres de patrones no sustituyen esas restricciones.

Un árbol de carpetas útil muestra las partes iniciales, las responsabilidades y las importaciones permitidas. Las convenciones del framework forman parte de la comparación. Las carpetas vacías para futuras capacidades y las abstracciones sin una necesidad actual no aportan una base verificable.

## Aplicación, interfaces y compatibilidad

| Señal | Decisiones que pueden importar ahora |
| --- | --- |
| Web con contenido público | SEO, accesibilidad, generación de contenido y renderizado. SSR, prerenderizado y renderizado en cliente pueden corresponder a partes distintas. |
| API consumida por terceros o clientes desplegados por separado | Consumidores, contratos, documentación, compatibilidad y política de versionado. El prefijo `/api/v1` no resuelve por sí solo esa política. |
| Aplicación móvil o de escritorio | Distribución, actualizaciones, almacenamiento local, permisos y sincronización si aplica. |
| CLI o TUI | Entrada y salida, uso interactivo o automatizado, terminales relevantes, errores y acceso a archivos locales. |
| Datos de varios usuarios, organizaciones o empresas | Identidad, permisos y aislamiento. Autenticación y autorización son decisiones distintas. |

## Datos, servicios e integraciones

| Señal | Duda previa a comparar herramientas |
| --- | --- |
| Persistencia de datos | Consultas y relaciones conocidas, integridad, transacciones y operación. La elección de SQL o NoSQL y la del ORM son decisiones diferentes. |
| Docker y una base de datos gestionada | Entorno local y producción. Una base local en un contenedor puede coexistir con otra gestionada en producción. Importan las diferencias de motor y de funciones utilizadas. |
| Productos u otro contenido visual | Origen de las imágenes, quién las aporta, subidas, tamaños y entrega. El contenido preparado puede evitar un servicio de subidas en la primera versión. |
| Pagos o importes | Monedas, exactitud y reglas de redondeo que condicionen la integridad. Los cálculos de una feature se concretan en su SPEC. Un paquete propio necesita una razón frente a una biblioteca o representación existente. |
| Fechas, reservas o tareas programadas | Instantes, fechas de calendario, zonas horarias y recurrencia. Guardar todo en UTC no representa cualquier problema de calendario. |
| Correos y notificaciones | Mensajes necesarios, entrega síncrona o diferida, fallos y datos enviados. El proveedor y la biblioteca cliente no son la misma elección. |
| Trabajo en segundo plano | Duración, reintentos, duplicados y despliegue. La aparición de una tarea periódica no obliga a introducir una cola. |

Los nombres de proveedores y paquetes se comparan cuando se conoce la capacidad necesaria. Una preferencia del usuario puede limitar esa comparación. La popularidad no prueba que una opción cumpla el presupuesto, la región o los requisitos.

## Seguridad y operación

Los riesgos dependen de los datos y del entorno. Los temas que pueden exigir una decisión temprana incluyen:

- Los límites de confianza, los permisos y los datos sensibles o regulados.
- La gestión de secretos y la separación entre configuración pública y privada.
- Los datos que no se pueden perder, su copia y el procedimiento para recuperarlos.
- Las migraciones, la conservación de datos existentes y la recuperación ante fallos.
- El entorno de despliegue, los registros permitidos y el diagnóstico de errores.
- Las restricciones de región, licencias o proveedores que condicionen la solución.

La incertidumbre se registra con su impacto. Una elección técnica no demuestra cumplimiento legal ni garantiza que una copia se pueda restaurar. Los detalles necesarios solo antes de producción pueden diferirse con ese límite explícito.

## Convenciones y verificación

Las convenciones útiles tienen un efecto comprobable. Algunos ejemplos son la configuración estricta del lenguaje, los límites de importación o la validación de entradas externas. Las herramientas pueden aplicar formato, lint y tipos en lugar de repetir sus reglas en documentación.

DRY y SOLID no equivalen a crear una interfaz por función ni a extraer toda repetición. La preferencia por clases o funciones depende del lenguaje, del framework y de las responsabilidades. Una excepción razonada puede ser mejor que una prohibición absoluta.

La estrategia de pruebas distingue comportamientos, integraciones reales y recorridos completos. Un navegador sirve a una interfaz web, no a cualquier proyecto. La base de datos y los servicios usados en pruebas deben representar las garantías que se quieren comprobar. Los frameworks concretos se eligen según el stack y las pruebas necesarias.

`README.md`, `AGENTS.md` y `.env.example` pertenecen a la preparación ejecutable. Sus comandos y variables deben corresponder al proyecto creado. Los fundamentos pueden acordar esas convenciones, pero no presentar los archivos futuros como existentes.
