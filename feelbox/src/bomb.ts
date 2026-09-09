import * as THREE from "three";

export type BombMode = "carried" | "ground" | "planted";

export type BombView = {
  root: THREE.Group;
  pulse: (t: number, mode: BombMode) => void;
};

function box(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  mat: THREE.Material,
) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function cylY(parent: THREE.Object3D, x: number, y: number, z: number, r: number, len: number, mat: THREE.Material, segs = 8) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, segs), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function cylX(parent: THREE.Object3D, x: number, y: number, z: number, r: number, len: number, mat: THREE.Material, segs = 8) {
  const m = cylY(parent, x, y, z, r, len, mat, segs);
  m.rotation.z = Math.PI / 2;
  return m;
}

/** C4 satchel: olive pack, charge bricks, keypad, straps, antenna. */
export function makeBomb(): BombView {
  const root = new THREE.Group();
  root.name = "bomb";

  const canvas = new THREE.MeshStandardMaterial({
    color: 0x3c3a2c,
    roughness: 0.88,
    metalness: 0.06,
    emissive: 0x5a1208,
    emissiveIntensity: 0,
  });
  const canvasDark = new THREE.MeshStandardMaterial({ color: 0x262418, roughness: 0.9, metalness: 0.04 });
  const strap = new THREE.MeshStandardMaterial({ color: 0x5c4024, roughness: 0.78, metalness: 0.04 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x2a2c28, roughness: 0.3, metalness: 0.74 });
  const plate = new THREE.MeshStandardMaterial({
    color: 0x161814,
    roughness: 0.42,
    metalness: 0.4,
    emissive: 0xff2808,
    emissiveIntensity: 0,
  });
  const clay = new THREE.MeshStandardMaterial({ color: 0xc8b46a, roughness: 0.84, metalness: 0.03 });
  const key = new THREE.MeshStandardMaterial({ color: 0x0c0e0c, roughness: 0.55, metalness: 0.15 });
  const ledRed = new THREE.MeshStandardMaterial({
    color: 0xff2410,
    roughness: 0.28,
    metalness: 0.08,
    emissive: 0xff2208,
    emissiveIntensity: 0.15,
  });
  const ledAmber = new THREE.MeshStandardMaterial({
    color: 0xffaa28,
    roughness: 0.28,
    metalness: 0.08,
    emissive: 0xff8800,
    emissiveIntensity: 0.12,
  });
  const cord = new THREE.MeshStandardMaterial({ color: 0x1c1a12, roughness: 0.7, metalness: 0.1 });

  box(root, 0, 0, 0, 0.26, 0.078, 0.2, canvas);
  box(root, 0, 0.042, 0, 0.24, 0.01, 0.176, canvasDark);

  box(root, -0.062, 0.002, -0.094, 0.1, 0.05, 0.03, clay);
  box(root, 0.062, 0.002, -0.094, 0.1, 0.05, 0.03, clay);

  box(root, -0.068, 0.008, 0, 0.026, 0.086, 0.208, strap);
  box(root, 0.068, 0.008, 0, 0.026, 0.086, 0.208, strap);
  box(root, 0, 0.008, -0.052, 0.268, 0.086, 0.02, strap);
  box(root, 0, 0.05, 0.01, 0.1, 0.008, 0.036, strap);

  cylY(root, -0.03, 0.068, 0.01, 0.005, 0.028, steel, 6);
  cylY(root, 0.03, 0.068, 0.01, 0.005, 0.028, steel, 6);
  cylX(root, 0, 0.082, 0.01, 0.005, 0.068, steel, 6);

  box(root, 0, 0.008, 0.098, 0.15, 0.052, 0.012, plate);
  box(root, 0, 0.026, 0.106, 0.092, 0.012, 0.006, plate);
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      box(root, -0.038 + c * 0.028, -0.004 + r * 0.016, 0.106, 0.02, 0.011, 0.006, key);
    }
  }

  box(root, -0.108, 0.024, 0.102, 0.014, 0.01, 0.008, ledRed);
  box(root, 0.108, 0.024, 0.102, 0.014, 0.01, 0.008, ledAmber);
  box(root, 0.108, 0.006, 0.102, 0.014, 0.01, 0.008, ledRed);

  box(root, -0.136, 0.006, 0.036, 0.016, 0.028, 0.036, steel);
  box(root, 0.136, 0.006, 0.036, 0.016, 0.028, 0.036, steel);

  const lean = 0.2;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.005, 0.16, 6), steel);
  mast.position.set(0.1, 0.128, -0.048);
  mast.rotation.z = -lean;
  mast.castShadow = true;
  root.add(mast);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), ledRed);
  tip.position.set(0.116, 0.206, -0.048);
  tip.castShadow = true;
  root.add(tip);

  const whip = new THREE.Mesh(new THREE.CylinderGeometry(0.0024, 0.0024, 0.09, 5), cord);
  whip.position.set(0.04, 0.06, -0.02);
  whip.rotation.set(0.4, 0, 0.9);
  root.add(whip);
  cylX(root, -0.12, 0.02, -0.07, 0.005, 0.04, cord, 5);
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0045, 5, 10), cord);
  coil.position.set(-0.122, 0.016, -0.062);
  coil.rotation.y = Math.PI / 2;
  root.add(coil);

  function pulse(t: number, mode: BombMode) {
    const down = mode === "ground" || mode === "planted";
    const hz = mode === "planted" ? 2.8 : 1.35;
    const wave = down ? 0.5 + 0.5 * Math.sin(t * hz * Math.PI * 2) : 0;
    canvas.emissiveIntensity = down ? 0.14 + wave * 0.85 : 0;
    plate.emissiveIntensity = down ? 0.28 + wave * 1.5 : 0.04;
    ledRed.emissiveIntensity = down ? 0.45 + wave * 2.4 : 0.12;
    ledAmber.emissiveIntensity = down ? 0.32 + wave * 1.7 : 0.08;
  }

  return { root, pulse };
}
