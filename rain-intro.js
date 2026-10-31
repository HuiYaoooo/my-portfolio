/* Rain on the actual homepage: optical refraction, a soft clearing surface,
   and a click-triggered 6000 ms timeline. No external animation dependencies. */
(() => {
  "use strict";
  const DURATION = 6000;
  const DROP_COUNT = 64;
  const root = document.documentElement;
  const params = new URLSearchParams(location.search);
  const preview = params.get("rain") === "preview";
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let layer, canvas, gl, program, frame = 0, started = 0;
  let textures = [];
  let stopped = false, elapsed = 0, controls, scrubber, output, skipButton;
  let capturedScene = null;
  let entered = false, entering = false, entryGate, entryButton, soundButton;
  let main, mainWasInert = false, skipLink, skipWasInert = false;
  let visualReady = Promise.resolve(false), readyWidth = 0, readyHeight = 0;
  let visualRevision = 0, resizeTimer = 0;
  let waveDrops = [], timeLocation, dropLocation;
  const dropUniforms = new Float32Array(DROP_COUNT * 4);
  const abort = new AbortController();

  function releaseGate() {
    entryGate?.remove();
    entryGate = null;
    root.classList.remove("rain-gated");
    if (main) main.inert = mainWasInert;
    if (skipLink) skipLink.inert = skipWasInert;
    if (controls) controls.inert = false;
  }

  function updateSound() {
    if (!soundButton) return;
    const state = window.RainAudio?.getState() || { muted: true };
    const enabled = !state.muted && !state.error;
    soundButton.textContent = enabled ? "SOUND ON" : "SOUND OFF";
    soundButton.setAttribute("aria-pressed", String(enabled));
    soundButton.setAttribute("aria-label", root.lang.startsWith("zh")
      ? (enabled ? "关闭声音" : "开启声音")
      : (enabled ? "Turn sound off" : "Turn sound on"));
  }

  function showEntry() {
    clearTimeout(window.__rainSafetyTimer);
    entryGate = document.querySelector(".rain-entry");
    entryButton = entryGate?.querySelector(".rain-enter");
    main = document.querySelector(".site-frame");
    skipLink = document.querySelector(".skip-link");
    if (main) { mainWasInert = main.inert; main.inert = true; }
    if (skipLink) { skipWasInert = skipLink.inert; skipLink.inert = true; }
    soundButton = document.createElement("button");
    soundButton.type = "button";
    soundButton.className = "rain-sound";
    soundButton.addEventListener("click", () => {
      const state = window.RainAudio?.getState();
      if ((entered || !entryGate) && (state?.error || !state?.playing)) {
        window.RainAudio?.setMuted(false);
        window.RainAudio?.start();
      } else {
        window.RainAudio?.toggle();
      }
    });
    window.addEventListener("rainaudio:change", updateSound);
    document.body.append(soundButton);
    updateSound();
    entryButton?.addEventListener("click", enter);
    setEntryBusy(true);
    root.dataset.rainState = "waiting";
    entryButton?.focus({ preventScroll: true });
    // The real page loads first behind the blur; media can then buffer silently.
    requestAnimationFrame(() => window.RainAudio?.prepare());
  }

  function setEntryBusy(busy) {
    if (!entryButton) return;
    entryButton.disabled = busy;
    if (busy) entryButton.setAttribute("aria-busy", "true");
    else entryButton.removeAttribute("aria-busy");
    const label = entryButton.querySelector("span");
    if (label) label.textContent = busy ? "Loading…" : "Click to enter";
  }

  function loadVisuals() {
    const revision = ++visualRevision;
    setEntryBusy(true);
    visualReady = visualReady.then(() => {
      if (stopped || revision !== visualRevision) return false;
      dispose();
      return prepareVisuals();
    });
    visualReady.then(() => {
      if (stopped || revision !== visualRevision) return;
      setEntryBusy(false);
      entryButton?.focus({ preventScroll: true });
    });
    return visualReady;
  }

  async function prepareVisuals() {
    try {
      await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 1400))]);
      if (stopped || !window.__rainIntroPending) return false;
      capturedScene = await window.RainScene.capture();
      if (stopped || !window.__rainIntroPending) return false;
      build();
      readyWidth = innerWidth;
      readyHeight = innerHeight;
      return true;
    } catch (error) {
      console.warn("Ripple rendering unavailable:", error.message);
      dispose();
      return false;
    }
  }

  async function enter() {
    if (entered || entering || stopped) return;
    entering = true;
    entryButton?.setAttribute("aria-busy", "true");
    // Unlock audio synchronously in the click's task; keep the page blurred
    // until both the prepared picture and audio playback are ready.
    const sound = window.RainAudio?.start() || Promise.resolve(false);
    const [, ready] = await Promise.all([
      Promise.race([sound, new Promise(resolve => setTimeout(resolve, 1500))]),
      visualReady
    ]);
    if (stopped) return;
    let canRender = ready;
    if (canRender && (readyWidth !== innerWidth || readyHeight !== innerHeight)) {
      dispose();
      canRender = await prepareVisuals();
    }
    if (stopped) return;
    entered = true;
    entering = false;
    releaseGate();
    if (canRender && !motion.matches) play();
    else finish();
  }

  const vertexSource = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = a_position * .5 + .5;
      gl_Position = vec4(a_position, 0., 1.);
    }`;
  const fragmentSource = `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_scene;
    uniform sampler2D u_blurNear;
    uniform sampler2D u_blurMid;
    uniform sampler2D u_blurFar;
    uniform vec2 u_size;
    uniform float u_time;
    uniform vec4 u_drops[64];
    vec3 scene(vec2 uv, float blur) {
      uv = clamp(uv, vec2(.001), vec2(.999));
      if (blur < 4.) return mix(texture2D(u_scene, uv).rgb, texture2D(u_blurNear, uv).rgb, blur / 4.);
      if (blur < 10.) return mix(texture2D(u_blurNear, uv).rgb, texture2D(u_blurMid, uv).rgb, (blur - 4.) / 6.);
      return mix(texture2D(u_blurMid, uv).rgb, texture2D(u_blurFar, uv).rgb, min(1., (blur - 10.) / 10.));
    }
    void main() {
      // Work in CSS pixels so wave speed and droplet sizes agree across devices.
      vec2 p = vec2(v_uv.x, 1. - v_uv.y) * u_size;
      vec2 normal = vec2(0.);
      float light = 0.;
      float clear = 0.;
      float water = 1. - smoothstep(4.08, 4.95, u_time);
      float waveScale = clamp(u_size.x / 1000., .65, 1.);
      for (int i = 0; i < 64; i++) {
        vec4 drop = u_drops[i];
        vec2 center = drop.xy * u_size;
        float age = u_time - drop.z;
        float power = drop.w;
        if (age >= 0. && age < 2.9) {
          vec2 delta = (p - center) / vec2(1., .72);
          float d = max(length(delta), .01);
          vec2 direction = delta / d / vec2(1., .72);
          float radius = age * (144. + power * 24.) * waveScale;
          float width = (17. + age * 12.) * waveScale;
          float packet = exp(-pow((d - radius) / width, 2.));
          float decay = exp(-age * (i == 0 ? 1.22 : 2.2)) * smoothstep(0., .035, age);
          float phase = (d - radius) * .19 / waveScale;
          float slope = cos(phase) * packet * decay * power;
          normal += direction * slope * 14. * waveScale * water;
          light += slope * (direction.x * -.45 + direction.y * -.7) * .13 * water;
          // Water clears the glass locally, followed by the full-page reveal.
          clear = max(clear, (1. - smoothstep(radius - 40., radius + 42., d)) * min(1., power * .65));
        }
      }
      // Hold the entire homepage fully blurred for 1.5 seconds. Ripples can
      // appear during the hold, but neither local nor global clearing starts early.
      float progress = smoothstep(1.5, 4.35, u_time);
      float localReveal = smoothstep(1.5, 2.05, u_time);
      float blur = 20. * pow(1. - progress, 1.5) * (1. - clear * .84 * localReveal);
      vec2 uv = v_uv + vec2(normal.x, -normal.y) / u_size;
      // Gaussian levels are prepared once, preserving soft text and saving GPU work.
      vec3 color = scene(uv, blur);
      color += light;
      color = mix(color, vec3(.77,.83,.85), .065 * (1. - progress));
      gl_FragColor = vec4(clamp(color, 0., 1.), 1.);
    }`;

  function cleanup() {
    clearTimeout(resizeTimer);
    cancelAnimationFrame(frame);
    frame = 0;
    layer?.remove();
    skipButton?.remove();
    layer = skipButton = null;
    releaseGate();
    root.classList.remove("rain-pending", "rain-running");
    root.dataset.rainState = "complete";
    window.__rainIntroPending = false;
    clearTimeout(window.__rainSafetyTimer);
    window.dispatchEvent(new CustomEvent("rainintro:end"));
  }

  function finish() {
    stopped = true;
    elapsed = DURATION;
    if (scrubber) scrubber.value = DURATION;
    if (output) output.textContent = "6.00 / 6.00";
    cleanup();
    if (!preview) {
      abort.abort();
      dispose();
    }
  }

  function dispose() {
    if (!gl) return;
    canvas?.removeEventListener("webglcontextlost", finish);
    textures.forEach(texture => gl.deleteTexture(texture));
    textures = [];
    gl.deleteProgram(program);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    gl = program = canvas = null;
    capturedScene = null;
    waveDrops = [];
  }

  function shader(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function build() {
    canvas = document.createElement("canvas");
    const dpr = Math.min(devicePixelRatio || 1, innerWidth < 600 ? 1.25 : 1, 1600 / innerWidth);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    canvas.setAttribute("aria-hidden", "true");
    gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, preserveDrawingBuffer: preview, powerPreference: "low-power" });
    if (!gl) throw new Error("WebGL unavailable");
    program = gl.createProgram();
    const vertex = shader(gl.VERTEX_SHADER, vertexSource);
    const fragment = shader(gl.FRAGMENT_SHADER, fragmentSource);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    [0, 4, 10, 20].forEach((radius, index) => {
      let source = capturedScene;
      if (radius) {
        source = document.createElement("canvas");
        source.width = capturedScene.width;
        source.height = capturedScene.height;
        const ctx = source.getContext("2d");
        const scale = capturedScene.width / innerWidth;
        // Extend the edges before blurring to avoid translucent screen borders.
        ctx.drawImage(capturedScene, 0, 0);
        ctx.filter = `blur(${radius * scale}px)`;
        ctx.drawImage(capturedScene, 0, 0);
      }
      const texture = gl.createTexture();
      textures.push(texture);
      gl.activeTexture(gl.TEXTURE0 + index);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.uniform1i(gl.getUniformLocation(program, ["u_scene", "u_blurNear", "u_blurMid", "u_blurFar"][index]), index);
    });
    gl.uniform2f(gl.getUniformLocation(program, "u_size"), innerWidth, innerHeight);
    // The schedule supplies surface waves only: there is no foreground rain layer.
    const schedule = window.RainStorm.create(innerWidth, innerHeight);
    waveDrops = schedule.impacts.filter((_, index) => index < 4 || index % 4 === 0);
    timeLocation = gl.getUniformLocation(program, "u_time");
    dropLocation = gl.getUniformLocation(program, "u_drops[0]");
    gl.viewport(0, 0, canvas.width, canvas.height);
    canvas.addEventListener("webglcontextlost", finish, { once: true });
  }

  function mount() {
    if (layer) return;
    layer = document.createElement("div");
    layer.className = "rain-intro";
    layer.setAttribute("aria-hidden", "true");
    layer.append(canvas);
    document.body.append(layer);
    root.classList.add("rain-pending", "rain-running");
    root.dataset.rainState = "playing";
    skipButton = document.createElement("button");
    skipButton.type = "button";
    skipButton.className = "rain-skip";
    skipButton.textContent = document.documentElement.lang.startsWith("zh") ? "跳过动画" : "SKIP INTRO";
    skipButton.addEventListener("click", finish);
    document.body.append(skipButton);
  }

  function render(ms) {
    if (!gl) return;
    mount();
    elapsed = Math.min(DURATION, Math.max(0, ms));
    // Stretch the established ripple composition from five to six seconds.
    // The original 1.5-second full-blur hold becomes 1.8 seconds after entry.
    const seconds = elapsed / 1000 * (5 / 6);
    dropUniforms.fill(0);
    for (let i = 0; i < DROP_COUNT; i++) dropUniforms[i * 4 + 2] = 100;
    const first = waveDrops[0];
    if (first) dropUniforms.set([first.x, first.y, first.time, first.power], 0);
    const recent = waveDrops.slice(1).filter(drop => drop.time <= seconds && drop.time > seconds - 2.4).slice(-(DROP_COUNT - 1));
    recent.forEach((drop, index) => dropUniforms.set([drop.x, drop.y, drop.time, drop.power], (index + 1) * 4));
    gl.uniform4fv(dropLocation, dropUniforms);
    gl.uniform1f(timeLocation, seconds);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    // The real DOM becomes the final frame as the last wet highlights disappear.
    const fade = Math.max(0, Math.min(1, (elapsed - 5450) / 550));
    layer.style.opacity = String(1 - fade * fade * (3 - 2 * fade));
    if (scrubber) scrubber.value = elapsed;
    if (output) output.textContent = `${(elapsed / 1000).toFixed(2)} / 6.00`;
    root.dataset.rainTime = String(Math.round(elapsed));
  }

  function tick(now) {
    if (stopped) return;
    render(now - started);
    if (elapsed >= DURATION) finish();
    else frame = requestAnimationFrame(tick);
  }

  function play() {
    if (!gl || motion.matches) return;
    clearTimeout(window.__rainSafetyTimer);
    cancelAnimationFrame(frame);
    stopped = false;
    root.dataset.rainState = "playing";
    started = performance.now();
    render(0);
    frame = requestAnimationFrame(tick);
  }

  function previewControls() {
    controls = document.createElement("div");
    controls.className = "rain-preview-controls";
    const replay = document.createElement("button");
    replay.textContent = "重播动画";
    replay.type = "button";
    replay.addEventListener("click", () => {
      if (!entered) enter();
      else { window.RainAudio?.start(); play(); }
    });
    scrubber = document.createElement("input");
    scrubber.type = "range";
    scrubber.min = "0";
    scrubber.max = DURATION;
    scrubber.step = "10";
    scrubber.value = "0";
    scrubber.setAttribute("aria-label", "开屏动画时间轴，毫秒");
    scrubber.addEventListener("input", () => {
      cancelAnimationFrame(frame);
      stopped = true;
      render(Number(scrubber.value));
      root.dataset.rainState = "paused";
      if (Number(scrubber.value) >= DURATION) cleanup();
    });
    output = document.createElement("output");
    controls.append(replay, scrubber, output);
    controls.inert = !entered;
    document.body.append(controls);
  }

  async function init() {
    if (!window.__rainIntroPending || motion.matches || !window.RainScene) {
      cleanup();
      return;
    }
    showEntry();
    loadVisuals();
    if (preview) previewControls();
    const still = params.get("rain-frame");
    if (preview && still !== null && await visualReady) {
      if (stopped) return;
      entered = true;
      releaseGate();
      stopped = true;
      render(Number(still));
      root.dataset.rainState = "paused";
    }
  }

  window.addEventListener("keydown", event => {
    if (event.key === "Escape") finish();
  }, { signal: abort.signal });
  window.addEventListener("wheel", () => { if (entered && !stopped) finish(); }, { passive: true, signal: abort.signal });
  window.addEventListener("touchmove", () => { if (entered && !stopped) finish(); }, { passive: true, signal: abort.signal });
  window.addEventListener("hashchange", finish, { signal: abort.signal });
  window.addEventListener("resize", () => {
    if (layer || entering) { finish(); return; }
    if (!entryGate || stopped) return;
    ++visualRevision;
    setEntryBusy(true);
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(loadVisuals, 150);
  }, { signal: abort.signal });
  document.addEventListener("visibilitychange", () => { if (document.hidden && entered && !stopped) finish(); }, { signal: abort.signal });
  motion.addEventListener("change", event => { if (event.matches) finish(); }, { signal: abort.signal });
  window.addEventListener("pagehide", () => { stopped = true; cleanup(); abort.abort(); dispose(); }, { once: true });
  window.__cancelRainIntro = finish;
  init();
})();
