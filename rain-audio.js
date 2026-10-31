/* Ambient audio may preload behind the blurred gate; playback requires entry. */
(() => {
  "use strict";

  const SOURCE = "assets/audio/pont-de-bourgogne.mp3";
  const LEVEL = .45;
  const root = document.documentElement;
  let audio = null, context = null, source = null, gain = null;
  let graphAttempted = false;
  let muted = false, started = false, playing = false, loading = false;
  let error = null, disposed = false, resumeOnVisible = false;
  let volumeFrame = 0, muteTimer = 0, generation = 0;
  let rampFrom = 0, rampTo = 0, rampStart = 0, rampDuration = 0;
  const listeners = new AbortController();

  function getState() {
    return { muted, playing, loading, error };
  }

  function emit() {
    root.dataset.rainAudioState = error ? "error" : muted ? "muted"
      : loading ? "loading" : playing ? "playing" : "off";
    window.dispatchEvent(new CustomEvent("rainaudio:change", { detail: getState() }));
  }

  function currentGain() {
    if (!context || !rampDuration) return rampTo;
    const progress = Math.min(1, Math.max(0, (context.currentTime - rampStart) / rampDuration));
    return rampFrom + (rampTo - rampFrom) * progress;
  }

  function fadeTo(target, seconds) {
    clearTimeout(muteTimer);
    cancelAnimationFrame(volumeFrame);
    volumeFrame = 0;
    if (!audio) return;
    if (gain && context) {
      const value = currentGain();
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(value, now);
      gain.gain.linearRampToValueAtTime(target, now + seconds);
      rampFrom = value;
      rampTo = target;
      rampStart = now;
      rampDuration = seconds;
      return;
    }
    const from = audio.volume;
    const begin = performance.now();
    const frame = now => {
      if (!audio || disposed) return;
      const progress = Math.min(1, (now - begin) / (seconds * 1000));
      audio.volume = from + (target - from) * progress;
      if (progress < 1) volumeFrame = requestAnimationFrame(frame);
      else volumeFrame = 0;
    };
    volumeFrame = requestAnimationFrame(frame);
  }

  function silence() {
    clearTimeout(muteTimer);
    cancelAnimationFrame(volumeFrame);
    volumeFrame = 0;
    if (gain && context) {
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.setValueAtTime(0, context.currentTime);
      rampFrom = rampTo = 0;
      rampStart = context.currentTime;
      rampDuration = 0;
    } else if (audio) {
      audio.volume = 0;
    }
  }

  function fail(message) {
    if (disposed) return false;
    playing = loading = false;
    error = message || "Audio playback is unavailable.";
    silence();
    emit();
    return false;
  }

  function ensureAudio() {
    if (audio) return;
    audio = new Audio();
    audio.loop = true;
    audio.preload = "auto";
    audio.playsInline = true;
    audio.muted = muted;
    audio.volume = 0;
    audio.src = SOURCE;

    const options = { signal: listeners.signal };
    audio.addEventListener("playing", () => {
      if (disposed) return;
      playing = true;
      loading = false;
      error = null;
      silence();
      audio.muted = muted;
      if (!muted) fadeTo(LEVEL, 1);
      emit();
    }, options);
    audio.addEventListener("waiting", () => {
      if (disposed || audio.paused) return;
      playing = false;
      loading = true;
      emit();
    }, options);
    audio.addEventListener("pause", () => {
      playing = loading = false;
      emit();
    }, options);
    audio.addEventListener("error", () => fail("The ambient audio could not be loaded."), options);
  }

  function ensureGraph() {
    if (graphAttempted) return;
    graphAttempted = true;
    // Build the graph inside the click handler, after any silent preloading.
    // GainNode gives mobile Safari a real volume envelope as well.
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      context = new AudioContext();
      gain = context.createGain();
      gain.gain.setValueAtTime(0, context.currentTime);
      source = context.createMediaElementSource(audio);
      source.connect(gain);
      gain.connect(context.destination);
      audio.volume = 1;
    } catch (_) {
      source?.disconnect();
      gain?.disconnect();
      context?.close().catch(() => {});
      source = gain = context = null;
      audio.volume = 0;
    }
  }

  function prepare() {
    if (disposed) return getState();
    if (!audio) {
      ensureAudio();
      audio.load();
    }
    return getState();
  }

  function start() {
    if (disposed) return Promise.resolve(false);
    const requestGeneration = generation;
    try {
      const retry = Boolean(error);
      ensureAudio();
      ensureGraph();
      started = true;
      error = null;
      if (retry) audio.load();
      if (!audio.paused) {
        emit();
        return Promise.resolve(true);
      }
      loading = true;
      emit();
      silence();
      audio.muted = muted;
      // Both calls happen in the click's task, before any await can consume
      // browser user activation. Failed playback never blocks the visual intro.
      if (context?.state === "suspended") context.resume().catch(() => {});
      const result = audio.play();
      return Promise.resolve(result).then(() => requestGeneration === generation && !disposed,
        () => requestGeneration === generation ? fail("Audio playback was blocked. Tap the sound button to retry.") : false);
    } catch (_) {
      return Promise.resolve(fail("Audio playback is unavailable."));
    }
  }

  function setMuted(value) {
    muted = Boolean(value);
    clearTimeout(muteTimer);
    if (audio) {
      if (muted) {
        fadeTo(0, .08);
        muteTimer = setTimeout(() => {
          if (audio && muted) audio.muted = true;
        }, 90);
      } else {
        audio.muted = false;
        if (started && audio.paused && !document.hidden) start();
        else if (playing) fadeTo(LEVEL, .18);
      }
    }
    emit();
    return getState();
  }

  function onVisibilityChange() {
    if (!audio || !started || disposed) return;
    if (document.hidden) {
      resumeOnVisible = resumeOnVisible || !audio.paused;
      audio.pause();
      silence();
    } else if (resumeOnVisible) {
      resumeOnVisible = false;
      start();
    }
  }

  function dispose() {
    if (disposed) return;
    generation++;
    disposed = true;
    listeners.abort();
    clearTimeout(muteTimer);
    cancelAnimationFrame(volumeFrame);
    audio?.pause();
    if (audio) {
      audio.removeAttribute("src");
      audio.load();
    }
    source?.disconnect();
    gain?.disconnect();
    context?.close().catch(() => {});
    audio = source = gain = context = null;
    started = playing = loading = resumeOnVisible = false;
    emit();
  }

  document.addEventListener("visibilitychange", onVisibilityChange, { signal: listeners.signal });
  window.addEventListener("pagehide", event => {
    if (!event.persisted) dispose();
    else if (audio) {
      resumeOnVisible = resumeOnVisible || !audio.paused;
      audio.pause();
      silence();
    }
  }, { signal: listeners.signal });
  window.addEventListener("pageshow", event => {
    if (event.persisted && resumeOnVisible && !document.hidden) {
      resumeOnVisible = false;
      start();
    }
  }, { signal: listeners.signal });

  window.RainAudio = { prepare, start, setMuted, toggle: () => setMuted(!muted), getState, dispose };
  emit();
})();
