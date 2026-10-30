/* A small, same-origin viewport snapshot for the rain's refraction texture.
   Text is measured from the live DOM, so translations and responsive wraps
   follow the page. Nothing is cloned into, or changed in, the document. */
(() => {
  "use strict";

  const images = new Map();
  const wait = (promise, ms) => Promise.race([
    Promise.resolve(promise).catch(() => null),
    new Promise(resolve => window.setTimeout(() => resolve(null), ms))
  ]);
  const split = value => {
    const parts = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < value.length; i += 1) {
      if (value[i] === "(") depth += 1;
      else if (value[i] === ")") depth -= 1;
      else if (value[i] === "," && !depth) {
        parts.push(value.slice(start, i).trim());
        start = i + 1;
      }
    }
    parts.push(value.slice(start).trim());
    return parts;
  };
  const transparent = color => !color || color === "transparent"
    || /rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/.test(color);

  function loadImage(url) {
    if (!url) return Promise.resolve(null);
    if (!images.has(url)) {
      const image = new Image();
      image.crossOrigin = "anonymous";
      images.set(url, new Promise(resolve => {
        image.onload = () => resolve(image);
        image.onerror = () => resolve(null);
        image.src = url;
      }));
    }
    return wait(images.get(url), 1800);
  }

  function visibility(element) {
    let opacity = 1;
    for (let node = element; node instanceof Element; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") return 0;
      opacity *= Number(style.opacity);
    }
    return opacity;
  }

  function roundedPath(context, rect, radius = 0, inset = 0) {
    const x = rect.left + inset;
    const y = rect.top + inset;
    const width = Math.max(0, rect.width - inset * 2);
    const height = Math.max(0, rect.height - inset * 2);
    const r = Math.min(Math.max(0, radius - inset), width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  function gradient(context, source, rect) {
    const match = source.match(/^linear-gradient\((.*)\)$/);
    if (!match) return null;
    const parts = split(match[1]);
    let angle = Math.PI;
    if (/deg$/.test(parts[0])) angle = parseFloat(parts.shift()) * Math.PI / 180;
    else if (/^to /.test(parts[0])) {
      const direction = parts.shift();
      angle = direction === "to right" ? Math.PI / 2 : direction === "to left"
        ? -Math.PI / 2 : direction === "to top" ? 0 : Math.PI;
    }
    const dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    const length = Math.abs(rect.width * dx) + Math.abs(rect.height * dy);
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const fill = context.createLinearGradient(cx - dx * length / 2, cy - dy * length / 2,
      cx + dx * length / 2, cy + dy * length / 2);
    parts.forEach((part, i) => {
      const stop = part.match(/^(.*?)\s+([\d.]+)%$/);
      fill.addColorStop(stop ? Math.min(1, parseFloat(stop[2]) / 100) : i / Math.max(1, parts.length - 1),
        stop ? stop[1] : part);
    });
    return fill;
  }

  function fillBackground(context, style, rect) {
    if (!transparent(style.backgroundColor)) {
      context.fillStyle = style.backgroundColor;
      context.fillRect(rect.left, rect.top, rect.width, rect.height);
    }
    // CSS paints its first background image on top of later images.
    split(style.backgroundImage || "none").reverse().forEach(layer => {
      const fill = gradient(context, layer, rect);
      if (!fill) return;
      context.fillStyle = fill;
      context.fillRect(rect.left, rect.top, rect.width, rect.height);
    });
  }

  function paintBox(context, element, style = getComputedStyle(element), rect = element.getBoundingClientRect()) {
    const alpha = visibility(element);
    if (!alpha || rect.width <= 0 || rect.height <= 0 || rect.bottom < 0 || rect.top > innerHeight) return;
    const radius = parseFloat(style.borderTopLeftRadius) || 0;
    context.save();
    context.globalAlpha = alpha;
    roundedPath(context, rect, radius);
    const shadow = style.boxShadow && split(style.boxShadow)[0];
    if (shadow && shadow !== "none" && !shadow.includes("inset")) {
      const color = shadow.match(/rgba?\([^)]+\)/)?.[0];
      const numbers = shadow.replace(/rgba?\([^)]+\)/g, "").match(/-?[\d.]+px/g)?.map(parseFloat);
      if (color && numbers?.length >= 3) {
        context.shadowColor = color;
        context.shadowOffsetX = numbers[0];
        context.shadowOffsetY = numbers[1];
        context.shadowBlur = numbers[2];
        context.fillStyle = transparent(style.backgroundColor) ? "rgba(255,255,255,.01)" : style.backgroundColor;
        context.fill();
        context.shadowColor = "transparent";
      }
    }
    context.clip();
    const backdrop = style.backdropFilter || style.webkitBackdropFilter;
    if (backdrop && backdrop !== "none") {
      context.save();
      context.filter = backdrop;
      context.drawImage(context.canvas, 0, 0, context.canvas.width, context.canvas.height,
        0, 0, innerWidth, innerHeight);
      context.restore();
    }
    fillBackground(context, style, rect);
    context.restore();
    context.save();
    context.globalAlpha = alpha;
    const borderWidth = parseFloat(style.borderTopWidth) || 0;
    if (borderWidth && !transparent(style.borderTopColor)) {
      roundedPath(context, rect, radius, borderWidth / 2);
      context.strokeStyle = style.borderTopColor;
      context.lineWidth = borderWidth;
      context.stroke();
    } else if (parseFloat(style.borderBottomWidth) && !transparent(style.borderBottomColor)) {
      context.strokeStyle = style.borderBottomColor;
      context.lineWidth = parseFloat(style.borderBottomWidth);
      context.beginPath();
      context.moveTo(rect.left, rect.bottom - context.lineWidth / 2);
      context.lineTo(rect.right, rect.bottom - context.lineWidth / 2);
      context.stroke();
    }
    context.restore();
  }

  function paintPseudo(context, element, pseudo) {
    const style = getComputedStyle(element, pseudo);
    if (style.display === "none" || style.content === "none" || style.content === "normal") return;
    const parent = element.getBoundingClientRect();
    const width = parseFloat(style.width);
    const height = parseFloat(style.height);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return;
    let left = parent.left + (parseFloat(style.left) || 0);
    let top = parent.top + (parseFloat(style.top) || 0);
    if (style.left === "auto") left = parent.right - (parseFloat(style.right) || 0) - width;
    if (style.top === "auto") top = parent.bottom - (parseFloat(style.bottom) || 0) - height;
    if (style.transform && style.transform !== "none") {
      const matrix = new DOMMatrixReadOnly(style.transform);
      left += matrix.m41;
      top += matrix.m42;
    }
    paintBox(context, element, style, { left, top, width, height, right: left + width, bottom: top + height });
  }

  function paintText(context, container) {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const element = node.parentElement;
      const alpha = element && visibility(element);
      if (!alpha || !node.nodeValue?.trim()) continue;
      const style = getComputedStyle(element);
      const fontSize = parseFloat(style.fontSize);
      context.save();
      context.globalAlpha = alpha;
      context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      context.textBaseline = "alphabetic";
      context.textAlign = "left";
      context.fontKerning = "normal";
      const fill = style.webkitTextFillColor;
      context.fillStyle = fill && fill !== "currentcolor" ? fill : style.color;
      const shadow = style.textShadow && split(style.textShadow)[0];
      if (shadow && shadow !== "none") {
        const color = shadow.match(/rgba?\([^)]+\)/)?.[0];
        const offsets = shadow.replace(/rgba?\([^)]+\)/g, "").match(/-?[\d.]+px/g)?.map(parseFloat);
        if (color && offsets?.length >= 2) {
          context.shadowColor = color;
          context.shadowOffsetX = offsets[0];
          context.shadowOffsetY = offsets[1];
          context.shadowBlur = offsets[2] || 0;
        }
      }
      const metrics = context.measureText("Mg");
      const ascent = metrics.fontBoundingBoxAscent ?? fontSize * .8;
      const descent = metrics.fontBoundingBoxDescent ?? fontSize * .2;
      let offset = 0;
      for (const character of node.nodeValue) {
        range.setStart(node, offset);
        offset += character.length;
        range.setEnd(node, offset);
        const rect = range.getBoundingClientRect();
        if (!character.trim() || rect.width <= 0 || rect.bottom < 0 || rect.top >= innerHeight) continue;
        const text = style.textTransform === "uppercase" ? character.toUpperCase()
          : style.textTransform === "lowercase" ? character.toLowerCase() : character;
        context.fillText(text, rect.left, rect.top + (rect.height - ascent - descent) / 2 + ascent);
      }
      context.restore();
    }
    range.detach();
  }

  async function capture() {
    if (document.fonts?.ready) await wait(document.fonts.ready, 1500);
    const width = innerWidth;
    const height = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    const context = canvas.getContext("2d");
    context.scale(dpr, dpr);
    context.fillStyle = getComputedStyle(document.body).backgroundColor || "#fff";
    context.fillRect(0, 0, width, height);

    const panel = document.querySelector(".hero-panel");
    const photo = document.querySelector(".hero-photo");
    if (panel) paintBox(context, panel);
    if (photo) {
      const style = getComputedStyle(photo);
      const rect = photo.getBoundingClientRect();
      const url = style.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
      const original = photo.querySelector("img");
      const image = original?.complete && original.naturalWidth && (!url || original.src === url)
        ? original : await loadImage(url);
      context.save();
      context.globalAlpha = visibility(photo);
      context.beginPath();
      context.rect(rect.left, rect.top, rect.width, rect.height);
      context.clip();
      fillBackground(context, style, rect);
      if (image) {
        const size = style.backgroundSize === "contain"
          ? Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight)
          : Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
        const drawWidth = image.naturalWidth * size;
        const drawHeight = image.naturalHeight * size;
        const position = [style.backgroundPositionX, style.backgroundPositionY];
        const offset = (value, remaining) => value?.endsWith("%") ? remaining * parseFloat(value) / 100
          : value === "center" ? remaining / 2 : parseFloat(value) || 0;
        if (style.filter && style.filter !== "none") context.filter = style.filter;
        context.drawImage(image, rect.left + offset(position[0], rect.width - drawWidth),
          rect.top + offset(position[1], rect.height - drawHeight), drawWidth, drawHeight);
      }
      context.restore();
      paintPseudo(context, photo, "::before");
      paintPseudo(context, photo, "::after");
    }

    const bubbles = [...document.querySelectorAll(".bubble-field img")];
    const bubbleImages = await Promise.all(bubbles.map(image => image.complete && image.naturalWidth
      ? image : loadImage(image.currentSrc || image.src)));
    bubbles.forEach((element, index) => {
      const image = bubbleImages[index];
      const rect = element.getBoundingClientRect();
      if (!image || rect.bottom < 0 || rect.top > height) return;
      context.save();
      context.globalAlpha = visibility(element);
      context.drawImage(image, rect.left, rect.top, rect.width, rect.height);
      context.restore();
    });

    // Hero copy is above its decorative imagery. The navigation is above all
    // hero content, including the fixed bottom navigation on small screens.
    [...document.querySelectorAll(".hero-copy"), document.querySelector(".section-nav-top")]
      .filter(Boolean).forEach(container => {
        [container, ...container.querySelectorAll("*")].forEach(element => {
          // The moving indicator can still be transparent or between positions
          // when fonts settle. Capture the selected link's final pill instead.
          if (element.matches(".nav-active-indicator")) return;
          paintBox(context, element);
          if (container.matches(".section-nav-top") && element.matches("a.is-active")) {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            context.save();
            context.globalAlpha = visibility(element);
            roundedPath(context, rect, parseFloat(style.borderTopLeftRadius) || 0);
            context.fillStyle = "#11110f";
            context.fill();
            context.restore();
          }
          if (element.matches(".language-toggle")) paintPseudo(context, element, "::before");
        });
        paintText(context, container);
      });
    return canvas;
  }

  window.RainScene = { capture };
})();
