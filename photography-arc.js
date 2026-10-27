(() => {
  const root = document.querySelector("[data-photography-gallery]");
  if (!root) return;

  const cityOrder = ["italy", "switzerland", "berlin", "spain", "paris"];
  const cityCopy = {
    italy: {
      titleEn: "ITALY",
      titleZh: "意大利",
      quoteEn: "“Thence we came forth to rebehold the stars.”",
      quoteZh: "“于是，我们走出幽暗，再次仰望群星。”",
      authorEn: "— DANTE ALIGHIERI · INFERNO, CANTO XXXIV",
      authorZh: "— 但丁·阿利吉耶里 ·《地狱篇》第三十四歌",
      source: "https://www.gutenberg.org/files/1001/1001-h/1001-h.htm"
    },
    switzerland: {
      titleEn: "SWITZERLAND",
      titleZh: "瑞士",
      quoteEn: "“The fir trees are all silver and gold!”",
      quoteZh: "“冷杉都变成了银色和金色！”",
      authorEn: "— JOHANNA SPYRI · HEIDI",
      authorZh: "— 约翰娜·施皮里 ·《海蒂》",
      source: "https://www.gutenberg.org/cache/epub/1448/pg1448.html"
    },
    berlin: {
      titleEn: "BERLIN",
      titleZh: "柏林",
      quoteEn: "“The stars glittered and not a leaf stirred in the park.”",
      quoteZh: "“群星闪耀，园中没有一片叶子颤动。”",
      authorEn: "— THEODOR FONTANE · EFFI BRIEST",
      authorZh: "— 台奥多尔·冯塔纳 ·《艾菲·布里斯特》",
      source: "https://www.gutenberg.org/cache/epub/14470/pg14470.html"
    },
    spain: {
      titleEn: "SPAIN",
      titleZh: "西班牙",
      quoteEn: "“Traveler, there is no road; the road is made by walking.”",
      quoteZh: "“行路人，世上本没有路；路是在行走中形成的。”",
      authorEn: "— ANTONIO MACHADO · CAMPOS DE CASTILLA",
      authorZh: "— 安东尼奥·马查多 ·《卡斯蒂利亚田野》",
      source: "https://www.cervantesvirtual.com/obra-visor/campos-de-castilla-1907-1917-1146197/html/d8869fc9-35b6-4bdf-b486-d09a281bfd97_2.html"
    },
    paris: {
      titleEn: "PARIS",
      titleZh: "巴黎",
      quoteEn: "“Paris may change; my melancholy is fixed.”",
      quoteZh: "“巴黎会改变；我的忧郁却不曾移动。”",
      authorEn: "— CHARLES BAUDELAIRE · THE SWAN",
      authorZh: "— 夏尔·波德莱尔 ·《天鹅》",
      source: "https://www.gutenberg.org/cache/epub/47032/pg47032-images.html"
    }
  };

  const arc = root.querySelector(".photography-arc");
  const stage = root.querySelector(".photography-arc-stage");
  const cityTrack = root.querySelector("[data-photo-city-track]");
  const cityTabs = [...root.querySelectorAll("[data-photo-city]")];
  const cityText = root.querySelector(".photography-city-copy");
  const cityPosition = root.querySelector("[data-photo-city-position]");
  const cityCount = root.querySelector("[data-photo-count]");
  const cityTitle = root.querySelector("[data-photo-city-title]");
  const cityQuote = root.querySelector("[data-photo-quote]");
  const cityAuthor = root.querySelector("[data-photo-author]");
  const cityBlockquote = root.querySelector(".photography-city-copy blockquote");
  const activeNumber = root.querySelector("[data-photo-active-number]");
  const totalNumber = root.querySelector("[data-photo-total]");
  const status = root.querySelector("[data-photo-status]");
  const previousButton = root.querySelector("[data-photo-previous]");
  const nextButton = root.querySelector("[data-photo-next]");
  const cityPreviousButton = root.querySelector("[data-photo-city-previous]");
  const cityNextButton = root.querySelector("[data-photo-city-next]");

  const viewer = document.querySelector("#photography-viewer");
  const viewerImage = viewer?.querySelector(".photography-viewer__image-wrap img");
  const viewerImageWrap = viewer?.querySelector(".photography-viewer__image-wrap");
  const viewerPlace = viewer?.querySelector("[data-photo-viewer-place]");
  const viewerNumber = viewer?.querySelector("[data-photo-viewer-number]");
  const viewerPrevious = viewer?.querySelector("[data-photo-viewer-previous]");
  const viewerNext = viewer?.querySelector("[data-photo-viewer-next]");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const state = {
    manifest: null,
    city: "italy",
    photos: [],
    cards: [],
    images: [],
    surfaces: [],
    rotations: [],
    orientationOffsets: [],
    layout: null,
    position: 0,
    target: 0,
    velocity: 0,
    frame: 0,
    activeIndex: 0,
    initialized: false,
    loadingState: "loading",
    pointer: null,
    didDrag: false,
    suppressClickUntil: 0,
    viewerIndex: 0,
    viewerSource: null,
    viewerLoadToken: 0,
    viewerCanSwapLarge: false,
    pendingLarge: null,
    transitionClone: null,
    transitionAnimation: null,
    viewerImageAnimation: null,
    wheelTimer: 0,
    wheelVelocity: 0,
    wheelLastTime: 0,
    cityTransitioning: false,
    cityAnimation: null,
    cityWheelDelta: 0,
    cityWheelTimer: 0,
    cityWheelCooldownUntil: 0,
    hoverIndex: null,
    hoverWeights: [],
    hoverTargets: [],
    hoverLeaveTimer: 0,
    imageLoadToken: 0,
    lastFrameTime: 0
  };

  const isChinese = () => document.documentElement.lang === "zh-CN";
  const modulo = (value, length) => ((value % length) + length) % length;
  const pad = (value) => String(value).padStart(2, "0");
  const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);
  const TAU = Math.PI * 2;
  const RAD_TO_DEG = 180 / Math.PI;

  function closestCyclicDelta(index, position, length) {
    let delta = index - modulo(position, length);
    if (delta > length / 2) delta -= length;
    if (delta < -length / 2) delta += length;
    return delta;
  }

  function copyForCity(city = state.city) {
    return cityCopy[city] || cityCopy.italy;
  }

  function updateStaticLanguage() {
    const chinese = isChinese();
    const copy = copyForCity();
    const cityIndex = cityOrder.indexOf(state.city);

    cityTabs.forEach((button) => {
      const city = button.dataset.photoCity;
      const label = cityCopy[city];
      const count = state.manifest?.cityCounts?.[city] || Number(button.querySelector("span")?.textContent) || 0;
      button.innerHTML = `${chinese ? label.titleZh : label.titleEn} <span>${pad(count)}</span>`;
      button.setAttribute("aria-label", `${chinese ? label.titleZh : label.titleEn}, ${count}`);
    });
    const previousCity = cityCopy[cityOrder[modulo(cityIndex - 1, cityOrder.length)]];
    const nextCity = cityCopy[cityOrder[modulo(cityIndex + 1, cityOrder.length)]];
    if (cityPreviousButton) {
      cityPreviousButton.setAttribute("aria-label", chinese
        ? `上一个城市：${previousCity.titleZh}`
        : `Previous city: ${previousCity.titleEn}`);
      cityPreviousButton.title = chinese ? `上一个城市：${previousCity.titleZh}` : `Previous city: ${previousCity.titleEn}`;
    }
    if (cityNextButton) {
      cityNextButton.setAttribute("aria-label", chinese
        ? `下一个城市：${nextCity.titleZh}`
        : `Next city: ${nextCity.titleEn}`);
      cityNextButton.title = chinese ? `下一个城市：${nextCity.titleZh}` : `Next city: ${nextCity.titleEn}`;
    }
    state.cards.forEach((card, index) => {
      const photo = state.photos[index];
      if (!photo) return;
      const placeLabel = chinese ? photo.labelZh : photo.labelEn;
      const description = chinese ? photo.altZh : photo.altEn;
      card.setAttribute("aria-label", `${placeLabel || description} · ${description}`);
      const image = card.querySelector("img");
      if (image) image.alt = description;
    });

    if (cityPosition) cityPosition.textContent = `${pad(cityIndex + 1)} / ${pad(cityOrder.length)}`;
    if (cityCount) cityCount.textContent = chinese ? `${state.photos.length || state.manifest?.cityCounts?.[state.city] || 0} 张照片` : `${state.photos.length || state.manifest?.cityCounts?.[state.city] || 0} PHOTOGRAPHS`;
    if (cityTitle) cityTitle.textContent = chinese ? copy.titleZh : copy.titleEn;
    if (cityQuote) cityQuote.textContent = chinese ? copy.quoteZh : copy.quoteEn;
    if (cityAuthor) cityAuthor.textContent = chinese ? copy.authorZh : copy.authorEn;
    if (cityBlockquote) cityBlockquote.setAttribute("cite", copy.source);
    if (viewer?.open) updateViewerText();

    if (state.loadingState === "error" && status) {
      status.textContent = chinese ? "照片暂时无法载入，请稍后再试。" : "The photographs could not be loaded. Please try again.";
    }
  }

  function measureGeometry() {
    const width = stage?.clientWidth || window.innerWidth;
    const height = stage?.clientHeight || window.innerHeight;
    const mobile = width < 620;
    const tablet = width >= 620 && width < 920;
    const length = Math.max(1, state.photos.length);
    const shortSide = mobile
      ? clamp(width * .082, 30, 34)
      : tablet
        ? clamp(width * .06, 42, 52)
        : clamp(width * .043, 54, 66);
    const radius = mobile
      ? clamp(width * .37, 138, 150)
      : tablet
        ? clamp(width * .31, 210, 276)
        : clamp(Math.min(width * .23, height * .36), 286, 390);
    const centerY = mobile
      ? clamp(height * .51, 380, 430)
      : tablet
        ? clamp(height * .53, 430, 505)
        : clamp(height * .53, 455, 580);
    const angleStep = TAU / length;
    const pixelsPerItem = clamp((TAU * radius) / length, 90, 180);
    state.layout = {
      width,
      height,
      radius,
      radiusY: radius,
      centerY,
      shortSide,
      angleStep,
      pixelsPerItem,
      gapAngle: ((shortSide * .075) + 4) / radius
    };
    root.style.setProperty("--photo-orbit-center-y", `${centerY.toFixed(2)}px`);
    return state.layout;
  }

  function geometry() {
    return state.layout || measureGeometry();
  }

  function dimensionsForPhoto(photo, shortSide) {
    const sourceWidth = photo.ringWidth || photo.thumbWidth || photo.width || 1;
    const sourceHeight = photo.ringHeight || photo.thumbHeight || photo.height || 1;
    const aspect = sourceWidth / sourceHeight;
    if (aspect >= 1) {
      return {
        width: shortSide * aspect,
        height: shortSide,
        orientationOffset: 90
      };
    }
    return {
      width: shortSide,
      height: shortSide / aspect,
      orientationOffset: 0
    };
  }

  function sizeCards() {
    const { shortSide } = geometry();
    state.orientationOffsets = new Array(state.photos.length).fill(0);
    state.cards.forEach((card, index) => {
      const photo = state.photos[index];
      if (!photo) return;
      const dimensions = dimensionsForPhoto(photo, shortSide);
      card.style.width = `${dimensions.width.toFixed(2)}px`;
      card.style.height = `${dimensions.height.toFixed(2)}px`;
      state.orientationOffsets[index] = dimensions.orientationOffset;
    });
  }

  function setImageSource(image, photo) {
    if (!image || image.hasAttribute("src")) return;
    image.src = photo.ring || photo.thumb;
  }

  function scheduleRingImages() {
    const token = ++state.imageLoadToken;
    const length = state.photos.length;
    const priority = Array.from({ length }, (_, index) => index).sort((a, b) => {
      const distanceA = Math.min(a, length - a);
      const distanceB = Math.min(b, length - b);
      return distanceA - distanceB;
    });
    priority.slice(0, Math.min(8, length)).forEach((index) => setImageSource(state.images[index], state.photos[index]));
    const queue = priority.slice(Math.min(8, length));
    const loadBatch = (deadline) => {
      if (token !== state.imageLoadToken) return;
      let loaded = 0;
      while (queue.length && loaded < 3 && (!deadline || deadline.didTimeout || deadline.timeRemaining() > 3)) {
        const index = queue.shift();
        setImageSource(state.images[index], state.photos[index]);
        loaded += 1;
      }
      if (!queue.length) return;
      if ("requestIdleCallback" in window) window.requestIdleCallback(loadBatch, { timeout: 500 });
      else window.setTimeout(() => loadBatch(null), 80);
    };
    if (queue.length) {
      if ("requestIdleCallback" in window) window.requestIdleCallback(loadBatch, { timeout: 420 });
      else window.setTimeout(() => loadBatch(null), 80);
    }
  }

  function updateActiveIndex() {
    if (!state.photos.length) return;
    const nextActive = modulo(Math.round(state.position), state.photos.length);
    if (nextActive === state.activeIndex && activeNumber?.textContent) return;
    state.activeIndex = nextActive;
    if (activeNumber) activeNumber.textContent = pad(nextActive + 1);
    if (totalNumber) totalNumber.textContent = pad(state.photos.length);
    state.cards.forEach((card, index) => {
      const active = index === nextActive;
      card.setAttribute("aria-current", active ? "true" : "false");
    });
  }

  function renderArc() {
    if (!state.photos.length) return;
    const { radius, radiusY, angleStep, gapAngle } = geometry();
    const length = state.photos.length;
    const globalHover = state.hoverWeights.reduce((maximum, weight) => Math.max(maximum, weight), 0);

    state.cards.forEach((card, index) => {
      let angleOffset = 0;
      if (length > 4) {
        state.hoverWeights.forEach((weight, hoverIndex) => {
          if (weight < .001 || hoverIndex === index) return;
          let delta = index - hoverIndex;
          if (delta > length / 2) delta -= length;
          if (delta < -length / 2) delta += length;
          const falloff = Math.max(0, 1 - Math.abs(delta) / (length / 2));
          angleOffset += Math.sign(delta) * gapAngle * falloff * weight;
        });
      }
      const theta = (index - state.position) * angleStep + angleOffset;
      const hoverWeight = state.hoverWeights[index] || 0;
      const radiusBoost = 7 * globalHover + 11 * hoverWeight;
      const x = (radius + radiusBoost) * Math.sin(theta);
      const y = -(radiusY + radiusBoost) * Math.cos(theta);
      const rotation = theta * RAD_TO_DEG + (state.orientationOffsets[index] || 0);
      const zIndex = String(60 + Math.round((y / radiusY) * 8) + (hoverWeight > .02 ? 30 : 0));
      if (card.style.zIndex !== zIndex) card.style.zIndex = zIndex;
      card.style.transform = `translate3d(calc(-50% + ${x.toFixed(2)}px), calc(-50% + ${y.toFixed(2)}px), 0) rotate(${rotation.toFixed(3)}deg)`;
      state.rotations[index] = rotation;
      const surface = state.surfaces[index];
      if (surface) {
        surface.style.transform = `scale(${(1 + .15 * hoverWeight).toFixed(4)})`;
        surface.style.opacity = String(1 - (1 - hoverWeight) * globalHover * .08);
      }
      card.classList.toggle("is-hovered", hoverWeight > .025);
      const tabIndex = index === modulo(Math.round(state.position), length) ? 0 : -1;
      if (card.tabIndex !== tabIndex) card.tabIndex = tabIndex;
    });

    updateActiveIndex();
  }

  function animationTick(timestamp) {
    state.frame = 0;
    if (!state.photos.length) return;
    const dt = state.lastFrameTime
      ? Math.min((timestamp - state.lastFrameTime) / 1000, .064)
      : 1 / 60;
    state.lastFrameTime = timestamp;

    if (reducedMotion.matches) {
      state.position = state.target;
      state.velocity = 0;
      state.hoverWeights = [...state.hoverTargets];
      state.lastFrameTime = 0;
      renderArc();
      return;
    }

    const hoverBlend = 1 - Math.exp(-14 * dt);
    let hoverIsMoving = false;
    state.hoverWeights = state.hoverWeights.map((weight, index) => {
      const target = state.hoverTargets[index] || 0;
      const next = weight + (target - weight) * hoverBlend;
      if (Math.abs(target - next) > .001) hoverIsMoving = true;
      return next;
    });

    if (!state.pointer?.dragging) {
      let remaining = dt;
      while (remaining > 0) {
        const step = Math.min(remaining, 1 / 120);
        const distance = state.target - state.position;
        const acceleration = distance * 220 - state.velocity * 27;
        state.velocity += acceleration * step;
        state.position += state.velocity * step;
        remaining -= step;
      }
    }
    renderArc();

    const distance = state.target - state.position;
    const positionIsMoving = !state.pointer?.dragging && (Math.abs(distance) > .0008 || Math.abs(state.velocity) > .0015);
    if (positionIsMoving || hoverIsMoving) {
      state.frame = requestAnimationFrame(animationTick);
    } else {
      state.position = state.target;
      state.velocity = 0;
      state.hoverWeights = [...state.hoverTargets];
      state.lastFrameTime = 0;
      if (!state.hoverTargets.some(Boolean)) state.hoverIndex = null;
      if (Math.abs(state.position) > state.photos.length * 4) {
        const turns = Math.trunc(state.position / state.photos.length);
        state.position -= turns * state.photos.length;
        state.target = state.position;
      }
      renderArc();
    }
  }

  function startAnimation() {
    if (!state.frame) {
      state.lastFrameTime = 0;
      state.frame = requestAnimationFrame(animationTick);
    }
  }

  function moveBy(delta) {
    if (!state.photos.length) return;
    state.target = Math.round(state.target) + delta;
    startAnimation();
  }

  function clearCitySwipeHighlight() {
    cityPreviousButton?.classList.remove("is-swipe-target");
    cityNextButton?.classList.remove("is-swipe-target");
  }

  function setCityDragPreview(offset) {
    if (!cityTrack) return;
    const width = Math.max(1, stage?.clientWidth || window.innerWidth);
    const boundedOffset = clamp(offset, -width * .16, width * .16);
    const opacity = 1 - Math.min(.16, Math.abs(boundedOffset) / width);
    cityTrack.style.transform = `translate3d(${boundedOffset.toFixed(2)}px,0,0)`;
    cityTrack.style.opacity = opacity.toFixed(4);
    clearCitySwipeHighlight();
    if (boundedOffset > 4) cityPreviousButton?.classList.add("is-swipe-target");
    if (boundedOffset < -4) cityNextButton?.classList.add("is-swipe-target");
  }

  function resetCityTrack() {
    if (!cityTrack) return;
    cityTrack.style.removeProperty("transform");
    cityTrack.style.removeProperty("opacity");
    clearCitySwipeHighlight();
  }

  function settleCityTrack(offset = 0) {
    if (!cityTrack) return;
    clearCitySwipeHighlight();
    state.cityAnimation?.cancel?.();
    if (reducedMotion.matches || !cityTrack.animate) {
      resetCityTrack();
      return;
    }
    const width = Math.max(1, stage?.clientWidth || window.innerWidth);
    const startOpacity = 1 - Math.min(.16, Math.abs(offset) / width);
    const animation = cityTrack.animate([
      { transform: `translate3d(${offset.toFixed(2)}px,0,0)`, opacity: startOpacity },
      { transform: "translate3d(0,0,0)", opacity: 1 }
    ], { duration: 340, easing: "cubic-bezier(.22,1,.36,1)" });
    state.cityAnimation = animation;
    animation.finished.catch(() => {}).finally(() => {
      if (state.cityAnimation === animation) state.cityAnimation = null;
      resetCityTrack();
    });
  }

  async function transitionToCity(city, direction, startOffset = 0) {
    if (!state.manifest || state.cityTransitioning || !cityOrder.includes(city) || city === state.city) {
      settleCityTrack(startOffset);
      return;
    }
    state.cityTransitioning = true;
    clearHover(0);
    window.clearTimeout(state.wheelTimer);
    window.clearTimeout(state.cityWheelTimer);
    state.wheelTimer = 0;
    state.wheelVelocity = 0;
    state.wheelLastTime = 0;
    state.cityWheelTimer = 0;
    state.cityWheelDelta = 0;
    state.target = state.position;
    state.velocity = 0;
    state.cityAnimation?.cancel?.();
    clearCitySwipeHighlight();

    if (!cityTrack || reducedMotion.matches || !cityTrack.animate) {
      resetCityTrack();
      setCity(city, true, false);
      state.cityTransitioning = false;
      return;
    }

    const width = Math.max(1, stage?.clientWidth || window.innerWidth);
    const travel = clamp(width * .095, 72, 138);
    const exitOffset = -Math.sign(direction || 1) * travel;
    const entranceOffset = Math.sign(direction || 1) * travel * .68;
    const startOpacity = 1 - Math.min(.16, Math.abs(startOffset) / width);
    const outgoing = cityTrack.animate([
      { transform: `translate3d(${startOffset.toFixed(2)}px,0,0)`, opacity: startOpacity },
      { transform: `translate3d(${exitOffset.toFixed(2)}px,0,0)`, opacity: 0 }
    ], { duration: 180, easing: "cubic-bezier(.55,0,1,.45)", fill: "forwards" });
    state.cityAnimation = outgoing;
    await outgoing.finished.catch(() => {});
    outgoing.cancel();

    setCity(city, true, false);
    cityTrack.style.transform = `translate3d(${entranceOffset.toFixed(2)}px,0,0)`;
    cityTrack.style.opacity = "0";
    const incoming = cityTrack.animate([
      { transform: `translate3d(${entranceOffset.toFixed(2)}px,0,0)`, opacity: 0 },
      { transform: "translate3d(0,0,0)", opacity: 1 }
    ], { duration: 430, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" });
    state.cityAnimation = incoming;
    await incoming.finished.catch(() => {});
    incoming.cancel();
    state.cityAnimation = null;
    resetCityTrack();
    state.cityTransitioning = false;
  }

  function changeCityBy(delta, startOffset = 0) {
    if (!state.manifest || state.cityTransitioning) return;
    const currentIndex = cityOrder.indexOf(state.city);
    const direction = delta < 0 ? -1 : 1;
    const nextCity = cityOrder[modulo(currentIndex + direction, cityOrder.length)];
    transitionToCity(nextCity, direction, startOffset);
  }

  function transitionToSelectedCity(city) {
    if (!state.manifest || state.cityTransitioning || city === state.city) return;
    const currentIndex = cityOrder.indexOf(state.city);
    const targetIndex = cityOrder.indexOf(city);
    const forwardDistance = modulo(targetIndex - currentIndex, cityOrder.length);
    const direction = forwardDistance <= cityOrder.length / 2 ? 1 : -1;
    transitionToCity(city, direction, 0);
  }

  function setHoverTarget(index) {
    window.clearTimeout(state.hoverLeaveTimer);
    if (!state.photos.length || index < 0 || index >= state.photos.length) return;
    state.hoverIndex = index;
    state.hoverTargets.fill(0);
    state.hoverTargets[index] = 1;
    startAnimation();
  }

  function clearHover(delay = 60) {
    window.clearTimeout(state.hoverLeaveTimer);
    const reset = () => {
      state.hoverTargets.fill(0);
      startAnimation();
    };
    if (delay > 0) state.hoverLeaveTimer = window.setTimeout(reset, delay);
    else reset();
  }

  function setCity(city, announce = true, animateEntry = true) {
    if (!state.manifest || !cityOrder.includes(city)) return;
    window.clearTimeout(state.hoverLeaveTimer);
    window.clearTimeout(state.wheelTimer);
    window.clearTimeout(state.cityWheelTimer);
    state.wheelTimer = 0;
    state.wheelVelocity = 0;
    state.wheelLastTime = 0;
    state.cityWheelTimer = 0;
    state.cityWheelDelta = 0;
    state.city = city;
    state.photos = state.manifest.photos.filter((photo) => photo.city === city);
    state.position = 0;
    state.target = 0;
    state.velocity = 0;
    state.activeIndex = -1;
    state.hoverIndex = null;
    state.hoverWeights = new Array(state.photos.length).fill(0);
    state.hoverTargets = new Array(state.photos.length).fill(0);
    state.lastFrameTime = 0;
    if (state.frame) cancelAnimationFrame(state.frame);
    state.frame = 0;

    cityTabs.forEach((button) => {
      const selected = button.dataset.photoCity === city;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    });

    arc.replaceChildren();
    state.images = [];
    state.surfaces = [];
    state.rotations = [];
    state.orientationOffsets = [];
    state.layout = null;
    state.cards = state.photos.map((photo, index) => {
      const button = document.createElement("button");
      const surface = document.createElement("span");
      const image = document.createElement("img");
      button.type = "button";
      button.className = "photography-arc-card";
      button.dataset.photoIndex = String(index);
      const description = isChinese() ? photo.altZh : photo.altEn;
      const placeLabel = isChinese() ? photo.labelZh : photo.labelEn;
      button.setAttribute("aria-label", `${placeLabel || description} · ${description}`);
      surface.className = "photography-arc-card__surface";
      image.alt = description;
      image.width = photo.ringWidth || photo.thumbWidth;
      image.height = photo.ringHeight || photo.thumbHeight;
      image.loading = "eager";
      image.decoding = "async";
      image.draggable = false;
      surface.append(image);
      button.append(surface);
      state.images[index] = image;
      state.surfaces[index] = surface;
      button.addEventListener("click", () => {
        if (state.cityTransitioning || performance.now() < state.suppressClickUntil) return;
        state.target = state.position;
        state.velocity = 0;
        openViewer(index, button);
      });
      arc.append(button);
      return button;
    });

    if (totalNumber) totalNumber.textContent = pad(state.photos.length);
    updateStaticLanguage();
    cityText?.classList.remove("is-changing");
    void cityText?.offsetWidth;
    cityText?.classList.add("is-changing");
    window.setTimeout(() => cityText?.classList.remove("is-changing"), 520);
    measureGeometry();
    sizeCards();
    renderArc();
    scheduleRingImages();
    if (announce && animateEntry && !reducedMotion.matches) {
      arc.animate([
        { opacity: 0, transform: "scale(.955)" },
        { opacity: 1, transform: "scale(1)" }
      ], { duration: 520, easing: "cubic-bezier(.22,1,.36,1)" });
    }

    if (announce && status) {
      status.textContent = isChinese() ? `${copyForCity().titleZh}，${state.photos.length} 张照片` : `${copyForCity().titleEn}, ${state.photos.length} photographs`;
      status.hidden = false;
      window.setTimeout(() => { if (state.loadingState === "ready") status.hidden = true; }, 900);
    }
  }

  function updateViewerText() {
    if (!state.photos.length) return;
    const photo = state.photos[state.viewerIndex];
    const copy = copyForCity();
    if (viewerPlace) viewerPlace.textContent = isChinese() ? copy.titleZh : copy.titleEn;
    if (viewerNumber) viewerNumber.textContent = `${pad(state.viewerIndex + 1)} / ${pad(state.photos.length)}`;
    if (viewerImage) {
      viewerImage.alt = isChinese() ? photo.altZh : photo.altEn;
      viewerImage.width = photo.thumbWidth;
      viewerImage.height = photo.thumbHeight;
    }
  }

  function normalizeAngle(angle) {
    return modulo(angle + 180, 360) - 180;
  }

  function targetImageRect(photo) {
    const wrap = viewerImageWrap.getBoundingClientRect();
    const aspect = photo.width / photo.height;
    let width = wrap.width;
    let height = width / aspect;
    if (height > wrap.height) {
      height = wrap.height;
      width = height * aspect;
    }
    return {
      left: wrap.left + (wrap.width - width) / 2,
      top: wrap.top + (wrap.height - height) / 2,
      width,
      height
    };
  }

  function removeTransitionClone() {
    state.transitionAnimation?.cancel();
    state.transitionAnimation = null;
    state.transitionClone?.remove();
    state.transitionClone = null;
  }

  function maybeRevealLarge() {
    const pending = state.pendingLarge;
    if (!pending || !state.viewerCanSwapLarge || !viewer?.open || pending.token !== state.viewerLoadToken) return;
    viewerImage.src = pending.source;
    viewerImage.classList.remove("is-loading");
    state.pendingLarge = null;
  }

  function loadViewerPhoto(index, direction = 0) {
    if (!viewerImage || !state.photos.length) return;
    state.viewerIndex = modulo(index, state.photos.length);
    const photo = state.photos[state.viewerIndex];
    const token = ++state.viewerLoadToken;
    state.pendingLarge = null;
    viewerImage.classList.add("is-loading");
    viewerImage.src = photo.thumb;
    viewerImage.removeAttribute("srcset");
    updateViewerText();

    state.viewerImageAnimation?.cancel();
    if (direction && !reducedMotion.matches) {
      state.viewerCanSwapLarge = false;
      state.viewerImageAnimation = viewerImage.animate([
        { opacity: .05, transform: `translateX(${direction > 0 ? 20 : -20}px) scale(.99)` },
        { opacity: 1, transform: "translateX(0) scale(1)" }
      ], { duration: 430, easing: "cubic-bezier(.22,1,.36,1)" });
      state.viewerImageAnimation.finished.catch(() => {}).finally(() => {
        if (token !== state.viewerLoadToken) return;
        state.viewerCanSwapLarge = true;
        maybeRevealLarge();
      });
    }

    const largeImage = new Image();
    largeImage.src = photo.large;
    const markLargeReady = () => {
      if (token !== state.viewerLoadToken || !viewer.open) return;
      state.pendingLarge = { token, source: photo.large };
      maybeRevealLarge();
    };
    if (typeof largeImage.decode === "function") {
      largeImage.decode().then(markLargeReady).catch(() => largeImage.addEventListener("load", markLargeReady, { once: true }));
    } else {
      largeImage.addEventListener("load", markLargeReady, { once: true });
    }
    largeImage.addEventListener("error", () => {
      if (token === state.viewerLoadToken) viewerImage.classList.remove("is-loading");
    }, { once: true });
  }

  function openViewer(index, sourceCard) {
    if (!viewer || !viewerImage || !viewerImageWrap || !state.photos.length || !sourceCard || viewer.open || state.cityTransitioning) return;
    const photo = state.photos[index];
    const sourceSurface = sourceCard.querySelector(".photography-arc-card__surface") || sourceCard;
    const sourceImage = sourceCard.querySelector("img");
    const surfaceRect = sourceSurface.getBoundingClientRect();
    const sourceWidth = sourceCard.offsetWidth * (1 + .15 * (state.hoverWeights[index] || 0));
    const sourceHeight = sourceCard.offsetHeight * (1 + .15 * (state.hoverWeights[index] || 0));
    const sourceLeft = surfaceRect.left + surfaceRect.width / 2 - sourceWidth / 2;
    const sourceTop = surfaceRect.top + surfaceRect.height / 2 - sourceHeight / 2;
    const rotation = normalizeAngle(state.rotations[index] || 0);

    state.target = state.position;
    state.velocity = 0;
    state.hoverTargets.fill(0);
    startAnimation();
    state.viewerSource = sourceCard;
    state.viewerIndex = index;
    state.viewerCanSwapLarge = reducedMotion.matches;
    viewerImage.style.opacity = reducedMotion.matches ? "1" : "0";
    viewer.classList.add("is-preparing");
    viewer.showModal();
    document.body.classList.add("photo-viewer-open");
    loadViewerPhoto(index);

    removeTransitionClone();
    if (!reducedMotion.matches && sourceImage) {
      const clone = document.createElement("img");
      clone.className = "photography-transition-clone";
      clone.alt = "";
      clone.src = sourceImage.currentSrc || sourceImage.src || photo.ring || photo.thumb;
      Object.assign(clone.style, {
        left: `${sourceLeft}px`,
        top: `${sourceTop}px`,
        width: `${sourceWidth}px`,
        height: `${sourceHeight}px`,
        transform: `rotate(${rotation}deg)`
      });
      document.body.append(clone);
      state.transitionClone = clone;
      sourceCard.classList.add("is-expanding");
    } else {
      sourceCard.classList.add("is-expanding");
    }

    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!viewer.open || viewer.classList.contains("is-closing")) return;
      viewer.classList.remove("is-preparing");
      if (reducedMotion.matches || !state.transitionClone) {
        viewerImage.style.opacity = "";
        state.viewerCanSwapLarge = true;
        maybeRevealLarge();
        return;
      }
      const targetRect = targetImageRect(photo);
      const clone = state.transitionClone;
      state.transitionAnimation = clone.animate([
        {
          left: `${sourceLeft}px`, top: `${sourceTop}px`, width: `${sourceWidth}px`, height: `${sourceHeight}px`,
          transform: `rotate(${rotation}deg)`, opacity: 1, borderRadius: "4px"
        },
        {
          offset: .68,
          left: `${targetRect.left}px`, top: `${targetRect.top}px`, width: `${targetRect.width}px`, height: `${targetRect.height}px`,
          transform: "rotate(0deg)", opacity: 1, borderRadius: "1px"
        },
        {
          left: `${targetRect.left}px`, top: `${targetRect.top}px`, width: `${targetRect.width}px`, height: `${targetRect.height}px`,
          transform: "rotate(0deg)", opacity: 0, borderRadius: "0"
        }
      ], { duration: 590, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" });
      state.viewerImageAnimation = viewerImage.animate([
        { opacity: 0 },
        { offset: .52, opacity: 0 },
        { opacity: 1 }
      ], { duration: 590, easing: "ease-out", fill: "forwards" });
      Promise.allSettled([state.transitionAnimation.finished, state.viewerImageAnimation.finished]).then(() => {
        if (!viewer.open || viewer.classList.contains("is-closing")) return;
        removeTransitionClone();
        viewerImage.style.opacity = "";
        state.viewerCanSwapLarge = true;
        maybeRevealLarge();
      });
    }));
  }

  function finishViewerClose() {
    if (!viewer?.open) return;
    removeTransitionClone();
    state.viewerImageAnimation?.cancel();
    state.viewerImageAnimation = null;
    viewer.close();
    viewer.classList.remove("is-closing", "is-preparing");
    document.body.classList.remove("photo-viewer-open");
    state.viewerSource?.classList.remove("is-expanding");
    state.viewerSource?.focus({ preventScroll: true });
    state.viewerSource = null;
    state.viewerLoadToken += 1;
    state.viewerCanSwapLarge = false;
    state.pendingLarge = null;
    if (viewerImage) {
      viewerImage.removeAttribute("src");
      viewerImage.classList.remove("is-loading");
      viewerImage.style.opacity = "";
    }
  }

  function closeViewer() {
    if (!viewer?.open || viewer.classList.contains("is-closing")) return;
    const source = state.cards[state.viewerIndex];
    const imageRect = viewerImage?.getBoundingClientRect();
    const sourceRect = source?.getBoundingClientRect();
    const sourceVisible = sourceRect && sourceRect.bottom > 0 && sourceRect.top < window.innerHeight && sourceRect.width > 0;
    viewer.classList.add("is-closing");
    removeTransitionClone();
    state.viewerImageAnimation?.cancel();

    if (!reducedMotion.matches && sourceVisible && imageRect?.width && imageRect?.height) {
      source.classList.add("is-expanding");
      const targetWidth = source.offsetWidth;
      const targetHeight = source.offsetHeight;
      const targetLeft = sourceRect.left + sourceRect.width / 2 - targetWidth / 2;
      const targetTop = sourceRect.top + sourceRect.height / 2 - targetHeight / 2;
      const rotation = normalizeAngle(state.rotations[state.viewerIndex] || 0);
      const clone = document.createElement("img");
      clone.className = "photography-transition-clone";
      clone.alt = "";
      clone.src = viewerImage.currentSrc || viewerImage.src;
      Object.assign(clone.style, {
        left: `${imageRect.left}px`, top: `${imageRect.top}px`, width: `${imageRect.width}px`, height: `${imageRect.height}px`,
        transform: "rotate(0deg)", objectFit: "contain", borderRadius: "0"
      });
      document.body.append(clone);
      state.transitionClone = clone;
      state.transitionAnimation = clone.animate([
        {
          left: `${imageRect.left}px`, top: `${imageRect.top}px`, width: `${imageRect.width}px`, height: `${imageRect.height}px`,
          transform: "rotate(0deg)", opacity: 1, borderRadius: "0"
        },
        {
          left: `${targetLeft}px`, top: `${targetTop}px`, width: `${targetWidth}px`, height: `${targetHeight}px`,
          transform: `rotate(${rotation}deg)`, opacity: 1, borderRadius: "4px"
        }
      ], { duration: 440, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" });
      state.transitionAnimation.finished.catch(() => {}).finally(finishViewerClose);
    } else {
      window.setTimeout(finishViewerClose, reducedMotion.matches ? 10 : 360);
    }
  }

  function changeViewer(delta) {
    if (!viewer?.open || viewer.classList.contains("is-closing") || !state.photos.length) return;
    state.viewerSource?.classList.remove("is-expanding");
    const nextIndex = modulo(state.viewerIndex + delta, state.photos.length);
    state.viewerSource = state.cards[nextIndex] || null;
    state.viewerSource?.classList.add("is-expanding");
    state.target = state.position + closestCyclicDelta(nextIndex, state.position, state.photos.length);
    startAnimation();
    state.viewerCanSwapLarge = reducedMotion.matches;
    loadViewerPhoto(nextIndex, delta);
  }

  async function initialize() {
    if (state.initialized) return;
    state.initialized = true;
    try {
      const response = await fetch("assets/photography/manifest.json?v=20261027-10", { cache: "force-cache" });
      if (!response.ok) throw new Error(`Photography manifest returned ${response.status}`);
      const manifest = await response.json();
      if (!Array.isArray(manifest.photos) || !manifest.photos.length) throw new Error("Photography manifest is empty");
      state.manifest = manifest;
      state.loadingState = "ready";
      status?.classList.remove("is-error");
      setCity(state.city, false);
      if (status) status.hidden = true;
      if (window.location.hash === "#photography") {
        const alignPhotography = () => {
          const previousBehavior = document.documentElement.style.scrollBehavior;
          document.documentElement.style.scrollBehavior = "auto";
          root.scrollIntoView({ block: "start", behavior: "auto" });
          document.documentElement.style.scrollBehavior = previousBehavior;
        };
        requestAnimationFrame(alignPhotography);
        window.setTimeout(alignPhotography, 280);
        window.setTimeout(alignPhotography, 900);
      }
    } catch (error) {
      console.error("Unable to initialize photography gallery", error);
      state.loadingState = "error";
      status?.classList.add("is-error");
      if (status) status.hidden = false;
      updateStaticLanguage();
    }
  }

  cityTabs.forEach((button, index) => {
    button.addEventListener("click", () => transitionToSelectedCity(button.dataset.photoCity));
    button.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      let targetIndex = index;
      if (event.key === "ArrowLeft") targetIndex = modulo(index - 1, cityTabs.length);
      if (event.key === "ArrowRight") targetIndex = modulo(index + 1, cityTabs.length);
      if (event.key === "Home") targetIndex = 0;
      if (event.key === "End") targetIndex = cityTabs.length - 1;
      cityTabs[targetIndex].focus();
      transitionToSelectedCity(cityTabs[targetIndex].dataset.photoCity);
    });
  });

  cityPreviousButton?.addEventListener("click", () => changeCityBy(-1));
  cityNextButton?.addEventListener("click", () => changeCityBy(1));
  previousButton?.addEventListener("click", () => moveBy(-1));
  nextButton?.addEventListener("click", () => moveBy(1));
  viewerPrevious?.addEventListener("click", () => changeViewer(-1));
  viewerNext?.addEventListener("click", () => changeViewer(1));
  viewer?.querySelectorAll("[data-photo-viewer-close]").forEach((button) => button.addEventListener("click", closeViewer));
  viewer?.addEventListener("cancel", (event) => { event.preventDefault(); closeViewer(); });
  viewer?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") { event.preventDefault(); changeViewer(-1); }
    if (event.key === "ArrowRight") { event.preventDefault(); changeViewer(1); }
  });

  stage?.addEventListener("keydown", (event) => {
    const focusedCard = event.target.closest?.(".photography-arc-card");
    if (event.target !== stage && !focusedCard) return;
    if (state.cityTransitioning) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); moveBy(-1); }
    if (event.key === "ArrowRight") { event.preventDefault(); moveBy(1); }
    if (event.target === stage && (event.key === "Enter" || event.key === " ") && state.cards[state.activeIndex]) {
      event.preventDefault();
      openViewer(state.activeIndex, state.cards[state.activeIndex]);
    }
  });

  function pointerStartsOnOrbit(event) {
    if (event.target.closest?.(".photography-arc-card")) return true;
    const bounds = stage?.getBoundingClientRect();
    if (!bounds) return false;
    const layout = geometry();
    const x = event.clientX - (bounds.left + bounds.width / 2);
    const y = event.clientY - (bounds.top + layout.centerY);
    const distance = Math.hypot(x, y);
    return Math.abs(distance - layout.radius) <= layout.shortSide * 1.05 + 22;
  }

  stage?.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !state.photos.length || state.cityTransitioning) return;
    const card = event.target.closest?.(".photography-arc-card");
    if (!card && event.target.closest?.("button, a, input, select, textarea, [role='tab']")) return;
    state.target = state.position;
    state.velocity = 0;
    state.pointer = {
      id: event.pointerId,
      mode: pointerStartsOnOrbit(event) ? "orbit" : "city",
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastTime: performance.now(),
      startPosition: state.position,
      releaseVelocity: 0,
      releaseVelocityPx: 0,
      deltaX: 0,
      dragOffset: 0,
      dragging: false
    };
    state.didDrag = false;
  });

  window.addEventListener("pointermove", (event) => {
    const pointer = state.pointer;
    if (!pointer || pointer.id !== event.pointerId) return;
    const deltaX = event.clientX - pointer.startX;
    const deltaY = event.clientY - pointer.startY;
    if (!pointer.dragging) {
      if (Math.hypot(deltaX, deltaY) < 8) return;
      if (Math.abs(deltaX) <= Math.abs(deltaY) * 1.25) {
        if (Math.abs(deltaY) >= 8) state.pointer = null;
        return;
      }
      pointer.dragging = true;
      clearHover(0);
      stage?.setPointerCapture?.(event.pointerId);
      root.classList.add("is-dragging");
      if (pointer.mode === "city") root.classList.add("is-city-dragging");
    }
    const now = performance.now();
    const elapsedMs = Math.max(8, now - pointer.lastTime);
    pointer.deltaX = deltaX;
    if (pointer.mode === "city") {
      const instantVelocityPx = clamp((event.clientX - pointer.lastX) / elapsedMs, -2.4, 2.4);
      pointer.releaseVelocityPx += (instantVelocityPx - pointer.releaseVelocityPx) * .3;
      pointer.dragOffset = clamp(deltaX * .22, -48, 48);
      setCityDragPreview(pointer.dragOffset);
    } else {
      const nextPosition = pointer.startPosition - deltaX / geometry().pixelsPerItem;
      const elapsed = elapsedMs / 1000;
      const instantVelocity = clamp(-(event.clientX - pointer.lastX) / geometry().pixelsPerItem / elapsed, -7, 7);
      pointer.releaseVelocity += (instantVelocity - pointer.releaseVelocity) * .28;
      state.position = nextPosition;
      state.target = nextPosition;
      state.velocity = 0;
      renderArc();
    }
    pointer.lastX = event.clientX;
    pointer.lastTime = now;
    state.didDrag = true;
  }, { passive: true });

  const releasePointer = (event) => {
    const pointer = state.pointer;
    if (!pointer || (event.pointerId !== undefined && pointer.id !== event.pointerId)) return;
    const cancelled = event.type === "pointercancel";
    try {
      if (stage?.hasPointerCapture?.(pointer.id)) stage.releasePointerCapture(pointer.id);
    } catch (_) {}
    if (pointer.dragging) {
      if (pointer.mode === "city") {
        const width = Math.max(1, stage?.clientWidth || window.innerWidth);
        const threshold = clamp(width * .075, 56, 104);
        const releaseDelay = Math.max(0, performance.now() - pointer.lastTime);
        const releaseVelocityPx = pointer.releaseVelocityPx * Math.exp(-releaseDelay / 110);
        const shouldSwitch = !cancelled && (
          Math.abs(pointer.deltaX) >= threshold
          || (Math.abs(releaseVelocityPx) > .65 && Math.abs(pointer.deltaX) > 24)
        );
        const direction = pointer.deltaX < 0 ? 1 : -1;
        const dragOffset = pointer.dragOffset;
        state.suppressClickUntil = performance.now() + 350;
        root.classList.remove("is-dragging", "is-city-dragging");
        state.pointer = null;
        if (shouldSwitch) changeCityBy(direction, dragOffset);
        else settleCityTrack(dragOffset);
        return;
      }
      if (cancelled) {
        state.target = Math.round(state.position);
        state.velocity = 0;
      } else {
        const releaseDelay = Math.max(0, performance.now() - pointer.lastTime);
        const releaseVelocity = pointer.releaseVelocity * Math.exp(-releaseDelay / 90);
        state.target = Math.round(state.position + clamp(releaseVelocity * .16, -1.75, 1.75));
        state.velocity = releaseVelocity * .36;
      }
      state.suppressClickUntil = performance.now() + 280;
      startAnimation();
    }
    root.classList.remove("is-dragging", "is-city-dragging");
    state.pointer = null;
  };
  window.addEventListener("pointerup", releasePointer, { passive: true });
  window.addEventListener("pointercancel", releasePointer, { passive: true });

  stage?.addEventListener("wheel", (event) => {
    if (!state.photos.length) return;
    const horizontalIntent = Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey;
    if (!horizontalIntent) return;
    if (event.target.closest?.("button, a, input, select, textarea, [role='tab']") && !event.target.closest?.(".photography-arc-card")) return;
    event.preventDefault();
    clearHover(0);
    const delta = event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX;
    if (!pointerStartsOnOrbit(event)) {
      if (state.cityTransitioning || performance.now() < state.cityWheelCooldownUntil) return;
      state.cityWheelDelta += delta;
      const previewOffset = clamp(-state.cityWheelDelta * .16, -42, 42);
      setCityDragPreview(previewOffset);
      window.clearTimeout(state.cityWheelTimer);
      if (Math.abs(state.cityWheelDelta) >= 90) {
        const direction = state.cityWheelDelta > 0 ? 1 : -1;
        state.cityWheelDelta = 0;
        state.cityWheelCooldownUntil = performance.now() + 650;
        changeCityBy(direction, previewOffset);
      } else {
        state.cityWheelTimer = window.setTimeout(() => {
          state.cityWheelDelta = 0;
          state.cityWheelTimer = 0;
          settleCityTrack(previewOffset);
        }, 110);
      }
      return;
    }
    const now = performance.now();
    const elapsed = state.wheelLastTime ? Math.max(8, now - state.wheelLastTime) / 1000 : 1 / 60;
    const wheelDelta = delta / geometry().pixelsPerItem;
    const instantVelocity = clamp(wheelDelta / elapsed, -8, 8);
    state.wheelVelocity += (instantVelocity - state.wheelVelocity) * .28;
    state.wheelLastTime = now;
    state.position += wheelDelta;
    state.target = state.position;
    state.velocity = 0;
    renderArc();
    window.clearTimeout(state.wheelTimer);
    state.wheelTimer = window.setTimeout(() => {
      state.target = Math.round(state.position + clamp(state.wheelVelocity * .12, -1.25, 1.25));
      state.velocity = state.wheelVelocity * .26;
      state.wheelVelocity = 0;
      state.wheelLastTime = 0;
      startAnimation();
    }, 95);
  }, { passive: false });

  arc?.addEventListener("pointerover", (event) => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const card = event.target.closest(".photography-arc-card");
    if (!card) return;
    if (root.classList.contains("is-dragging") || Math.abs(state.velocity) > .03) return;
    setHoverTarget(Number(card.dataset.photoIndex));
  });
  arc?.addEventListener("pointerout", (event) => {
    const nextCard = event.relatedTarget instanceof Element
      ? event.relatedTarget.closest(".photography-arc-card")
      : null;
    if (nextCard) return;
    clearHover(60);
  });
  arc?.addEventListener("focusin", (event) => {
    const card = event.target.closest(".photography-arc-card");
    if (!card) return;
    setHoverTarget(Number(card.dataset.photoIndex));
  });
  arc?.addEventListener("focusout", (event) => {
    const nextCard = event.relatedTarget instanceof Element
      ? event.relatedTarget.closest(".photography-arc-card")
      : null;
    if (nextCard) return;
    clearHover(0);
  });

  [root, viewer].filter(Boolean).forEach((element) => {
    element.addEventListener("contextmenu", (event) => event.preventDefault());
    element.addEventListener("dragstart", (event) => event.preventDefault());
  });

  document.addEventListener("portfolio:languagechange", updateStaticLanguage);
  window.addEventListener("resize", () => {
    state.layout = null;
    measureGeometry();
    sizeCards();
    renderArc();
  }, { passive: true });
  reducedMotion.addEventListener?.("change", () => { state.position = state.target; renderArc(); });

  updateStaticLanguage();
  if (window.location.hash === "#photography") {
    initialize();
  } else if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      initialize();
    }, { rootMargin: "900px 0px" });
    observer.observe(root);
  } else {
    initialize();
  }
})();
