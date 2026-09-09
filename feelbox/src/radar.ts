/**
 * Wharf radar is east-up: world +X is the top of the map, world +Z is left.
 * The chevron is drawn pointing canvas-up (negative Y), then rotated.
 */
export function radarHeading(yaw: number) {
  return yaw + Math.PI / 2;
}

export function worldToRadar(
  x: number,
  z: number,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
  mapW: number,
  mapH: number,
) {
  const worldW = bounds.maxZ - bounds.minZ;
  const worldH = bounds.maxX - bounds.minX;
  const scale = Math.min(mapW / worldW, mapH / worldH);
  const ox = (mapW - worldW * scale) / 2;
  const oy = (mapH - worldH * scale) / 2;
  return {
    x: ox + (bounds.maxZ - z) * scale,
    y: oy + (bounds.maxX - x) * scale,
    scale,
  };
}

/** Canvas-space look vector after rotating a north-pointing chevron. */
export function radarLook(yaw: number) {
  const a = radarHeading(yaw);
  return { x: Math.sin(a), y: -Math.cos(a) };
}
