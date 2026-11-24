import * as THREE from 'three';

const COPY = {
  en: 'TO BE A CREATIVE AI PRODUCT BUILDER',
  zh: '成为富有创造力的 AI 产品构建者',
};

/** A complete tilted text orbit, independent of every botanical material. */
export function createOrbitText({
  fontFamily = '"Geist Sans", "PingFang SC", "Microsoft YaHei", sans-serif',
  mobile = false,
  language = 'en',
} = {}) {
  const group = new THREE.Group();
  group.name = '45-degree full text orbit';
  group.userData.effect = 'orbit-text';
  group.userData.enabled = true;
  group.userData.opacity = .7;
  group.userData.fontFamily = fontFamily;
  const radius = mobile ? 2.2 : 2.9;
  const centerY = 3.65;
  const repeats = mobile ? 2 : 3;
  // The orbit's long axis rises 45 degrees across the screen. Its plane also
  // recedes into real depth, so the far half passes behind the specimen.
  const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(55), 0, THREE.MathUtils.degToRad(45), 'ZYX',
  ));
  const spin = new THREE.Quaternion();
  const glyphHeight = mobile ? .29 : .31;
  const glyphWidth = glyphHeight * 160 / 192;
  const waveCycles = 2;
  const waveAmplitude = mobile ? .18 : .23;
  const waveSpeed = .8;
  const waveStep = 1 / 30;
  let locale = language === 'zh' ? 'zh' : 'en';
  let atlas = null;
  let phase = 0;
  let waveElapsed = 0;
  let glyphLayout = [];
  let disposed = false;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uAtlas: { value: null },
      uColor: { value: new THREE.Color('#c6defa') },
      uOpacity: { value: .7 },
    },
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    vertexShader: `
      attribute float glyphAlpha;
      varying vec2 vUv;
      varying float vAlpha;
      void main(){
        vUv=uv;
        vAlpha=glyphAlpha;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uAtlas;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      varying float vAlpha;
      void main(){
        float alpha=texture2D(uAtlas,vUv).a*vAlpha*uOpacity;
        if(alpha<.025)discard;
        gl_FragColor=vec4(uColor,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  // Shared by the scene's custom Bokeh depth pass, with the same glyph cutout.
  const depthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    side: THREE.DoubleSide,
    alphaTest: .05,
    depthTest: true,
    depthWrite: true,
  });
  const letters = new THREE.Mesh(new THREE.BufferGeometry(), material);
  letters.name = 'Independent three-dimensional tagline glyphs';
  letters.frustumCulled = false;
  letters.userData.effect = 'orbit-text';
  letters.userData.hoverable = true;
  group.add(letters);

  const orbitPoint = (theta, r = radius) => new THREE.Vector3(Math.cos(theta) * r, Math.sin(theta) * r, 0);
  const baseline = new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 160 }, (_, i) => orbitPoint(Math.PI * 2 * i / 160, radius - .19)),
  );
  baseline.getAttribute('position').setUsage(THREE.DynamicDrawUsage);
  const baselineMaterial = new THREE.LineBasicMaterial({
    color: '#7095be', transparent: true, opacity: .14,
    depthTest: true, depthWrite: false, toneMapped: false,
  });
  const guide = new THREE.LineLoop(baseline, baselineMaterial);
  guide.name = 'Faint complete tilted orbital guide';
  guide.userData.excludeFromDepthPass = true;
  group.add(guide);

  const inverseOrbit = new THREE.Quaternion();
  const vertical = new THREE.Vector3();
  const center = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const up = new THREE.Vector3();
  const corner = new THREE.Vector3();
  const spinAxis = new THREE.Vector3(0, 0, 1);

  function updateWave() {
    // Undo the tilted orbit so displacement remains vertically up/down in the
    // scene, instead of normal to the ring. Each glyph stays a rigid rectangle.
    inverseOrbit.copy(group.quaternion).invert();
    vertical.set(0, 1, 0).applyQuaternion(inverseOrbit);
    const wavePhase = phase * waveSpeed;
    const positions = letters.geometry.getAttribute('position');
    for (const { theta, first } of glyphLayout) {
      const waveAngle = theta * waveCycles - wavePhase;
      const height = Math.sin(waveAngle) * waveAmplitude;
      const slope = -Math.cos(waveAngle) * waveAmplitude * waveCycles / radius;
      center.set(Math.cos(theta) * radius, Math.sin(theta) * radius, 0)
        .addScaledVector(vertical, height);
      tangent.set(Math.sin(theta), -Math.cos(theta), 0)
        .addScaledVector(vertical, slope).normalize();
      up.set(Math.cos(theta), Math.sin(theta), 0);
      up.addScaledVector(tangent, -up.dot(tangent)).normalize();
      for (let i = 0; i < 4; i++) {
        const cx = i === 0 || i === 3 ? -.5 : .5;
        const cy = i < 2 ? -.5 : .5;
        corner.copy(center).addScaledVector(tangent, cx * glyphWidth)
          .addScaledVector(up, cy * glyphHeight);
        positions.setXYZ(first + i, corner.x, corner.y, corner.z);
      }
    }
    positions.needsUpdate = true;
    letters.geometry.computeVertexNormals();
    letters.geometry.computeBoundingBox();
    letters.geometry.computeBoundingSphere();

    const guidePositions = baseline.getAttribute('position');
    for (let i = 0; i < guidePositions.count; i++) {
      const theta = Math.PI * 2 * i / guidePositions.count;
      center.set(Math.cos(theta) * (radius - .19), Math.sin(theta) * (radius - .19), 0)
        .addScaledVector(vertical, Math.sin(theta * waveCycles - wavePhase) * waveAmplitude);
      guidePositions.setXYZ(i, center.x, center.y, center.z);
    }
    guidePositions.needsUpdate = true;
    baseline.computeBoundingBox();
    baseline.computeBoundingSphere();
    group.userData.waveCycles = waveCycles;
    group.userData.waveAmplitude = waveAmplitude;
    group.userData.wavePhase = wavePhase;
    group.userData.bounds = {
      min: letters.geometry.boundingBox.min.toArray(),
      max: letters.geometry.boundingBox.max.toArray(),
    };
  }

  function rebuild() {
    if (disposed) return;
    const text = Array.from({length:repeats},()=>COPY[locale]).join(' · ') + ' · ';
    const characters = [...text];
    const unique = [...new Set(characters.filter(character => character !== ' '))];
    const columns = 8, cellWidth = 160, cellHeight = 192;
    const rows = Math.ceil(unique.length / columns);
    const canvas = document.createElement('canvas');
    canvas.width = columns * cellWidth;
    canvas.height = rows * cellHeight;
    const ctx = canvas.getContext('2d');
    ctx.font = `400 128px ${fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff';
    unique.forEach((character, index) => {
      ctx.fillText(character, (index % columns + .5) * cellWidth, Math.floor(index / columns) * cellHeight + 139);
    });
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 4;

    const positions = [], uvs = [], alphas = [], indices = [];
    glyphLayout = [];
    const widths = characters.map(character => character === ' ' ? .34 : locale === 'zh' && /[^\x00-\x7f]/.test(character) ? 1 : Math.max(.24,ctx.measureText(character).width/128)+.09);
    const total = widths.reduce((sum, width) => sum + width, 0);
    let distance = 0;
    characters.forEach((character, index) => {
      const progress = (distance + widths[index] / 2) / total;
      const theta = Math.PI / 2 - progress * Math.PI * 2;
      distance += widths[index];
      if (character === ' ') return;
      const at = orbitPoint(theta);
      tangent.set(Math.sin(theta),-Math.cos(theta),0);
      up.set(Math.cos(theta),Math.sin(theta),0);
      const glyph = unique.indexOf(character);
      const x = glyph % columns, y = Math.floor(glyph / columns);
      const left = x / columns, right = (x + 1) / columns;
      const top = 1 - y / rows, bottom = 1 - (y + 1) / rows;
      const first = positions.length / 3;
      glyphLayout.push({ theta, first });
      for (const [cx, cy] of [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]]) {
        corner.copy(at).addScaledVector(tangent,cx*glyphWidth).addScaledVector(up,cy*glyphHeight);
        positions.push(corner.x, corner.y, corner.z);
        alphas.push(1);
      }
      uvs.push(left, bottom, right, bottom, right, top, left, top);
      indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.getAttribute('position').setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('glyphAlpha', new THREE.Float32BufferAttribute(alphas, 1));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const previousGeometry = letters.geometry;
    letters.geometry = geometry;
    previousGeometry.dispose();
    material.uniforms.uAtlas.value = texture;
    depthMaterial.map = texture;
    depthMaterial.needsUpdate = true;
    atlas?.dispose();
    atlas = texture;
    group.userData.language = locale;
    group.userData.text = COPY[locale];
    group.userData.fullCircle = true;
    group.userData.tiltDegrees = 45;
    group.userData.repeats = repeats;
    group.userData.radius = radius;
    group.userData.glyphCount = characters.filter(character => character !== ' ').length;
    updateWave();
  }

  group.position.y = centerY;
  group.quaternion.copy(tilt);
  rebuild();
  // Rebuild once the existing local font is ready; never fetch a remote font.
  document.fonts?.load(`400 128px ${fontFamily.split(',')[0]}`).then(() => {
    if (!disposed) rebuild();
  }).catch(() => {});

  return {
    group,
    letters,
    guide,
    depthMaterial,
    update(_time, delta = 1 / 60, { playing = true, hovered = false } = {}) {
      if (disposed || !group.visible) return;
      const advancing = playing && !hovered;
      if (advancing) {
        const step = Math.min(.12, Math.max(0, delta));
        phase += step;
        waveElapsed += step;
      }
      spin.setFromAxisAngle(spinAxis,phase*.09);
      group.quaternion.copy(tilt).multiply(spin);
      group.position.y = centerY;
      if (advancing && waveElapsed >= waveStep) {
        updateWave();
        waveElapsed %= waveStep;
      }
      group.userData.orbitAngle = phase*.09;
      group.userData.hovered = hovered;
      group.userData.phase = phase;
    },
    setEnabled(value) {
      group.visible = Boolean(value);
      group.userData.enabled = Boolean(value);
    },
    setLanguage(value) {
      const next = value === 'zh' ? 'zh' : 'en';
      if (next !== locale) { locale = next; rebuild(); }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      letters.geometry.dispose();
      material.dispose();
      depthMaterial.dispose();
      atlas?.dispose();
      baseline.dispose();
      baselineMaterial.dispose();
      group.clear();
    },
  };
}
