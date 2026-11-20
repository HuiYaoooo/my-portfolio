import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Botanical study: all visible plant parts are three-dimensional meshes.
// Positive Z is the principal viewing side. The urn rests on Y = 0.
const V = (x, y, z = 0) => new THREE.Vector3(x, y, z);
const Z = new THREE.Vector3(0, 0, 1);
const TAU = Math.PI * 2;

function compactMeshes(parent) {
  const batches = new Map();
  for (const child of [...parent.children]) {
    if (!child.isMesh) continue;
    const batch = batches.get(child.material) || [];
    batch.push(child);
    batches.set(child.material, batch);
  }
  for (const [material, meshes] of batches) {
    if (meshes.length < 2) continue;
    const geometries = meshes.map(mesh => {
      mesh.updateMatrix();
      return mesh.geometry.clone().applyMatrix4(mesh.matrix);
    });
    const combined = mergeGeometries(geometries, false);
    geometries.forEach(geometry => geometry.dispose());
    if (!combined) continue;
    const batch = new THREE.Mesh(combined, material);
    batch.castShadow = true;
    batch.receiveShadow = true;
    batch.name = meshes[0].name || 'Batched botanical mesh';
    meshes.forEach(mesh => {
      parent.remove(mesh);
      mesh.geometry.dispose();
    });
    parent.add(batch);
  }
}

function part(geometry, value) {
  geometry.setAttribute('aPart', new THREE.Float32BufferAttribute(
    new Float32Array(geometry.getAttribute('position').count).fill(value), 1,
  ));
  return geometry;
}

function tube(points, radius = 0.018, segments = 48, radialSegments = 7) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => Array.isArray(p) ? V(...p) : p));
  return part(new THREE.TubeGeometry(curve, segments, radius, radialSegments, false), 1);
}

function trumpetGeometry(radius, depth, phase = 0) {
  const around = 80;
  const along = 25;
  const positions = [], uvs = [], indices = [];
  // A continuous, five-fold trumpet. A long neck opens into a cupped, softly
  // pleated corolla; this is deliberately not five intersecting flat petals.
  for (let j = 0; j <= along; j++) {
    const t = j / along;
    const open = THREE.MathUtils.smoothstep(t, 0.09, 1);
    const ringRadius = radius * (0.055 + 0.945 * Math.pow(open, 1.36));
    for (let i = 0; i <= around; i++) {
      const u = i / around;
      const a = u * TAU;
      const lobe = Math.cos(a * 5 + phase);
      const rim = Math.pow(t, 6);
      const r = ringRadius * (1 + 0.068 * lobe * t * t + 0.014 * Math.sin(a * 15 + phase) * rim);
      const z = -depth * Math.pow(1 - t, 1.45)
        + radius * 0.059 * lobe * t * t
        + radius * 0.014 * Math.sin(a * 35 + phase) * rim
        - radius * 0.06 * Math.pow(t, 12);
      positions.push(Math.cos(a) * r, Math.sin(a) * r, z);
      uvs.push(u, t);
    }
  }
  for (let j = 0; j < along; j++) {
    for (let i = 0; i < around; i++) {
      const a = j * (around + 1) + i;
      const b = a + around + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  // An actual paper-thin shell supplies a readable edge at oblique angles.
  const outer = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const baseCount = outer.count;
  const shellPositions = [...positions];
  const shellUvs = [...uvs];
  const shellIndices = [...indices];
  for (let i = 0; i < baseCount; i++) {
    shellPositions.push(
      outer.getX(i) - normals.getX(i) * 0.006,
      outer.getY(i) - normals.getY(i) * 0.006,
      outer.getZ(i) - normals.getZ(i) * 0.006,
    );
    shellUvs.push(uvs[i * 2], uvs[i * 2 + 1]);
  }
  for (let i = 0; i < indices.length; i += 3) {
    shellIndices.push(indices[i + 2] + baseCount, indices[i + 1] + baseCount, indices[i] + baseCount);
  }
  for (let i = 0; i < around; i++) {
    const a = along * (around + 1) + i;
    shellIndices.push(a, a + baseCount, a + 1, a + 1, a + baseCount, a + baseCount + 1);
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(shellPositions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(shellUvs, 2));
  geometry.setIndex(shellIndices);
  geometry.deleteAttribute('normal');
  geometry.computeVertexNormals();
  return part(geometry, 3);
}

function leafGeometry(length, width, seed) {
  const positions = [0, length * 0.39, 0.025];
  const uvs = [0.5, 0.39];
  const indices = [];
  const rings = 9, around = 48;
  // Heart-shaped outline with a basal notch, two rounded shoulders and a tip.
  // Intermediate rings cup around a raised midrib rather than lying flat.
  for (let ring = 1; ring <= rings; ring++) {
    const r = ring / rings;
    for (let i = 0; i <= around; i++) {
      const a = i / around * TAU;
      const bx = Math.pow(Math.sin(a), 3) * width * 0.5;
      const heartY = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
      const by = (5 - heartY) / 22 * length;
      const x = bx * r;
      const y = length * 0.39 + (by - length * 0.39) * r;
      const z = 0.045 * Math.sin(y / length * Math.PI)
        - Math.abs(x / width) * 0.10
        + 0.014 * Math.sin(a * 5 + seed) * r * r;
      positions.push(x, y, z);
      uvs.push(x / width + 0.5, y / length);
    }
  }
  for (let i = 0; i < around; i++) indices.push(0, 1 + i, 2 + i);
  for (let ring = 0; ring < rings - 1; ring++) {
    const start = 1 + ring * (around + 1);
    for (let i = 0; i < around; i++) {
      const a = start + i, b = a + around + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return part(geometry, 2);
}

function defaultMaterials() {
  return {
    petal: new THREE.MeshStandardMaterial({ color: '#8a9edc', side: THREE.DoubleSide, roughness: 0.47, metalness: 0.05 }),
    leaf: new THREE.MeshStandardMaterial({ color: '#3b605e', side: THREE.DoubleSide, roughness: 0.63, metalness: 0.12 }),
    stem: new THREE.MeshStandardMaterial({ color: '#445852', roughness: 0.56, metalness: 0.18 }),
    pot: new THREE.MeshStandardMaterial({ color: '#0b203e', roughness: 0.21, metalness: 0.38, side: THREE.DoubleSide }),
    detail: new THREE.MeshStandardMaterial({ color: '#a7b6a5', roughness: 0.58, metalness: 0.15 }),
  };
}

export function createMorningGlory({ materials = {} } = {}) {
  const mat = { ...defaultMaterials(), ...materials };
  const group = new THREE.Group();
  group.name = 'Morning glory — porcelain botanical study';
  const plant = new THREE.Group();
  plant.name = 'Living vine';
  group.add(plant);
  const flowerHeads = [];
  const moving = [];

  function addMesh(geometry, material, parent = plant) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // Revolved urn, complete with inner wall, rim, stem and a broad small foot.
  const profile = [
    [0, 0.015], [.27, .015], [.34, .045], [.35, .082], [.31, .13], [.19, .18],
    [.105, .24], [.095, .32], [.13, .40], [.24, .49], [.35, .64], [.42, .83],
    [.47, 1.06], [.51, 1.31], [.555, 1.47], [.60, 1.51], [.605, 1.55],
    [.575, 1.575], [.545, 1.545], [.53, 1.46], [.485, 1.30], [.44, 1.08],
    [.39, .87], [.32, .68], [.20, .56], [.12, .53], [0, .53],
  ].map(p => new THREE.Vector2(...p));
  const urn = addMesh(part(new THREE.LatheGeometry(profile, 100), 0), mat.pot, group);
  urn.name = 'Hollow glazed porcelain urn';
  const lip = addMesh(part(new THREE.TorusGeometry(.577, .022, 8, 100), 0), mat.pot, group);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = 1.545;
  const foot = addMesh(part(new THREE.TorusGeometry(.31, .014, 7, 80), 0), mat.pot, group);
  foot.rotation.x = Math.PI / 2;
  foot.position.y = .10;
  const soil = addMesh(part(new THREE.CylinderGeometry(.52, .50, .04, 48), 0), new THREE.MeshStandardMaterial({ color: '#071816', roughness: .98 }), group);
  soil.position.y = 1.435;

  const mainPoints = [
    [0, 1.43, 0], [-.04, 1.9, .02], [-.28, 2.45, -.02], [-.10, 2.95, .06],
    [-.02, 3.48, -.02], [.29, 4.04, .0], [.10, 4.64, -.10], [-.42, 5.05, -.04],
    [-.22, 5.50, .06], [-.51, 5.94, -.04], [-.38, 6.34, -.12], [-.20, 6.70, -.04],
    [-.43, 7.06, .02], [-.31, 7.48, -.06], [-.25, 7.88, -.05], [-.38, 8.03, -.10],
  ];
  addMesh(tube(mainPoints, .022, 180, 8), mat.stem).name = 'Ascending S-shaped stem';
  const sideBranches = [
    [[-.10, 3.25, .03], [.10, 3.7, -.04], [.30, 4.13, -.12], [.90, 4.60, -.14], [1.42, 4.48, .14], [1.90, 4.54, -.12], [2.24, 4.45, .05]],
    [[0, 1.45, -.03], [-.36, 2.0, -.03], [-.74, 2.30, .03], [-1.15, 2.17, .10], [-1.32, 1.58, .05], [-1.24, .89, .06], [-.84, .46, .09], [-.30, .48, .03]],
    [[.02, 1.48, -.1], [.35, 2.0, -.12], [.85, 2.28, -.12], [1.24, 2.07, -.02], [1.28, 1.58, .06], [1.06, 1.04, .03], [.80, .82, -.02], [.60, 1.0, 0]],
    [[-.12, 2.95, .04], [-.58, 3.42, .10], [-.67, 3.93, -.03], [-.4, 4.29, .05]],
    [[-.35, 5.10, .03], [-.68, 5.33, .06], [-1.02, 5.18, .12]],
  ];
  sideBranches.forEach((points, i) => {
    addMesh(tube(points, i === 0 ? .014 : .016, 85, 7), mat.stem);
  });

  function addLeaf(at, direction, length, width, roll, seed) {
    const holder = new THREE.Group();
    holder.position.copy(V(...at));
    const d = V(...direction).normalize();
    holder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    holder.rotateY(roll);
    const mesh = addMesh(leafGeometry(length, width, seed), mat.leaf, holder);
    mesh.name = 'Cupped heart-shaped leaf';
    const veinPoints = [V(0, 0, .004), V(0, length * .3, .05), V(0, length * .67, .046), V(0, length * .98, .003)];
    addMesh(tube(veinPoints, .0048, 15, 4), mat.stem, holder);
    for (const s of [-1, 1]) {
      for (let j = 0; j < 3; j++) {
        const y = length * (.23 + j * .17);
        const spread = width * (.36 - j * .055) * s;
        addMesh(tube([V(0, y, .049), V(spread * .55, y + length * .06, .025), V(spread, y + length * .10, -.025)], .0024, 8, 3), mat.stem, holder);
      }
    }
    compactMeshes(holder);
    plant.add(holder);
    moving.push({ object: holder, rotation: holder.rotation.clone(), seed, amount: .008 });
    return holder;
  }

  // Deliberately uneven placement preserves the reference's botanical silhouette.
  const leaves = [
    [[-.08,1.46,.02],[-.35,1,.45],.63,.55,-.3],
    [[.10,1.59,-.02],[.65,.65,.15],.48,.42,.7],
    [[-.24,1.80,.05],[-.85,.45,.2],.60,.56,.12],
    [[-.04,2.0,.07],[.15,.95,.4],.57,.47,-.30],
    [[.52,2.14,-.05],[.65,.55,.4],.50,.43,.3],
    [[-.63,2.30,.08],[-.9,.35,.15],.42,.37,-.2],
    [[-1.22,1.64,.08],[-.8,-.3,.1],.42,.32,.3],
    [[-1.20,1.05,.06],[.65,.3,.3],.39,.35,-.4],
    [[-.73,.48,.08],[.2,-.75,.4],.36,.31,1.0],
    [[1.12,1.06,.02],[.75,.1,.2],.32,.25,-.8],
    [[1.23,1.72,.05],[.6,.45,.4],.38,.31,.1],
    [[-.23,2.63,.06],[-.7,.55,.3],.50,.42,.3],
    [[-.1,2.98,.05],[.5,.6,.4],.39,.34,-.6],
    [[-.61,3.51,.08],[-.75,.5,.2],.43,.36,-.3],
    [[-.64,3.81,.02],[.75,.4,-.1],.35,.31,.5],
    [[.22,3.96,-.02],[.65,.5,.3],.39,.34,.4],
    [[.68,4.47,-.11],[-.30,.9,.35],.35,.33,-.3],
    [[1.15,4.54,.03],[.34,.8,-.12],.32,.29,.6],
    [[1.70,4.51,-.02],[.5,.65,.22],.29,.25,-.35],
    [[.08,4.69,-.08],[.7,.4,.15],.38,.32,.9],
    [[-.35,5.09,0],[-.85,.35,.05],.42,.35,.3],
    [[-.29,5.41,.02],[.2,.95,.3],.35,.31,-.2],
    [[-.48,5.88,-.03],[-.6,.5,.15],.34,.30,.3],
    [[-.28,6.58,-.02],[.6,.8,.1],.33,.29,-.5],
    [[-.43,7.0,.03],[.45,-.7,.3],.32,.28,.4],
    [[-.29,7.45,-.04],[-.75,.3,.2],.27,.25,-.3],
    [[-.3,7.85,-.06],[-.4,.8,.15],.25,.18,-.5],
  ];
  leaves.forEach((data, i) => addLeaf(...data, i * .81));

  function addFlower(attachment, position, radius, normal, seed) {
    const holder = new THREE.Group();
    const center = V(...position);
    const n = V(...normal).normalize();
    const depth = radius * 1.06;
    holder.position.copy(center);
    holder.quaternion.setFromUnitVectors(Z, n);
    const corolla = addMesh(trumpetGeometry(radius, depth, seed * .12), mat.petal, holder);
    corolla.name = 'Continuous five-lobed trumpet corolla';
    // The pedicel reaches the back of the flower tube, not the flower centre.
    const throat = center.clone().addScaledVector(n, -depth - .035);
    const start = V(...attachment);
    const mid = start.clone().lerp(throat, .6).add(V(-.025, .06, -.04));
    addMesh(tube([start, mid, throat], .010, 22, 6), mat.stem);
    const calyx = addMesh(part(new THREE.ConeGeometry(radius * .105, radius * .36, 7), 1), mat.stem, holder);
    calyx.rotation.x = Math.PI / 2;
    calyx.position.z = -depth + radius * .02;
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU + seed;
      const sepal = addMesh(part(new THREE.ConeGeometry(radius * .035, radius * .31, 4), 1), mat.stem, holder);
      sepal.position.set(Math.cos(a) * radius * .08, Math.sin(a) * radius * .08, -depth + radius * .1);
      sepal.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), V(Math.cos(a) * .4, Math.sin(a) * .4, 1).normalize());
    }
    const pistil = addMesh(part(new THREE.CylinderGeometry(.006, .008, depth * .38, 6), 3), mat.detail, holder);
    pistil.rotation.x = Math.PI / 2;
    pistil.position.z = -depth * .76;
    const stigma = addMesh(part(new THREE.SphereGeometry(radius * .022, 8, 6), 3), mat.detail, holder);
    stigma.position.z = -depth * .56;
    holder.userData.radius = radius;
    holder.userData.seed = seed;
    holder.userData.baseQuaternion = holder.quaternion.clone();
    holder.name = `Morning glory ${flowerHeads.length + 1}`;
    compactMeshes(holder);
    plant.add(holder);
    flowerHeads.push(holder);
    return holder;
  }

  const flowers = [
    [[-.29,7.63,-.05],[.04,7.84,.07],.258,[.16,.19,1]],
    [[-.38,7.12,.03],[-.66,7.02,.19],.312,[-.28,.16,1]],
    [[-.39,5.66,.01],[.28,5.48,.16],.335,[.86,.15,.46]],
    [[-.98,5.19,.12],[-1.20,5.11,.19],.29,[-.6,.1,.86]],
    [[.08,4.58,-.08],[-.18,4.48,.30],.405,[-.14,.13,1]],
    [[1.69,4.51,-.02],[1.95,4.78,.09],.29,[.8,.2,.60]],
    [[.17,3.93,.03],[.72,3.77,.25],.365,[.28,.07,1]],
    [[-.57,3.45,.10],[-.83,3.29,.18],.29,[-.91,.11,.42]],
    [[-.08,3.03,.06],[-.04,3.05,.22],.29,[.90,-.22,.38]],
    [[-.25,2.62,.06],[-.48,2.66,.36],.405,[-.04,.13,1]],
    [[.84,2.26,-.1],[1.01,2.40,.17],.355,[.29,.09,1]],
    [[-1.06,2.20,.10],[-1.42,2.17,.18],.335,[-.28,.22,1]],
    [[1.25,1.82,.06],[1.53,1.67,.14],.265,[.94,-.18,.30]],
    [[-1.28,1.37,.06],[-1.16,1.15,.21],.28,[-.27,.06,1]],
    [[-.80,.47,.09],[-.48,.55,.24],.315,[-.1,.14,1]],
    [[-1.25,.94,.06],[-1.70,1.02,.10],.22,[-.74,-.12,.66]],
  ];
  flowers.forEach((data, i) => addFlower(...data, i * .73));

  function addBud(at, toward, size = .16) {
    const bud = new THREE.Group();
    bud.position.copy(V(...at));
    bud.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), V(...toward).normalize());
    const profile = [[0,0],[.028,.03],[size*.31,size*.37],[size*.34,size*.72],[size*.18,size],[0,size*1.15]].map(p => new THREE.Vector2(...p));
    addMesh(part(new THREE.LatheGeometry(profile, 14), 2), mat.leaf, bud);
    plant.add(bud);
  }
  addBud([-.41,8.0,-.08],[-.3,.8,.1],.19);
  addBud([-.44,5.92,-.02],[.45,.85,.15],.22);
  addBud([2.17,4.47,.03],[.8,.3,-.1],.16);
  addBud([.63,1.0,0],[-.4,.8,.2],.15);

  // Fine free tendrils break the silhouette and make the structure read as a vine.
  const tendrils = [
    [[.15,3.88,0],[.59,3.69,.06],[.83,3.48,.09],[.99,3.57,.08],[.92,3.72,.06],[.79,3.66,.03]],
    [[2.03,4.51,-.05],[2.30,4.41,.02],[2.40,4.53,.08],[2.32,4.59,.07],[2.25,4.52,.03]],
    [[-.37,7.19,0],[-.17,7.36,.03],[.01,7.33,.04],[.02,7.22,.04],[-.08,7.22,.03]],
    [[-.34,.49,.03],[-.18,.32,.04],[-.21,.19,.06],[-.28,.18,.06],[-.31,.25,.06]],
  ];
  tendrils.forEach(points => addMesh(tube(points, .0045, 38, 4), mat.stem));

  compactMeshes(plant);
  compactMeshes(group);

  group.updateMatrixWorld(true);
  const anchors = {
    corolla: V(-.17,4.48,.39),
    vine: V(-.39,6.25,0),
    vessel: V(.52,1.20,.15),
  };
  function update(time, strength = 1) {
    plant.rotation.z = Math.sin(time * .27) * .0025 * strength;
    for (const leaf of moving) {
      leaf.object.rotation.x = leaf.rotation.x + Math.sin(time * .41 + leaf.seed) * leaf.amount * strength;
      leaf.object.rotation.z = leaf.rotation.z + Math.sin(time * .33 + leaf.seed) * leaf.amount * .7 * strength;
    }
    const bend = new THREE.Quaternion();
    const axis = new THREE.Vector3(0, 1, 0);
    for (const flower of flowerHeads) {
      bend.setFromAxisAngle(axis, Math.sin(time * .32 + flower.userData.seed) * .009 * strength);
      flower.quaternion.copy(flower.userData.baseQuaternion).multiply(bend);
    }
  }
  return { group, flowerHeads, anchors, update };
}
