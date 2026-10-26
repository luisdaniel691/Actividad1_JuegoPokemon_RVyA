(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const scene = $('ar-scene');
  const targetRoot = $('target-root');
  const pokemonAnchor = $('pokemon-anchor');
  const pokemonFallback = $('pokemon-fallback');
  const pokemonModel = $('pokemon-model');
  const pokeballAnchor = $('pokeball-anchor');
  const pokeballFallback = $('pokeball-fallback');
  const pokeballModel = $('pokeball-model');
  const projectileLayer = $('projectile-layer');
  const uiLayer = $('ui-layer');
  const scanOverlay = $('scan-overlay');
  const cookiesLayer = $('cookies-layer');
  const aimRing = $('aim-ring');
  const tapHint = $('tap-hint');
  const toastEl = $('toast');

  const CFG = {
    huntSeconds: 12,
    feedSeconds: 22,
    friendshipNeeded: 4,
    cookieLifeMs: 1050,
    spawnMinMs: 420,
    spawnMaxMs: 760,
    aimRadiusPx: 82,
    projectileDurationMs: 510
  };

  const state = {
    markerVisible: false,
    mode: 'menu',             // menu, instructions, banner, hunt, feed, win, lose
    phase: 'menu',
    cookies: 0,
    collected: 0,
    friendship: 0,
    timeLeft: 0,
    bannerLeft: 2.5,
    lastTick: 0,
    spawnTimer: null,
    tickTimer: null,
    toastTimer: null,
    activeCookieEls: new Set(),
    activeProjectiles: new Set(),
    modelPaths: {},
    modelLoaded: { bulbasaur: false, pokeball: false },
    audioPaths: {},
    audioObjects: {},
    audioContext: null,
    lastPointerAt: 0,
    arStarted: false,
    markerUrl: null
  };

  const MARKER_CANDIDATES = [
    './assets/marker.mind', './assets/marcador.mind',
    './marker.mind', './marcador.mind',
    './assets/targets.mind', './targets.mind'
  ];
  const MODEL_CANDIDATES = {
    bulbasaur: ['./Bulbasaur.glb', './assets/models/Bulbasaur.glb', './models/Bulbasaur.glb', './assets/Bulbasaur.glb'],
    cookie: ['./Cookie.glb', './assets/models/Cookie.glb', './models/Cookie.glb', './assets/Cookie.glb'],
    pokeball: ['./pokeball.glb', './assets/models/pokeball.glb', './models/pokeball.glb', './assets/pokeball.glb']
  };
  const AUDIO_CANDIDATES = {
    bulbasaur: ['./sonidoBulbasaur.mp3', './assets/audio/sonidoBulbasaur.mp3', './audio/sonidoBulbasaur.mp3'],
    eating: ['./comiendo.mp3', './assets/audio/comiendo.mp3', './audio/comiendo.mp3'],
    friendship: ['./amistadLograda.mp3', './assets/audio/amistadLograda.mp3', './audio/amistadLograda.mp3']
  };

  function setScreen(name) {
    state.mode = name;
    document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
    const target = ({menu:'screen-menu', instructions:'screen-instructions', banner:'screen-banner', hunt:'screen-game', feed:'screen-game', win:'screen-end', lose:'screen-end'})[name];
    if (target) $(target).classList.add('active');
    uiLayer.style.display = state.markerVisible ? 'block' : 'none';
    scanOverlay.style.display = state.markerVisible ? 'none' : 'flex';
    if (name === 'hunt' || name === 'feed') {
      $('friendship-wrap').hidden = name !== 'feed';
      $('progress-pill').hidden = name !== 'feed';
      aimRing.hidden = name !== 'feed';
      tapHint.hidden = name !== 'feed';
    } else {
      aimRing.hidden = true;
      tapHint.hidden = true;
    }
  }

  function showScan(title, copy, foot) {
    $('scan-title').textContent = title;
    $('scan-copy').textContent = copy;
    $('scan-foot').textContent = foot || 'RA · SEGUIMIENTO DE IMAGEN';
    scanOverlay.style.display = state.markerVisible ? 'none' : 'flex';
  }

  async function fileExists(path) {
    try {
      const response = await fetch(path, { method: 'HEAD', cache: 'no-store' });
      return response.ok;
    } catch (_) {
      return false;
    }
  }

  async function findFirst(paths) {
    for (const path of paths) if (await fileExists(path)) return path;
    return null;
  }

  async function findAssets() {
    const markerPath = await findFirst(MARKER_CANDIDATES);
    state.markerUrl = markerPath;
    for (const [key, candidates] of Object.entries(MODEL_CANDIDATES)) state.modelPaths[key] = await findFirst(candidates);
    for (const [key, candidates] of Object.entries(AUDIO_CANDIDATES)) state.audioPaths[key] = await findFirst(candidates);
  }

  function setupOptionalModels() {
    if (state.modelPaths.bulbasaur) {
      pokemonModel.setAttribute('src', state.modelPaths.bulbasaur);
      pokemonModel.addEventListener('model-loaded', () => {
        state.modelLoaded.bulbasaur = true;
        pokemonFallback.setAttribute('visible', false);
        pokemonModel.setAttribute('visible', true);
      }, { once: true });
      pokemonModel.addEventListener('model-error', () => {
        pokemonFallback.setAttribute('visible', true);
        pokemonModel.setAttribute('visible', false);
      }, { once: true });
    }
    if (state.modelPaths.pokeball) {
      pokeballModel.setAttribute('src', state.modelPaths.pokeball);
      pokeballModel.addEventListener('model-loaded', () => {
        state.modelLoaded.pokeball = true;
        pokeballFallback.setAttribute('visible', false);
        pokeballModel.setAttribute('visible', true);
      }, { once: true });
      pokeballModel.addEventListener('model-error', () => {
        pokeballFallback.setAttribute('visible', true);
        pokeballModel.setAttribute('visible', false);
      }, { once: true });
    }
  }

  async function setupAudio() {
    for (const [key, path] of Object.entries(state.audioPaths)) {
      if (!path) continue;
      try {
        const audio = new Audio(path);
        audio.preload = 'auto';
        audio.volume = key === 'bulbasaur' ? 0.72 : 0.9;
        state.audioObjects[key] = audio;
      } catch (_) {}
    }
  }

  function sound(kind) {
    const audio = state.audioObjects[kind];
    if (audio) {
      try {
        audio.currentTime = 0;
        const promise = audio.play();
        if (promise && typeof promise.catch === 'function') promise.catch(() => synthSound(kind));
        return;
      } catch (_) {}
    }
    synthSound(kind);
  }

  function synthSound(kind) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!state.audioContext) state.audioContext = new AudioCtx();
      const ctx = state.audioContext;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      const presets = {
        bulbasaur: [210, 130, 0.22, 'sawtooth'],
        eating: [520, 720, 0.12, 'sine'],
        friendship: [420, 940, 0.5, 'triangle']
      };
      const [start, end, duration, type] = presets[kind] || presets.eating;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(start, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(60, end), now + duration);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now + duration + 0.03);
    } catch (_) {}
  }

  function toast(message) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => { toastEl.hidden = true; }, 1250);
  }

  function clearCookies() {
    for (const el of state.activeCookieEls) {
      clearTimeout(el._lifeTimer);
      el.remove();
    }
    state.activeCookieEls.clear();
    cookiesLayer.replaceChildren();
  }

  function stopSpawner() {
    clearTimeout(state.spawnTimer);
    state.spawnTimer = null;
  }

  function startSpawner() {
    stopSpawner();
    const spawn = () => {
      if (!state.markerVisible || state.phase !== 'hunt' || state.timeLeft <= 0) return;
      if (state.activeCookieEls.size < 4) spawnCookie();
      const wait = CFG.spawnMinMs + Math.random() * (CFG.spawnMaxMs - CFG.spawnMinMs);
      state.spawnTimer = setTimeout(spawn, wait);
    };
    state.spawnTimer = setTimeout(spawn, 250);
  }

  function spawnCookie() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cookie-token';
    btn.textContent = '🍪';
    btn.setAttribute('aria-label', 'Recoger galleta');
    const left = 8 + Math.random() * 82;
    const top = 23 + Math.random() * 59;
    btn.style.left = `calc(${left}% - 31px)`;
    btn.style.top = `calc(${top}% - 31px)`;
    btn.addEventListener('pointerdown', (event) => {
      event.preventDefault(); event.stopPropagation();
      if (state.phase !== 'hunt' || !state.markerVisible || !btn.isConnected) return;
      state.cookies += 1;
      state.collected += 1;
      updateHud();
      sound('eating');
      if (navigator.vibrate) navigator.vibrate(18);
      btn.style.transform = 'scale(1.35)';
      btn.style.opacity = '0';
      clearTimeout(btn._lifeTimer);
      setTimeout(() => removeCookie(btn), 90);
    });
    cookiesLayer.appendChild(btn);
    state.activeCookieEls.add(btn);
    btn._lifeTimer = setTimeout(() => {
      if (btn.isConnected) {
        btn.style.opacity = '0';
        btn.style.transform = 'scale(.5)';
        setTimeout(() => removeCookie(btn), 100);
      }
    }, CFG.cookieLifeMs);
  }

  function removeCookie(el) {
    clearTimeout(el._lifeTimer);
    el.remove();
    state.activeCookieEls.delete(el);
  }

  function resetWorld() {
    state.cookies = 0;
    state.collected = 0;
    state.friendship = 0;
    state.timeLeft = 0;
    state.bannerLeft = 2.5;
    clearCookies();
    stopSpawner();
    projectileLayer.replaceChildren();
    state.activeProjectiles.clear();
    pokemonAnchor.setAttribute('visible', true);
    pokeballAnchor.setAttribute('visible', false);
    pokemonFallback.setAttribute('visible', !state.modelLoaded.bulbasaur);
    pokemonModel.setAttribute('visible', state.modelLoaded.bulbasaur);
    pokeballFallback.setAttribute('visible', !state.modelLoaded.pokeball);
    pokeballModel.setAttribute('visible', false);
    $('friendship-fill').style.width = '0%';
    $('friendship-text').textContent = '0%';
    $('end-card').classList.remove('success');
    updateHud();
  }

  function startGame() {
    resetWorld();
    try { if (state.audioContext && state.audioContext.state === 'suspended') state.audioContext.resume(); } catch (_) {}
    state.phase = 'hunt';
    state.mode = 'hunt';
    state.timeLeft = CFG.huntSeconds;
    setScreen('hunt');
    $('phase-label').textContent = 'FASE 01 · CAZA DE GALLETAS';
    $('progress-pill').hidden = true;
    $('friendship-wrap').hidden = true;
    tapHint.hidden = true;
    sound('bulbasaur');
    startSpawner();
    updateHud();
  }

  function startBanner() {
    stopSpawner();
    clearCookies();
    state.phase = 'banner';
    state.mode = 'banner';
    state.bannerLeft = 2.8;
    $('banner-count').textContent = '¡Preparados!';
    setScreen('banner');
  }

  function startFeeding() {
    if (state.cookies <= 0) {
      finishGame(false, 'No recogiste ninguna galleta. Bulbasaur aún no te conoce.');
      return;
    }
    state.phase = 'feed';
    state.mode = 'feed';
    state.timeLeft = CFG.feedSeconds;
    state.friendship = 0;
    pokemonAnchor.setAttribute('visible', true);
    pokeballAnchor.setAttribute('visible', false);
    $('phase-label').textContent = 'FASE 02 · HORA DEL PICOTEO';
    $('progress-pill').hidden = false;
    $('friendship-wrap').hidden = false;
    tapHint.hidden = false;
    setScreen('feed');
    updateHud();
    toast('Toca encima de Bulbasaur para lanzarle una galleta');
  }

  function finishGame(won, message) {
    stopSpawner();
    clearCookies();
    state.phase = won ? 'win' : 'lose';
    state.mode = won ? 'win' : 'lose';
    aimRing.hidden = true;
    tapHint.hidden = true;
    $('end-card').classList.toggle('success', won);
    $('end-icon').textContent = won ? '💚' : '💔';
    $('end-eyebrow').textContent = won ? 'AVENTURA COMPLETADA' : 'FIN DE LA PARTIDA';
    $('end-title').textContent = won ? '¡Amistad lograda!' : '¡Casi lo consigues!';
    $('end-copy').textContent = message;
    $('end-stats').textContent = `Galletas recogidas: ${state.collected} · Galletas restantes: ${state.cookies}`;
    $('end-pokeball').hidden = !won;
    pokemonAnchor.setAttribute('visible', !won);
    pokeballAnchor.setAttribute('visible', won);
    if (won) {
      sound('friendship');
      if (navigator.vibrate) navigator.vibrate([35, 40, 70]);
    } else {
      sound('bulbasaur');
      if (navigator.vibrate) navigator.vibrate([100, 60, 100]);
    }
    setScreen(won ? 'win' : 'lose');
  }

  function updateHud() {
    $('cookie-count').textContent = String(state.cookies);
    $('timer').textContent = formatTime(state.timeLeft);
    const pct = Math.min(100, (state.friendship / CFG.friendshipNeeded) * 100);
    $('friendship-fill').style.width = `${pct}%`;
    $('friendship-text').textContent = `${Math.round(pct)}%`;
    $('progress-pill').innerHTML = `🌱 <strong>${state.friendship}/${CFG.friendshipNeeded}</strong> amistad`;
  }

  function formatTime(seconds) {
    const total = Math.max(0, Math.ceil(seconds));
    return `00:${String(total).padStart(2,'0')}`;
  }

  function projectPokemon() {
    if (!scene.camera || !pokemonAnchor.object3D) return null;
    try {
      const world = new THREE.Vector3();
      pokemonAnchor.object3D.getWorldPosition(world);
      world.y += 0.13;
      world.project(scene.camera);
      if (world.z < -1 || world.z > 1) return null;
      const rect = scene.canvas ? scene.canvas.getBoundingClientRect() : {left:0,top:0,width:window.innerWidth,height:window.innerHeight};
      return { x: rect.left + (world.x + 1) * 0.5 * rect.width, y: rect.top + (1 - world.y) * 0.5 * rect.height };
    } catch (_) { return null; }
  }

  function animateAimRing() {
    if (state.phase !== 'feed' || !state.markerVisible) return;
    const p = projectPokemon();
    if (p) {
      aimRing.hidden = false;
      aimRing.style.left = `${p.x}px`;
      aimRing.style.top = `${p.y}px`;
    } else {
      aimRing.hidden = true;
    }
    requestAnimationFrame(animateAimRing);
  }

  function addCookieProjectile() {
    const el = document.createElement('a-entity');
    el.setAttribute('position', '0 -0.25 0.26');
    el.setAttribute('rotation', '90 0 0');
    el.setAttribute('scale', '1 1 1');
    el.classList.add('cookie-projectile');

    const fallback = document.createElement('a-entity');
    fallback.setAttribute('id', `cookie-fallback-${Date.now()}-${Math.floor(Math.random()*10000)}`);
    const disk = document.createElement('a-cylinder');
    disk.setAttribute('radius', '0.052'); disk.setAttribute('height', '0.019'); disk.setAttribute('color', '#c98b4d');
    disk.setAttribute('material', 'roughness: 0.9');
    fallback.appendChild(disk);
    const chips = [[-.02,.01,.014],[.018,-.012,.014],[.005,.024,.014],[-.028,-.018,.014]];
    chips.forEach(([x,y,z]) => {
      const chip = document.createElement('a-sphere');
      chip.setAttribute('radius','0.006'); chip.setAttribute('color','#5b3924'); chip.setAttribute('position',`${x} ${y} ${z}`); fallback.appendChild(chip);
    });
    el.appendChild(fallback);

    const path = state.modelPaths.cookie;
    if (path) {
      const model = document.createElement('a-gltf-model');
      model.setAttribute('src', path);
      model.setAttribute('scale', '0.07 0.07 0.07');
      model.setAttribute('visible', 'false');
      model.addEventListener('model-loaded', () => { fallback.setAttribute('visible', false); model.setAttribute('visible', true); }, {once:true});
      model.addEventListener('model-error', () => { fallback.setAttribute('visible', true); model.setAttribute('visible', false); }, {once:true});
      el.appendChild(model);
    }
    projectileLayer.appendChild(el);
    return el;
  }

  function flyScreenCookie(fromX, fromY, toX, toY) {
    const sprite = document.createElement('div');
    sprite.className = 'flying-cookie';
    sprite.textContent = '🍪';
    sprite.style.left = `${fromX - 21}px`;
    sprite.style.top = `${fromY - 21}px`;
    document.body.appendChild(sprite);
    requestAnimationFrame(() => {
      sprite.classList.add('fly');
      sprite.style.left = `${toX - 21}px`;
      sprite.style.top = `${toY - 21}px`;
    });
    setTimeout(() => sprite.remove(), 560);
  }

  function launchCookie(targetScreen) {
    if (state.phase !== 'feed' || state.cookies <= 0 || !state.markerVisible) return;
    state.cookies -= 1;
    updateHud();
    const currentLocal = pokemonAnchor.object3D.position.clone();
    const projectile = addCookieProjectile();
    const start = new THREE.Vector3(0, -0.25, 0.26);
    const end = currentLocal.clone(); end.y += 0.11; end.z += 0.035;
    const startX = window.innerWidth / 2;
    const startY = window.innerHeight - 86;
    flyScreenCookie(startX, startY, targetScreen.x, targetScreen.y);
    const startTime = performance.now();
    const duration = CFG.projectileDurationMs;
    const origin = start.clone();
    const frame = (now) => {
      if (!projectile.isConnected) { state.activeProjectiles.delete(projectile); return; }
      const t = Math.min(1, (now - startTime) / duration);
      const ease = 1 - Math.pow(1 - t, 2);
      const x = origin.x + (end.x - origin.x) * ease;
      const y = origin.y + (end.y - origin.y) * ease + Math.sin(t * Math.PI) * 0.08;
      const z = origin.z + (end.z - origin.z) * ease;
      projectile.object3D.position.set(x,y,z);
      projectile.object3D.rotation.z = t * Math.PI * 5;
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        projectile.remove(); state.activeProjectiles.delete(projectile);
        // The screen-space aim check is generous; when the tap is on the creature, the cookie lands.
        state.friendship += 1;
        sound('eating');
        if (navigator.vibrate) navigator.vibrate(16);
        updateHud();
        showSparkle(end);
        toast(state.friendship >= CFG.friendshipNeeded ? '¡Bulbasaur se encariñó contigo!' : '¡Ñam! ¡Le encantan las galletas!');
        if (state.friendship >= CFG.friendshipNeeded) {
          setTimeout(() => finishGame(true, '¡Bulbasaur se hizo tu amigo y ya puedes llevarlo contigo!'), 380);
        } else if (state.cookies <= 0) {
          setTimeout(() => finishGame(false, 'Te quedaste sin galletas antes de llenar la barra de amistad.'), 500);
        }
      }
      state.activeProjectiles.add(projectile);
    };
    requestAnimationFrame(frame);
  }

  function showSparkle(position) {
    const sparkle = document.createElement('a-entity');
    sparkle.setAttribute('position', `${position.x} ${position.y + 0.08} ${position.z}`);
    const colors = ['#f9e56b','#e6ffb1','#fff7da'];
    for (let i=0;i<5;i++) {
      const star = document.createElement('a-sphere');
      star.setAttribute('radius','0.009');
      star.setAttribute('color',colors[i % colors.length]);
      star.setAttribute('position',`${(Math.random()-.5)*.12} ${(Math.random()-.5)*.13} ${(Math.random()-.5)*.03}`);
      sparkle.appendChild(star);
    }
    projectileLayer.appendChild(sparkle);
    setTimeout(() => sparkle.remove(), 450);
  }

  function pointerHandler(event) {
    if (!state.markerVisible || state.phase !== 'feed') return;
    if (event.target && event.target.closest && event.target.closest('button, .glass-card, .top-hud, .game-hud')) return;
    const point = projectPokemon();
    if (!point) { toast('Mantén el marcador a la vista'); return; }
    const dx = event.clientX - point.x;
    const dy = event.clientY - point.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= CFG.aimRadiusPx) {
      event.preventDefault();
      event.stopPropagation();
      launchCookie(point);
    } else {
      toast('¡Apunta a Bulbasaur y toca su cuerpo!');
      if (navigator.vibrate) navigator.vibrate(10);
    }
  }

  function onTargetFound() {
    state.markerVisible = true;
    scanOverlay.style.display = 'none';
    uiLayer.style.display = 'block';
    if (state.mode === 'boot' || state.mode === 'hidden') setScreen('menu');
    if (state.mode === 'hunt') startSpawner();
    if (state.phase === 'feed') requestAnimationFrame(animateAimRing);
    state.lastTick = performance.now();
  }

  function onTargetLost() {
    state.markerVisible = false;
    stopSpawner();
    uiLayer.style.display = 'none';
    scanOverlay.style.display = 'flex';
    showScan('Marcador fuera de vista', 'Vuelve a apuntar al marcador. La partida se pausa mientras no se detecte.', 'SEGUIMIENTO PAUSADO');
  }

  function setupAR() {
    if (!state.markerUrl) {
      showScan('No encuentro el marcador', 'Copia tu archivo marcador.mind al proyecto, en la raíz o en assets/marker.mind. Después recarga la página.', 'FALTA ARCHIVO .MIND');
      return;
    }
    scene.setAttribute('mindar-image', `imageTargetSrc: ${state.markerUrl}; autoStart: false; uiScanning: false; uiLoading: false; uiError: false; filterMinCF: 0.0001; filterBeta: 0.01; warmupTolerance: 3; missTolerance: 7`);
    const system = scene.systems && scene.systems['mindar-image-system'];
    if (!system || typeof system.start !== 'function') {
      showScan('No se pudo iniciar RA', 'Recarga la página. Si el problema continúa, verifica la conexión a internet para cargar MindAR y A-Frame.', 'ERROR DE INICIALIZACIÓN');
      return;
    }
    Promise.resolve(system.start()).then(() => {
      state.arStarted = true;
      showScan('Busca tu marcador', 'Apunta la cámara al marcador para activar el juego. Mantén la imagen completa dentro de la vista.', 'CÁMARA ACTIVA · BUSCANDO IMAGEN');
    }).catch((error) => {
      console.error('MindAR start error:', error);
      showScan('No se pudo iniciar la cámara', 'Revisa los permisos de cámara, usa HTTPS y prueba en Chrome para Android.', 'ERROR DE CÁMARA / RA');
    });
  }

  function tick() {
    const now = performance.now();
    const dt = Math.min(0.25, Math.max(0, (now - state.lastTick) / 1000));
    state.lastTick = now;

    // A gentle, repeatable walk cycle keeps Bulbasaur alive while remaining attached to the tracked image.
    if (state.markerVisible && pokemonAnchor.object3D.visible && state.phase !== 'win') {
      const t = now / 1000;
      pokemonAnchor.object3D.position.x = Math.sin(t * 1.9) * 0.095;
      pokemonAnchor.object3D.position.y = 0.02 + Math.sin(t * 3.3) * 0.018;
      pokemonAnchor.object3D.rotation.y = Math.sin(t * 1.3) * 0.20;
    }

    if (state.markerVisible) {
      if (state.phase === 'hunt' || state.phase === 'feed') {
        state.timeLeft -= dt;
        if (state.timeLeft <= 0) {
          state.timeLeft = 0;
          updateHud();
          if (state.phase === 'hunt') startBanner();
          else finishGame(false, 'Se acabó el tiempo. La amistad necesita más galletas.');
        } else updateHud();
      } else if (state.phase === 'banner') {
        state.bannerLeft -= dt;
        $('banner-count').textContent = `Comenzamos en ${Math.max(1, Math.ceil(state.bannerLeft))}…`;
        if (state.bannerLeft <= 0) startFeeding();
      }
    }
    if (state.phase === 'feed' && state.markerVisible) {
      const p = projectPokemon();
      if (p) { aimRing.hidden = false; aimRing.style.left = `${p.x}px`; aimRing.style.top = `${p.y}px`; }
      else aimRing.hidden = true;
    }
    state.tickTimer = requestAnimationFrame(tick);
  }

  function bindUI() {
    $('start-button').addEventListener('click', startGame);
    $('instructions-button').addEventListener('click', () => setScreen('instructions'));
    $('back-button').addEventListener('click', () => setScreen('menu'));
    $('play-again-button').addEventListener('click', startGame);
    $('end-menu-button').addEventListener('click', () => { resetWorld(); setScreen('menu'); });
    document.addEventListener('pointerdown', pointerHandler, true);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopSpawner();
      else if (state.markerVisible && state.phase === 'hunt') startSpawner();
    });
    scene.addEventListener('arError', () => {
      showScan('Error de realidad aumentada', 'La cámara no pudo iniciar. Verifica que el sitio use HTTPS y que el navegador tenga permiso de cámara.', 'ERROR AR');
    });
    targetRoot.addEventListener('targetFound', onTargetFound);
    targetRoot.addEventListener('targetLost', onTargetLost);
  }

  async function initialize() {
    showScan('Preparando aventura', 'Cargando el detector del marcador y los recursos…', 'INICIANDO RA');
    bindUI();
    await findAssets();
    await setupAudio();
    setupOptionalModels();
    if (state.modelPaths.cookie) {
      // The cookie GLB is loaded on demand for each thrown cookie, preserving low initial load time.
    }
    setupAR();
    state.mode = 'boot';
    state.lastTick = performance.now();
    requestAnimationFrame(tick);
  }

  if (scene.hasLoaded) initialize();
  else scene.addEventListener('loaded', initialize, { once: true });
})();
