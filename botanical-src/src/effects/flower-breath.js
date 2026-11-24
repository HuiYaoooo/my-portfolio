/**
 * A small opening motion confined to the continuous trumpet corollas.
 * Each petal mesh owns a private geometry copy; the authored mesh, materials,
 * throat, sepals, leaves and vase stay unchanged and can be restored exactly.
 */
export function createFlowerBreath({ flowerHeads = [] } = {}) {
  const petals = [];
  let enabled = true;
  let disposed = false;
  let elapsed = 1;
  const stats = {
    enabled: true,
    petalMeshes: 0,
    vertexCount: 0,
    updatedFrames: 0,
    phase: 0,
    maxDisplacement: 0,
    amplitude: .028,
  };

  for (const [index, head] of flowerHeads.entries()) {
    // The author gives each unmerged, single-material corolla this semantic
    // name. Do not use aPart=3 alone: pistils share that attribute value.
    const mesh = head.getObjectByName('Continuous five-lobed trumpet corolla');
    const original = mesh?.geometry;
    const position = original?.getAttribute('position');
    const uv = original?.getAttribute('uv');
    if (!mesh?.isMesh || !position || !uv) continue;
    const geometry = original.clone();
    mesh.geometry = geometry;
    geometry.computeBoundingSphere();
    geometry.boundingSphere.radius *= 1.065;
    geometry.computeBoundingBox();
    geometry.boundingBox.expandByScalar((head.userData.radius || .35) * .065);
    const weights = new Float32Array(position.count);
    const lobes = new Float32Array(position.count);
    const seed = head.userData.seed ?? index * .73;
    for (let i = 0; i < position.count; i++) {
      // Zero at the throat and strongly weighted toward the outer petal rim.
      weights[i] = Math.pow(Math.max(0, Math.min(1, uv.getY(i))), 2.4);
      lobes[i] = .88 + .12 * Math.cos(uv.getX(i) * Math.PI * 10 + seed * .12);
    }
    const normals = original.getAttribute('normal');
    petals.push({
      head, mesh, original, geometry,
      source: new Float32Array(position.array),
      normals: normals ? new Float32Array(normals.array) : null,
      weights, lobes, seed,
      radius: head.userData.radius || .35,
      hover: 0,
    });
    stats.vertexCount += position.count;
  }
  stats.petalMeshes = petals.length;

  function restore() {
    for (const petal of petals) {
      const position = petal.geometry.getAttribute('position');
      position.array.set(petal.source);
      position.needsUpdate = true;
      const normal = petal.geometry.getAttribute('normal');
      if (normal && petal.normals) {
        normal.array.set(petal.normals);
        normal.needsUpdate = true;
      }
      petal.hover = 0;
    }
    stats.maxDisplacement = 0;
  }

  function containsHoveredFlower(head, candidate) {
    let object = candidate;
    while (object?.isObject3D) {
      if (object === head) return true;
      object = object.parent;
    }
    return false;
  }

  function update(time, delta, { playing = true, hoveredFlower = null } = {}) {
    if (disposed || !enabled || !playing) return;
    elapsed += Math.max(0, Number.isFinite(delta) ? delta : 1 / 60);
    // Updating positions and true smooth normals at 24Hz keeps this subtle
    // organic motion inexpensive while the main renderer can run at 60Hz.
    if (elapsed < 1 / 24) return;
    const step = Math.min(elapsed, .15);
    elapsed = 0;
    let largest = 0;
    for (const petal of petals) {
      const hoverTarget = containsHoveredFlower(petal.head, hoveredFlower) ? 1 : 0;
      petal.hover += (hoverTarget - petal.hover) * (1 - Math.exp(-step / .45));
      const amplitude = .028 + petal.hover * .018;
      const breath = Math.sin(time * (Math.PI * 2 / 9.5) + petal.seed * .42) * amplitude;
      const position = petal.geometry.getAttribute('position');
      const target = position.array;
      for (let i = 0; i < petal.weights.length; i++) {
        const j = i * 3;
        const opening = breath * petal.weights[i] * petal.lobes[i];
        const x = petal.source[j] * (1 + opening);
        const y = petal.source[j + 1] * (1 + opening);
        // The rim gently uncups as it opens. Inner and outer shell vertices
        // use identical UV weights so the thin shell retains its thickness.
        const z = petal.source[j + 2] + opening * petal.radius * .26;
        target[j] = x; target[j + 1] = y; target[j + 2] = z;
        largest = Math.max(largest, Math.abs(x - petal.source[j]), Math.abs(y - petal.source[j + 1]), Math.abs(z - petal.source[j + 2]));
      }
      position.needsUpdate = true;
      petal.geometry.computeVertexNormals();
    }
    stats.phase = time;
    stats.updatedFrames++;
    stats.maxDisplacement = largest;
  }

  function setEnabled(value) {
    if (disposed) return;
    enabled = Boolean(value);
    stats.enabled = enabled;
    elapsed = 1;
    if (!enabled) restore();
  }

  function dispose() {
    if (disposed) return;
    restore();
    for (const petal of petals) {
      if (petal.mesh.geometry === petal.geometry) petal.mesh.geometry = petal.original;
      petal.geometry.dispose();
    }
    disposed = true;
    stats.enabled = false;
  }

  return { update, setEnabled, dispose, stats };
}
