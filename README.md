# Galletas de Amistad — Proyecto 01

## Descripción

**Galletas de Amistad** es un prototipo de minijuego web de realidad aumentada activado por un marcador de imagen. La experiencia utiliza MindAR para reconocer el marcador y A-Frame para mostrar elementos 3D en el navegador. La interfaz principal y las fases del juego aparecen cuando se detecta el marcador; si deja de reconocerse, la experiencia se pausa visualmente hasta recuperarlo.

## Mecánica de juego

### Menú

El menú ofrece las opciones **Iniciar aventura** e **Instrucciones**. Se muestra después de reconocer el marcador.

### Fase 1 — Caza de galletas

- La fase dura 12 segundos.
- Las galletas aparecen en posiciones aleatorias de la pantalla y desaparecen rápidamente.
- El jugador toca las galletas para recogerlas.
- La cantidad obtenida se utiliza en la siguiente fase.

### Fase 2 — Hora del picoteo

- Bulbasaur se mueve ligeramente delante del marcador.
- El jugador toca al personaje, dentro del área de puntería, para lanzar una galleta.
- Cada lanzamiento consume una galleta y cada impacto aumenta la barra de amistad.
- El objetivo es conseguir cuatro impactos antes de quedarse sin galletas o tiempo.
- Al ganar aparece una Pokébola y se activa la señal de amistad lograda. Si no se completa el objetivo, se muestra la derrota.

## Tecnologías

- **HTML, CSS y JavaScript** para estructura, interfaz y lógica del juego.
- **MindAR** para seguimiento de imagen/marcador en el navegador.
- **A-Frame** para la escena y los elementos 3D.

## Archivos y recursos

- `index.html`: estructura de la aplicación.
- `styles.css`: presentación adaptable a pantallas móviles.
- `app.js`: seguimiento, fases, controles, contador, temporizador y retroalimentación.
- `assets/`: carpetas de modelos y audio.

El código incluye figuras 3D de respaldo si faltan algunos modelos y tonos sintetizados si no encuentra audios. 

## Controles

- **Menú:** iniciar aventura o consultar instrucciones.
- **Fase 1:** toca las galletas que aparecen antes de que desaparezcan.
- **Fase 2:** toca a Bulbasaur dentro del anillo de puntería para lanzar una galleta.
- **Final:** sigue la opción de reinicio que presenta el juego.


## Limitaciones conocidas

El seguimiento depende de la calidad, tamaño, contraste e iluminación del marcador.
