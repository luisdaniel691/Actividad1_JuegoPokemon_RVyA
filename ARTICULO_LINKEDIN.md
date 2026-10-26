# Galletas de Amistad: un minijuego web de realidad aumentada

En este proyecto desarrollé **Galletas de Amistad**, un prototipo de videojuego móvil que utiliza realidad aumentada basada en marcador para convertir la cámara del teléfono en el punto de entrada a una pequeña aventura interactiva.

La experiencia está dividida en dos fases. En la primera, el jugador dispone de 12 segundos para recoger tantas galletas como pueda antes de que desaparezcan. En la segunda, utiliza las galletas reunidas para lanzarlas a Bulbasaur y aumentar una barra de amistad. Cada lanzamiento consume un recurso, por lo que es necesario apuntar y administrar lo recogido. El objetivo es lograr cuatro impactos antes de quedarse sin galletas o tiempo. La victoria muestra una Pokébola como recompensa visual; si no se completa el objetivo, aparece la pantalla de derrota.

Para construir el prototipo utilicé **HTML, CSS y JavaScript**, junto con **MindAR** para el seguimiento del marcador y **A-Frame** para la escena 3D en el navegador. También incorporé una interfaz táctil con menú, instrucciones, temporizador, contador, barra de progreso y retroalimentación durante las acciones. La lógica oculta la experiencia cuando pierde el marcador y permite retomarla cuando vuelve a detectarse.

Uno de los retos fue coordinar el seguimiento de realidad aumentada con dos fases que tienen reglas distintas, manteniendo controles que puedan utilizarse desde una pantalla pequeña. También fue importante contemplar rutas de recursos alternativos para poder comprobar las mecánicas durante el desarrollo. Antes de la entrega final, los modelos y sonidos externos deben incluirse en las rutas correspondientes y documentarse con sus atribuciones y licencias reales.

Este proyecto me permitió practicar cómo una mecánica sencilla puede organizarse en objetivos, recursos, tiempo y retroalimentación dentro de una experiencia web móvil. Como siguientes pasos, quiero probar el marcador bajo diferentes condiciones de iluminación, verificar los modelos 3D en varios teléfonos y recoger observaciones para ajustar el ritmo de las fases.

 **Video de demostración:** []

 **Repositorio del proyecto:** [https://github.com/luisdaniel691/Actividad1_JuegoPokemon_RVyA.git]

#RealidadAumentada #MindAR #AFrame #JavaScript #DesarrolloDeVideojuegos #WebAR
