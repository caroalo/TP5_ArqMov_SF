# San Francisco Digital (TP5, Arquitecturas Móviles No Nativas)

PWA que centraliza servicios municipales de San Francisco (Córdoba): bicicletas públicas, tributos, reclamos, atención al vecino, alarmas comunitarias, estacionamiento medido y notificaciones.

## Ejecutar
```
python3 -m http.server 8000      # o cualquier servidor estático
# abrir http://localhost:8000 (en el celular: misma red, o desplegar en Netlify/GitHub Pages)
node --test tests/               # pruebas unitarias (Node 18+)
```
Requiere HTTPS (o localhost) para service worker, geolocalización y notificaciones.

## Arquitectura y justificación
**Estrategia no nativa elegida: PWA (Progressive Web App) con JavaScript estándar (ES Modules), sin framework ni paso de build.**

| Criterio | PWA | Ionic/Capacitor | React Native |
|---|---|---|---|
| Distribución | URL, instalable desde el navegador | Tienda o URL | Principalmente tiendas |
| Un solo código para iOS, Android y web | Sí | Sí | Sí (web con extras) |
| Costo de actualización | Inmediato, sin revisión de tienda | Medio | Medio |
| Acceso a APIs del dispositivo | GPS, cámara, notificaciones, compartir | Mayor (plugins) | Mayor |
| Complejidad de entorno | Mínima | Media | Alta |

Se eligió PWA porque el servicio es para toda la ciudadanía: debe abrirse con un link, sin instalar nada, y las funciones requeridas (mapa, GPS, cámara/archivos, notificaciones, offline) están cubiertas por APIs web. Sin build y con Leaflet local, la app carga en pocos cientos de KB (RNF de rendimiento < 3 s).

Capas:
- **Presentación** (`js/views/*`, `css/`): una vista por servicio, router por hash, diseño mobile-first, modo oscuro, objetivos táctiles de 44 px.
- **Dominio** (`js/logic.js`): reglas puras (costos, recargos, validaciones, distancias), testeadas.
- **Servicios** (`js/api.js`): API mock asincrónica con latencia y persistencia en `localStorage`. Cada función equivale a un endpoint; migrar a un backend real implica reemplazar su cuerpo por `fetch()`.
- **Infraestructura PWA** (`sw.js`, `manifest.webmanifest`): app shell offline, caché de teselas de mapa, notificaciones y listener `push` preparado.

## Cumplimiento funcional
| Servicio | Implementado |
|---|---|
| Bicicletas | Mapa Leaflet/OpenStreetMap, disponibilidad de bicis y anclajes que se actualiza cada 6 s (simulado), búsqueda por cercanía con geolocalización, reporte de problemas |
| Tributos | Consulta por DNI/CUIT/partida, emisión de cedulón imprimible con código de barras, pago online con pasarela simulada (validación Luhn, vencimiento, CVV), historial, estado de deuda con recargo por mora, recordatorios de vencimiento |
| Reclamos | Formulario con categoría, dirección, ubicación GPS, fotos (se comprimen) y documentos; seguimiento por etapas con notificación de cada cambio; búsqueda y filtro por estado |
| Atención al vecino | Directorio con búsqueda y filtro, llamar (`tel:`), email (`mailto:`), WhatsApp (`wa.me`) y compartir |
| Alarmas | Mapa con estado activada/desactivada en tiempo real, suscripción a zonas, notificación si se activa una alarma suscripta o a menos de 1 km |
| Estacionamiento | Mapa de zonas con tarifas y horarios, detección de zona por GPS, pago online, temporizador con aviso configurable, extensión de tiempo, historial |
| Notificaciones | Historial con enlaces, tipos, frecuencia (inmediata o resumen), zonas de interés, notificaciones del dispositivo vía service worker |

Extras: instalable, modo offline, modo oscuro, accesibilidad básica (roles ARIA, foco visible, `prefers-reduced-motion`), botones de demo para simular alarmas y alertas.

## Requisitos no funcionales
- **Compatibilidad**: APIs estándar con degradación (sin geolocalización, notificaciones o `share`, la app sigue operando).
- **Rendimiento**: sin framework ni build, caché con stale-while-revalidate, teselas cacheadas.
- **Seguridad y privacidad**: se escapa todo texto de usuario antes de renderizar (anti-XSS), la tarjeta nunca se persiste (solo últimos 4 dígitos), la ubicación se usa solo con permiso y no sale del dispositivo. En producción: HTTPS, pasarela certificada PCI (el formulario sería un campo alojado por el proveedor), autenticación (OAuth/Mi Argentina) y adecuación a la Ley 25.326 de protección de datos personales.
- **Escalabilidad**: módulos independientes por servicio; agregar uno implica una vista y una entrada en el router y en la capa de API.

## Pruebas
- **Unitarias** (`tests/logic.test.mjs`, 12 casos, todos aprobados): distancias, costo de estacionamiento, horarios regulados, recargos, Luhn, vencimiento, patentes, etapas de reclamo.
- **Extremo a extremo** (Playwright, móvil 390x780): recorrido por los 7 servicios (reportar problema, consultar y pagar tributo, emitir cedulón, crear reclamo, filtrar contactos, suscribirse y simular alarma, pagar y extender estacionamiento, preferencias de notificación) sin errores de consola y con service worker registrado.
- Casos manuales sugeridos: tarjeta 4000 0000 0000 0002 (pago rechazado), modo avión (offline), instalación en Android/iOS.

## Problemas encontrados y soluciones
- **APIs municipales no disponibles**: capa mock con latencia y persistencia, con la misma interfaz que tendría un backend.
- **Tiempo real sin servidor**: simulación por temporizadores y bus de eventos; en producción sería WebSocket/SSE.
- **Push real**: requiere backend con claves VAPID; se implementaron notificaciones locales vía service worker y el listener `push` queda listo.
- **Almacenamiento limitado de fotos**: compresión por canvas a 720 px; un backend real las subiría como archivos.
- **iOS**: las notificaciones web solo funcionan con la PWA instalada en pantalla de inicio.
- **Etapas de reclamos aceleradas** (segundos) para poder demostrarlas en clase.

## Limitaciones
Datos, teléfonos locales, pasarela y API son simulados. Sin autenticación de usuarios real.
