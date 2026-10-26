const translations = {
  skip: "跳转到摄影作品",
  back: "返回精选作品",
  archive: "摄影档案",
  title: "途中<br />片段",
  intro: "关于建筑、流动、天气，以及目的地之间那些安静细节的视觉笔记。",
  photographs: "摄影作品",
  places: "地点",
  author: "摄影者",
  explore: "浏览摄影档案",
  featuredAria: "精选摄影作品",
  galleryTitle: "摄影档案",
  galleryIntro: "选择一个地点，点击任意画面查看大图。",
  filtersAria: "按地点筛选摄影作品",
  collectionAria: "摄影作品集",
  all: "全部",
  italy: "意大利",
  switzerland: "瑞士",
  berlin: "柏林",
  spain: "西班牙",
  paris: "巴黎",
  loading: "正在加载摄影作品…",
  loadMore: "加载更多",
  returnPortfolio: "返回作品集",
  rights: "全部摄影作品",
  closeAria: "关闭照片",
  previousAria: "上一张照片",
  nextAria: "下一张照片",
  imageLoading: "正在加载画面…",
  keyboardHint: "使用 ← → 方向键浏览"
};

const messages = {
  empty: {
    en: "NO PHOTOGRAPHS ARE AVAILABLE IN THIS ARCHIVE YET.",
    zh: "这个摄影档案暂时没有可展示的作品。"
  },
  archiveError: {
    en: "THE PHOTO ARCHIVE COULD NOT BE LOADED. PLEASE REFRESH.",
    zh: "摄影作品加载失败，请刷新后重试。"
  },
  imageError: {
    en: "THIS FRAME COULD NOT BE LOADED.",
    zh: "这张照片暂时无法加载。"
  }
};

const englishTitle = document.title;
const textNodes = [...document.querySelectorAll("[data-i18n]")];
const htmlNodes = textNodes.filter((node) => node.dataset.i18n === "title");
const plainTextNodes = textNodes.filter((node) => node.dataset.i18n !== "title");
const ariaNodes = [...document.querySelectorAll("[data-i18n-aria-label]")];
const originalText = new Map(plainTextNodes.map((node) => [node, node.textContent]));
const originalHtml = new Map(htmlNodes.map((node) => [node, node.innerHTML]));
const originalAria = new Map(ariaNodes.map((node) => [node, node.getAttribute("aria-label")]));

const gallery = document.querySelector(".photo-grid");
const statusLabel = document.querySelector("[data-gallery-status]");
const loadMoreButton = document.querySelector(".load-more");
const filterButtons = [...document.querySelectorAll("[data-filter]")];
const languageToggle = document.querySelector(".language-toggle");
const lightbox = document.querySelector(".photo-lightbox");
const lightboxImage = lightbox?.querySelector(".lightbox-stage img");
const lightboxLoading = lightbox?.querySelector(".lightbox-loading");
const lightboxLabel = lightbox?.querySelector("#lightbox-label");
const lightboxCount = lightbox?.querySelector("[data-lightbox-count]");
const lightboxLocation = lightbox?.querySelector("[data-lightbox-location]");
const desktopDeckQuery = window.matchMedia("(min-width: 981px) and (hover: hover) and (pointer: fine)");
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const cardImageSizes = "(max-width: 600px) calc(100vw - 48px), (max-width: 980px) calc(50vw - 40px), 16vw";
const activeCardImageSizes = "(max-width: 600px) calc(100vw - 48px), (max-width: 980px) calc(50vw - 40px), 32vw";

let language = "en";
let photos = [];
let photoById = new Map();
let activeFilter = "all";
let visibleCount = 12;
let renderedCount = 0;
let activeLightboxIndex = -1;
let returnFocus = null;
let archiveState = "loading";
let lightboxState = "idle";
let resizeFrame = 0;

function isChinese() {
  return language === "zh-CN";
}

function localizedMessage(key) {
  return messages[key]?.[isChinese() ? "zh" : "en"] || "";
}

function filteredPhotos() {
  return activeFilter === "all" ? photos : photos.filter((photo) => photo.city === activeFilter);
}

function setStatus(visible, total) {
  if (!statusLabel) return;
  statusLabel.textContent = isChinese()
    ? `已显示 ${visible} / ${total} 张`
    : `SHOWING ${String(visible).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
}

function updateArchiveStatus() {
  if (!statusLabel) return;
  if (archiveState === "ready") {
    setStatus(renderedCount, filteredPhotos().length);
  } else if (archiveState === "empty") {
    statusLabel.textContent = localizedMessage("empty");
  } else if (archiveState === "error") {
    statusLabel.textContent = localizedMessage("archiveError");
  }
}

function photoUrls(photo) {
  return {
    thumb: `../${photo.thumb}`,
    large: `../${photo.large}`
  };
}

function updateCardLanguage(card) {
  const photo = photoById.get(card.dataset.photoId);
  if (!photo) return;
  const trigger = card.querySelector(".photo-card-link");
  const image = card.querySelector("img");
  const label = card.querySelector(".photo-card-label");
  trigger?.setAttribute("aria-label", isChinese() ? `查看${photo.labelZh}` : `View ${photo.labelEn}`);
  if (image) image.alt = isChinese() ? photo.altZh : photo.altEn;
  if (label) label.textContent = isChinese() ? photo.labelZh : photo.labelEn;
}

function createPhotoCard(photo, index) {
  const figure = document.createElement("figure");
  figure.className = "photo-card";
  figure.dataset.photoId = photo.id;
  figure.setAttribute("role", "listitem");
  figure.style.animationDelay = `${Math.min(index, 11) * 26}ms`;

  const trigger = document.createElement("button");
  trigger.className = "photo-card-link";
  trigger.type = "button";
  trigger.dataset.photoId = photo.id;

  const image = document.createElement("img");
  const urls = photoUrls(photo);
  image.src = urls.thumb;
  image.srcset = `${urls.thumb} ${photo.thumbWidth}w, ${urls.large} ${photo.width}w`;
  image.sizes = cardImageSizes;
  image.width = photo.thumbWidth;
  image.height = photo.thumbHeight;
  image.loading = "lazy";
  image.decoding = "async";
  image.setAttribute("fetchpriority", "low");
  image.draggable = false;

  const caption = document.createElement("figcaption");
  const label = document.createElement("span");
  label.className = "photo-card-label";
  const number = document.createElement("span");
  number.className = "photo-card-number";
  number.textContent = String(index + 1).padStart(3, "0");
  caption.append(label, number);
  trigger.append(image);
  figure.append(trigger, caption);
  updateCardLanguage(figure);
  return figure;
}

function cancelDeckAnimations(row) {
  row.querySelectorAll(".photo-card").forEach((card) => {
    card.getAnimations().forEach((animation) => animation.cancel());
  });
}

function activeGridTemplate(cardCount, activeIndex) {
  return Array.from({ length: cardCount }, (_, index) =>
    `minmax(0,${index === activeIndex ? 2.45 : 0.76}fr)`
  ).join(" ");
}

function setDeckActiveCard(row, nextCard, animate = true) {
  if (!desktopDeckQuery.matches) return;
  const cards = [...row.querySelectorAll(".photo-card")];
  const activeIndex = nextCard ? cards.indexOf(nextCard) : -1;
  const nextId = activeIndex >= 0 ? nextCard.dataset.photoId : "";
  if ((row.dataset.activePhotoId || "") === nextId) return;

  const firstRects = cards.map((card) => card.getBoundingClientRect());
  cancelDeckAnimations(row);
  row.dataset.activePhotoId = nextId;
  row.classList.toggle("is-active", activeIndex >= 0);
  cards.forEach((card, index) => {
    const isActive = index === activeIndex;
    card.classList.toggle("is-active", isActive);
    const image = card.querySelector("img");
    if (image) image.sizes = isActive ? activeCardImageSizes : cardImageSizes;
  });
  if (activeIndex >= 0) {
    row.style.gridTemplateColumns = activeGridTemplate(cards.length, activeIndex);
  } else {
    row.style.removeProperty("grid-template-columns");
  }

  if (!animate || reducedMotionQuery.matches) return;
  const lastRects = cards.map((card) => card.getBoundingClientRect());
  cards.forEach((card, index) => {
    const first = firstRects[index];
    const last = lastRects[index];
    if (!first.width || !last.width) return;
    const deltaX = first.left - last.left;
    const scaleX = first.width / last.width;
    card.animate(
      [
        { transform: `translateX(${deltaX}px) scaleX(${scaleX})` },
        { transform: "translateX(0) scaleX(1)" }
      ],
      { duration: 560, easing: "cubic-bezier(.22,1,.36,1)" }
    );
  });
}

function focusedCardIn(row) {
  const activeElement = document.activeElement;
  return activeElement instanceof Element ? activeElement.closest(".photo-card") : null;
}

function setupDeckRow(row) {
  row.addEventListener("pointerover", (event) => {
    if (!desktopDeckQuery.matches || event.pointerType === "touch") return;
    const target = event.target;
    const card = target instanceof Element ? target.closest(".photo-card") : null;
    if (card && row.contains(card)) setDeckActiveCard(row, card);
  });
  row.addEventListener("pointerleave", () => {
    setDeckActiveCard(row, focusedCardIn(row));
  });
  row.addEventListener("focusin", (event) => {
    const target = event.target;
    const card = target instanceof Element ? target.closest(".photo-card") : null;
    if (card) setDeckActiveCard(row, card);
  });
  row.addEventListener("focusout", () => {
    requestAnimationFrame(() => {
      const focusedCard = focusedCardIn(row);
      if (focusedCard) setDeckActiveCard(row, focusedCard);
      else if (!row.matches(":hover")) setDeckActiveCard(row, null);
    });
  });
}

function createPhotoRow() {
  const row = document.createElement("div");
  row.className = "photo-deck-row";
  row.setAttribute("role", "presentation");
  setupDeckRow(row);
  return row;
}

function appendGalleryItems(current, from, to) {
  if (!gallery || from >= to) return;
  const fragment = document.createDocumentFragment();
  let row = gallery.lastElementChild;
  if (!(row instanceof HTMLElement) || !row.classList.contains("photo-deck-row") || row.childElementCount >= 6) {
    row = null;
  }

  for (let index = from; index < to; index += 1) {
    if (!row || row.childElementCount >= 6) {
      row = createPhotoRow();
      fragment.append(row);
    }
    row.append(createPhotoCard(current[index], index));
    row.style.setProperty("--card-count", String(row.childElementCount));
  }
  gallery.append(fragment);
}

function renderGallery({ reset = true } = {}) {
  if (!gallery) return;
  const current = filteredPhotos();
  if (reset) {
    gallery.replaceChildren();
    renderedCount = 0;
  }

  if (!current.length) {
    archiveState = "empty";
    gallery.classList.add("is-empty");
    loadMoreButton?.setAttribute("hidden", "");
    updateArchiveStatus();
    return;
  }

  archiveState = "ready";
  gallery.classList.remove("is-empty");
  const nextCount = Math.min(visibleCount, current.length);
  appendGalleryItems(current, renderedCount, nextCount);
  renderedCount = nextCount;
  setStatus(renderedCount, current.length);
  if (loadMoreButton) loadMoreButton.hidden = renderedCount >= current.length;
}

function updateVisibleCardsLanguage() {
  gallery?.querySelectorAll(".photo-card").forEach(updateCardLanguage);
}

function updateLightboxLanguage() {
  const current = filteredPhotos();
  const photo = current[activeLightboxIndex];
  if (!photo || !lightboxImage) return;
  lightboxImage.alt = isChinese() ? photo.altZh : photo.altEn;
  if (lightboxLabel) lightboxLabel.textContent = isChinese() ? photo.labelZh : photo.labelEn;
  if (lightboxLocation) lightboxLocation.textContent = isChinese() ? photo.cityZh : photo.cityEn;
  if (lightboxState === "loading" && lightboxLoading) {
    lightboxLoading.textContent = isChinese() ? translations.imageLoading : originalText.get(lightboxLoading);
  } else if (lightboxState === "error" && lightboxLoading) {
    lightboxLoading.textContent = localizedMessage("imageError");
  }
}

function applyLanguage(nextLanguage) {
  language = nextLanguage === "zh-CN" ? "zh-CN" : "en";
  const chinese = isChinese();
  document.documentElement.lang = language;
  document.title = chinese ? "摄影作品 — 惠尧" : englishTitle;

  plainTextNodes.forEach((node) => {
    const key = node.dataset.i18n;
    node.textContent = chinese && translations[key] ? translations[key] : originalText.get(node);
  });
  htmlNodes.forEach((node) => {
    const key = node.dataset.i18n;
    node.innerHTML = chinese && translations[key] ? translations[key] : originalHtml.get(node);
  });
  ariaNodes.forEach((node) => {
    const key = node.dataset.i18nAriaLabel;
    node.setAttribute("aria-label", chinese && translations[key] ? translations[key] : originalAria.get(node));
  });
  if (languageToggle) {
    languageToggle.textContent = chinese ? "EN" : "中文";
    languageToggle.setAttribute("aria-label", chinese ? "Switch to English" : "切换为中文");
  }

  try {
    localStorage.setItem("portfolio-language", language);
  } catch (_error) {
    // Language persistence is optional.
  }
  updateVisibleCardsLanguage();
  updateArchiveStatus();
  updateLightboxLanguage();
}

function updateLightbox(index) {
  const current = filteredPhotos();
  if (!current.length || !lightboxImage) return false;
  activeLightboxIndex = (index + current.length) % current.length;
  const photo = current[activeLightboxIndex];
  const urls = photoUrls(photo);
  lightboxState = "loading";
  lightboxImage.classList.remove("is-ready");
  lightboxImage.dataset.photoId = photo.id;
  lightboxImage.removeAttribute("src");
  lightboxImage.removeAttribute("srcset");
  lightboxImage.width = photo.width;
  lightboxImage.height = photo.height;
  lightboxImage.setAttribute("fetchpriority", "high");
  if (lightboxCount) {
    lightboxCount.textContent = `${String(activeLightboxIndex + 1).padStart(2, "0")} / ${String(current.length).padStart(2, "0")}`;
  }
  if (lightboxLoading) {
    lightboxLoading.textContent = isChinese() ? translations.imageLoading : originalText.get(lightboxLoading);
    lightboxLoading.removeAttribute("hidden");
  }
  updateLightboxLanguage();
  requestAnimationFrame(() => {
    lightboxImage.srcset = `${urls.thumb} ${photo.thumbWidth}w, ${urls.large} ${photo.width}w`;
    lightboxImage.sizes = "(max-width: 600px) calc(100vw - 20px), calc(100vw - 150px)";
    lightboxImage.src = urls.large;
  });
  return true;
}

function openLightbox(index, trigger) {
  if (!lightbox?.showModal || !updateLightbox(index)) return;
  returnFocus = trigger;
  if (!lightbox.open) lightbox.showModal();
  document.body.classList.add("lightbox-open");
}

function closeLightbox() {
  if (!lightbox?.open) return;
  lightbox.close();
  document.body.classList.remove("lightbox-open");
  lightboxImage?.removeAttribute("src");
  lightboxImage?.removeAttribute("srcset");
  lightboxImage?.classList.remove("is-ready");
  lightboxState = "idle";
  activeLightboxIndex = -1;
  returnFocus?.focus({ preventScroll: true });
  returnFocus = null;
}

lightboxImage?.addEventListener("load", () => {
  lightboxState = "ready";
  lightboxImage.classList.add("is-ready");
  lightboxLoading?.setAttribute("hidden", "");
});

lightboxImage?.addEventListener("error", () => {
  lightboxState = "error";
  lightboxImage.classList.remove("is-ready");
  if (lightboxLoading) {
    lightboxLoading.textContent = localizedMessage("imageError");
    lightboxLoading.removeAttribute("hidden");
  }
});

gallery?.addEventListener("click", (event) => {
  const target = event.target;
  const trigger = target instanceof Element ? target.closest(".photo-card-link") : null;
  if (!(trigger instanceof HTMLButtonElement) || !gallery.contains(trigger)) return;
  const index = filteredPhotos().findIndex((photo) => photo.id === trigger.dataset.photoId);
  if (index >= 0) openLightbox(index, trigger);
});

document.addEventListener("contextmenu", (event) => {
  const target = event.target;
  if (target instanceof Element && target.closest(".hero-photo-stack, .photo-grid, .photo-lightbox")) {
    event.preventDefault();
  }
});

document.addEventListener("dragstart", (event) => {
  const target = event.target;
  if (target instanceof Element && target.closest(".hero-photo-stack, .photo-grid, .photo-lightbox")) {
    event.preventDefault();
  }
});

lightbox?.querySelector(".lightbox-close")?.addEventListener("click", closeLightbox);
lightbox?.querySelector(".lightbox-prev")?.addEventListener("click", () => updateLightbox(activeLightboxIndex - 1));
lightbox?.querySelector(".lightbox-next")?.addEventListener("click", () => updateLightbox(activeLightboxIndex + 1));
lightbox?.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeLightbox();
});
lightbox?.addEventListener("click", (event) => {
  if (event.target === lightbox) closeLightbox();
});
document.addEventListener("keydown", (event) => {
  if (!lightbox?.open) return;
  if (event.key === "ArrowLeft") updateLightbox(activeLightboxIndex - 1);
  if (event.key === "ArrowRight") updateLightbox(activeLightboxIndex + 1);
});

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (lightbox?.open) closeLightbox();
    activeFilter = button.dataset.filter || "all";
    visibleCount = 12;
    filterButtons.forEach((candidate) => {
      const active = candidate === button;
      candidate.classList.toggle("is-active", active);
      candidate.setAttribute("aria-pressed", String(active));
    });
    renderGallery({ reset: true });
  });
});

loadMoreButton?.addEventListener("click", () => {
  visibleCount += 12;
  renderGallery({ reset: false });
});

languageToggle?.addEventListener("click", () => {
  applyLanguage(isChinese() ? "en" : "zh-CN");
});

desktopDeckQuery.addEventListener("change", () => {
  gallery?.querySelectorAll(".photo-deck-row").forEach((row) => {
    cancelDeckAnimations(row);
    row.dataset.activePhotoId = "";
    row.classList.remove("is-active");
    row.style.removeProperty("grid-template-columns");
    row.querySelectorAll(".photo-card").forEach((card) => {
      card.classList.remove("is-active");
      const image = card.querySelector("img");
      if (image) image.sizes = cardImageSizes;
    });
  });
});

window.addEventListener("resize", () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    gallery?.querySelectorAll(".photo-deck-row").forEach(cancelDeckAnimations);
  });
}, { passive: true });

let savedLanguage = "en";
try {
  savedLanguage = localStorage.getItem("portfolio-language") || "en";
} catch (_error) {
  // Keep English as the safe default.
}
applyLanguage(savedLanguage);

gallery?.setAttribute("aria-busy", "true");
fetch("../assets/photography/manifest.json?v=20261027-3")
  .then((response) => {
    if (!response.ok) throw new Error(`Manifest request failed: ${response.status}`);
    return response.json();
  })
  .then((manifest) => {
    const manifestPhotos = Array.isArray(manifest?.photos) ? manifest.photos : [];
    photos = manifestPhotos.filter((photo) =>
      photo &&
      typeof photo.id === "string" &&
      typeof photo.city === "string" &&
      typeof photo.thumb === "string" &&
      typeof photo.large === "string" &&
      Number.isFinite(photo.thumbWidth) &&
      Number.isFinite(photo.thumbHeight) &&
      Number.isFinite(photo.width) &&
      Number.isFinite(photo.height)
    );
    photoById = new Map(photos.map((photo) => [photo.id, photo]));
    gallery?.setAttribute("aria-busy", "false");
    if (!photos.length) {
      archiveState = "empty";
      gallery?.replaceChildren();
      gallery?.classList.add("is-empty");
      loadMoreButton?.setAttribute("hidden", "");
      updateArchiveStatus();
      return;
    }
    renderGallery({ reset: true });
  })
  .catch(() => {
    archiveState = "error";
    gallery?.setAttribute("aria-busy", "false");
    gallery?.replaceChildren();
    gallery?.classList.add("is-empty");
    loadMoreButton?.setAttribute("hidden", "");
    updateArchiveStatus();
  });
