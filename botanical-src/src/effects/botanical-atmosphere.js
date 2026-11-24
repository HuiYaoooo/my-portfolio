import * as THREE from 'three';

const TAU = Math.PI * 2;
const fraction = value => value - Math.floor(value);
const seed = value => fraction(Math.sin(value * 127.1 + 311.7) * 43758.5453);

/** Independent pollen and travelling light ribbons; all coordinates are local
 * to the same stage as the botanical specimen, never painted on its material. */
export function createBotanicalAtmosphere({ flowerHeads = [], mobile = false } = {}) {
  const group = new THREE.Group();
  group.name = 'Botanical atmosphere — pollen and light ribbons';
  const count = mobile ? 48 : 64;
  const positions = new Float32Array(count * 3);
  const alphas = new Float32Array(count);
  const sizes = new Float32Array(count);
  const tints = new Float32Array(count);
  const particles = Array.from({ length: count }, (_, index) => {
    sizes[index] = (.047 + seed(index + 6) * .034) * 1.25;
    tints[index] = seed(index + 91);
    return {
      head: flowerHeads.length ? index % flowerHeads.length : 0,
      phase: seed(index + 4),
      speed: .073 + seed(index + 21) * .047,
      angle: seed(index + 48) * TAU,
      spread: .72 + seed(index + 73) * .56,
    };
  });
  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  particleGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1).setUsage(THREE.DynamicDrawUsage));
  particleGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  particleGeometry.setAttribute('aTint', new THREE.BufferAttribute(tints, 1));
  particleGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 4.1, 0), 5.8);
  const particleMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: { uPixelRatio: { value: Math.min(globalThis.devicePixelRatio || 1, mobile ? 1.5 : 1.8) } },
    vertexShader: `
      attribute float aAlpha;
      attribute float aSize;
      attribute float aTint;
      uniform float uPixelRatio;
      varying float vAlpha;
      varying float vTint;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        float perspective = 600.0 / max(2.0, -viewPosition.z);
        gl_PointSize = clamp(aSize * perspective * uPixelRatio, 1.2, 8.0 * uPixelRatio);
        gl_Position = projectionMatrix * viewPosition;
        vAlpha = aAlpha;
        vTint = aTint;
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      varying float vTint;
      void main() {
        float radius = length(gl_PointCoord - .5) * 2.0;
        if (radius > 1.0) discard;
        float glow = exp(-radius * radius * 4.8);
        float core = exp(-radius * radius * 25.0);
        float alpha = (glow * .52 + core * .48) * vAlpha;
        if (alpha < .008) discard;
        vec3 colour = mix(vec3(.31, .61, 1.12), vec3(.85, 1.04, 1.30), vTint);
        gl_FragColor = vec4(colour + core * .22, alpha);
      }
    `,
  });
  const pollen = new THREE.Points(particleGeometry, particleMaterial);
  pollen.name = 'Pollen — blue-white flower dust';
  pollen.frustumCulled = false;
  pollen.renderOrder = 2;
  group.add(pollen);

  // Four independent spatial paths alternate front/back depth. Staggered
  // highlights reveal their curves without turning them into solid white stems.
  const ribbonDefinitions = [
    { phase: .12, speed: .061, radius: .009, points: [
      [1.22, .52, .50], [1.02, 1.25, .82], [-.95, 2.18, .65],
      [-.78, 2.80, -.55], [.95, 3.50, -.85], [1.08, 4.55, .30],
      [-.85, 5.25, .75], [-.95, 6.15, -.35], [.70, 7.00, -.45], [.38, 8.08, .20],
    ] },
    { phase: .38, speed: .047, radius: .010, points: [
      [-1.35, .45, -.28], [-1.48, 1.38, -.72], [-.52, 2.28, -1.03],
      [1.38, 3.10, -.36], [1.50, 4.10, .62], [.25, 5.04, 1.03],
      [-1.34, 6.00, .50], [-1.10, 6.92, -.65], [-.18, 8.10, -.24],
    ] },
    { phase: .65, speed: .073, radius: .009, points: [
      [.52, .58, -1.02], [1.44, 1.55, -.72], [1.34, 2.50, .52],
      [.18, 3.35, 1.08], [-1.35, 4.20, .64], [-1.52, 5.22, -.38],
      [-.32, 6.12, -1.04], [1.30, 7.02, -.52], [.78, 8.02, .56],
    ] },
    { phase: .87, speed: .055, radius: .010, points: [
      [-.70, .48, .92], [.64, 1.30, 1.06], [1.58, 2.15, .05],
      [.68, 3.10, -.98], [-1.20, 4.04, -.83], [-1.40, 5.00, .30],
      [.10, 5.96, .98], [1.52, 6.95, .44], [.95, 8.04, -.62],
    ] },
  ];
  const ribbons = ribbonDefinitions.map((definition, index) => {
    const path = new THREE.CatmullRomCurve3(
      definition.points.map(point => new THREE.Vector3(...point)), false, 'catmullrom', .4,
    );
    const geometry = new THREE.TubeGeometry(path, 192, definition.radius, 5, false);
    const uniforms = { uTravel: { value: definition.phase }, uBreath: { value: 0 } };
    const material = new THREE.ShaderMaterial({
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTravel;
      uniform float uBreath;
      varying vec2 vUv;
      void main() {
        float distanceToHead = abs(vUv.x - uTravel);
        float head = exp(-pow(distanceToHead * 24.0, 2.0));
        float trail = (1.0 - smoothstep(0.0, .22, uTravel - vUv.x)) * step(vUv.x, uTravel);
        float fadeAtEnds = smoothstep(0.0, .035, vUv.x) * (1.0 - smoothstep(.965, 1.0, vUv.x));
        float light = max(head, trail * .44);
        vec3 colour = mix(vec3(.15, .36, .72), vec3(.62, 1.05, 1.72), light);
        float alpha = (.14 + light * .86) * (.9 + uBreath * .1) * fadeAtEnds;
        gl_FragColor = vec4(colour, alpha);
      }
    `,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `Light ribbon ${index + 1} — external rising curve`;
    mesh.renderOrder = 1;
    group.add(mesh);
    return { mesh, geometry, material, uniforms, phase: definition.phase, speed: definition.speed };
  });

  const enabled = { pollen: true, ribbon: true };
  group.userData = {
    effect: 'botanical-atmosphere', pollenCount: count, ribbonCount: ribbons.length,
    ribbonSegments: 192, enabled, phase: 0, travel: .12,
    phases: ribbons.map(ribbon => ribbon.phase),
  };
  const inverseStage = new THREE.Matrix4();
  const headMatrix = new THREE.Matrix4();
  const target = new THREE.Vector3();
  const emitters = flowerHeads.map(() => ({
    position: new THREE.Vector3(), normal: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(), hover: 0,
  }));
  let localTime = 0;
  let disposed = false;

  function hoverIndex(value) {
    if (Number.isInteger(value)) return value;
    for (let object = value; object; object = object.parent) {
      const index = flowerHeads.indexOf(object);
      if (index !== -1) return index;
    }
    return -1;
  }

  function update(_time, delta = 0, { playing = true, hoveredFlower = null } = {}) {
    if (disposed) return;
    const dt = Math.min(.12, Math.max(0, delta));
    if (playing) localTime += dt;
    for (let index = 0; index < ribbons.length; index++) {
      const ribbon = ribbons[index];
      ribbon.uniforms.uTravel.value = fraction(ribbon.phase + localTime * ribbon.speed);
      ribbon.uniforms.uBreath.value = Math.sin(localTime * .63 + index * 1.7);
      group.userData.phases[index] = ribbon.uniforms.uTravel.value;
    }
    group.userData.phase = localTime;
    group.userData.travel = group.userData.phases[0];
    if (!enabled.pollen || !flowerHeads.length) return;
    group.parent?.updateWorldMatrix(true, false);
    inverseStage.copy(group.parent?.matrixWorld || group.matrixWorld).invert();
    const hovered = hoverIndex(hoveredFlower);
    for (let index = 0; index < flowerHeads.length; index++) {
      const flower = flowerHeads[index], emitter = emitters[index];
      flower.updateWorldMatrix(true, false);
      headMatrix.multiplyMatrices(inverseStage, flower.matrixWorld);
      emitter.position.set(0, 0, .035).applyMatrix4(headMatrix);
      emitter.normal.set(0, 0, 1).transformDirection(headMatrix);
      emitter.right.set(1, 0, 0).transformDirection(headMatrix);
      emitter.up.set(0, 1, 0).transformDirection(headMatrix);
      if (playing) emitter.hover = THREE.MathUtils.lerp(emitter.hover, index === hovered ? 1 : 0, 1 - Math.exp(-dt * 5));
    }
    for (let index = 0; index < count; index++) {
      const particle = particles[index], emitter = emitters[particle.head];
      const life = fraction(particle.phase + localTime * particle.speed);
      const angle = particle.angle + localTime * .17;
      const spread = (.025 + life * .31) * particle.spread;
      target.copy(emitter.position)
        .addScaledVector(emitter.normal, .045 + life * .29)
        .addScaledVector(emitter.right, Math.cos(angle) * spread)
        .addScaledVector(emitter.up, Math.sin(angle) * spread * .75);
      target.y += life * .46;
      target.x += Math.sin(localTime * .31 + particle.angle) * life * .08;
      target.toArray(positions, index * 3);
      alphas[index] = Math.pow(Math.sin(life * Math.PI), 1.1) * (.55 + emitter.hover * .15);
    }
    particleGeometry.attributes.position.needsUpdate = true;
    particleGeometry.attributes.aAlpha.needsUpdate = true;
  }

  function setEnabled(name, value) {
    if (!(name in enabled)) return;
    enabled[name] = Boolean(value);
    if (name === 'pollen') pollen.visible = enabled.pollen;
    else ribbons.forEach(ribbon => { ribbon.mesh.visible = enabled.ribbon; });
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    group.removeFromParent();
    particleGeometry.dispose();
    particleMaterial.dispose();
    ribbons.forEach(ribbon => {
      ribbon.geometry.dispose();
      ribbon.material.dispose();
    });
    group.clear();
  }

  update(0, 0);
  return { group, update, setEnabled, dispose };
}
