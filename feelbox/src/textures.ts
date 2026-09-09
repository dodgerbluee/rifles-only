import * as THREE from "three";

function hasDom() {
  return typeof document !== "undefined";
}

function dummyTex(): THREE.Texture {
  const t = new THREE.DataTexture(new Uint8Array([160, 150, 140, 255]), 1, 1);
  t.needsUpdate = true;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

function canvas(size: number) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  return { c, g, size };
}

function noise(g: CanvasRenderingContext2D, size: number, amount: number) {
  const img = g.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] = clamp(d[i] + n);
    d[i + 1] = clamp(d[i + 1] + n);
    d[i + 2] = clamp(d[i + 2] + n);
  }
  g.putImageData(img, 0, 0);
}

function clamp(v: number) {
  return Math.max(0, Math.min(255, v));
}

function tex(c: HTMLCanvasElement, repeatX: number, repeatY: number) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.repeat.set(repeatX, repeatY);
  t.needsUpdate = true;
  return t;
}

export function makeTextures() {
  if (!hasDom()) {
    const d = dummyTex();
    return {
      plaster: d,
      brick: d,
      asphalt: d,
      dirt: d,
      wood: d,
      metal: d,
      sand: d,
      snow: d,
      grass: d,
      leaf: d,
      cobble: d,
      lime: d,
    };
  }
  const plaster = canvas(512);
  plaster.g.fillStyle = "#b7a790";
  plaster.g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 40; i++) {
    plaster.g.fillStyle = `rgba(90,70,50,${0.03 + Math.random() * 0.05})`;
    plaster.g.fillRect(Math.random() * 512, Math.random() * 512, 40 + Math.random() * 90, 8 + Math.random() * 18);
  }
  noise(plaster.g, 512, 22);

  const brick = canvas(512);
  brick.g.fillStyle = "#6d5a4c";
  brick.g.fillRect(0, 0, 512, 512);
  const bh = 28;
  const bw = 64;
  for (let y = 0, row = 0; y < 512; y += bh, row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let x = -bw; x < 512; x += bw) {
      brick.g.fillStyle = `rgb(${118 + Math.random() * 28 | 0},${72 + Math.random() * 18 | 0},${52 + Math.random() * 14 | 0})`;
      brick.g.fillRect(x + off + 2, y + 2, bw - 4, bh - 4);
    }
  }
  noise(brick.g, 512, 16);

  const asphalt = canvas(512);
  asphalt.g.fillStyle = "#3c3e3b";
  asphalt.g.fillRect(0, 0, 512, 512);
  asphalt.g.fillStyle = "rgba(220,200,140,0.18)";
  asphalt.g.fillRect(248, 0, 6, 512);
  for (let y = 0; y < 512; y += 48) {
    asphalt.g.fillRect(248, y, 6, 22);
  }
  noise(asphalt.g, 512, 28);

  const dirt = canvas(512);
  dirt.g.fillStyle = "#6a5a45";
  dirt.g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 80; i++) {
    dirt.g.fillStyle = `rgba(${80 + Math.random() * 50 | 0},${60 + Math.random() * 30 | 0},${30 + Math.random() * 20 | 0},0.25)`;
    dirt.g.beginPath();
    dirt.g.ellipse(Math.random() * 512, Math.random() * 512, 8 + Math.random() * 28, 6 + Math.random() * 18, 0, 0, Math.PI * 2);
    dirt.g.fill();
  }
  noise(dirt.g, 512, 26);

  const wood = canvas(256);
  wood.g.fillStyle = "#5a3d24";
  wood.g.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 32) {
    wood.g.fillStyle = `rgb(${90 + Math.random() * 30 | 0},${58 + Math.random() * 16 | 0},${30 + Math.random() * 10 | 0})`;
    wood.g.fillRect(x, 0, 30, 256);
    wood.g.strokeStyle = "rgba(0,0,0,0.25)";
    wood.g.strokeRect(x, 0, 32, 256);
  }
  noise(wood.g, 256, 18);

  const metal = canvas(256);
  metal.g.fillStyle = "#4c524c";
  metal.g.fillRect(0, 0, 256, 256);
  metal.g.fillStyle = "rgba(0,0,0,0.2)";
  for (let y = 0; y < 256; y += 16) metal.g.fillRect(0, y, 256, 2);
  noise(metal.g, 256, 20);

  const sand = canvas(256);
  sand.g.fillStyle = "#8a7a58";
  sand.g.fillRect(0, 0, 256, 256);
  noise(sand.g, 256, 30);

  const snow = canvas(512);
  snow.g.fillStyle = "#d4d8dc";
  snow.g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 90; i++) {
    snow.g.fillStyle = `rgba(${170 + Math.random() * 50 | 0},${176 + Math.random() * 40 | 0},${180 + Math.random() * 40 | 0},0.35)`;
    snow.g.beginPath();
    snow.g.ellipse(Math.random() * 512, Math.random() * 512, 10 + Math.random() * 36, 6 + Math.random() * 22, 0, 0, Math.PI * 2);
    snow.g.fill();
  }
  snow.g.fillStyle = "rgba(90, 86, 78, 0.12)";
  for (let i = 0; i < 24; i++) {
    snow.g.fillRect(Math.random() * 512, Math.random() * 512, 18 + Math.random() * 40, 4 + Math.random() * 10);
  }
  noise(snow.g, 512, 18);

  const grass = canvas(512);
  grass.g.fillStyle = "#3d6a32";
  grass.g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 140; i++) {
    grass.g.fillStyle = `rgba(${40 + Math.random() * 50 | 0},${90 + Math.random() * 70 | 0},${30 + Math.random() * 30 | 0},0.45)`;
    grass.g.fillRect(Math.random() * 512, Math.random() * 512, 4 + Math.random() * 18, 10 + Math.random() * 28);
  }
  noise(grass.g, 512, 22);

  const leaf = canvas(256);
  leaf.g.fillStyle = "#2f5a28";
  leaf.g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {
    leaf.g.fillStyle = `rgba(${30 + Math.random() * 40 | 0},${80 + Math.random() * 90 | 0},${24 + Math.random() * 30 | 0},0.5)`;
    leaf.g.beginPath();
    leaf.g.ellipse(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 16, 4 + Math.random() * 10, Math.random(), 0, Math.PI * 2);
    leaf.g.fill();
  }
  noise(leaf.g, 256, 18);

  const cobble = canvas(512);
  cobble.g.fillStyle = "#6a6560";
  cobble.g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 28) {
    for (let x = 0; x < 512; x += 36) {
      cobble.g.fillStyle = `rgb(${90 + Math.random() * 40 | 0},${86 + Math.random() * 32 | 0},${78 + Math.random() * 28 | 0})`;
      cobble.g.fillRect(x + 2 + (y % 56 === 0 ? 8 : 0), y + 2, 30, 22);
    }
  }
  noise(cobble.g, 512, 16);

  const lime = canvas(512);
  lime.g.fillStyle = "#b39a72";
  lime.g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 50; i++) {
    lime.g.fillStyle = `rgba(${140 + Math.random() * 40 | 0},${110 + Math.random() * 30 | 0},${70 + Math.random() * 20 | 0},0.28)`;
    lime.g.fillRect(Math.random() * 512, Math.random() * 512, 20 + Math.random() * 80, 6 + Math.random() * 18);
  }
  noise(lime.g, 512, 20);

  return {
    plaster: tex(plaster.c, 1, 1),
    brick: tex(brick.c, 1, 1),
    asphalt: tex(asphalt.c, 1, 1),
    dirt: tex(dirt.c, 1, 1),
    wood: tex(wood.c, 1, 1),
    metal: tex(metal.c, 1, 1),
    sand: tex(sand.c, 1, 1),
    snow: tex(snow.c, 1, 1),
    grass: tex(grass.c, 1, 1),
    leaf: tex(leaf.c, 1, 1),
    cobble: tex(cobble.c, 1, 1),
    lime: tex(lime.c, 1, 1),
  };
}

export type TexPack = ReturnType<typeof makeTextures>;

export function surf(map: THREE.Texture, sx: number, sy: number, roughness = 0.92, metalness = 0.04) {
  const t = map.clone();
  t.repeat.set(Math.max(0.4, sx / 2.2), Math.max(0.4, sy / 2.2));
  t.needsUpdate = true;
  return new THREE.MeshStandardMaterial({
    map: t,
    roughness,
    metalness,
  });
}
