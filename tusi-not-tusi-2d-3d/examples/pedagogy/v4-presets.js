/** Shared indexed color cycle for the two public 3-D experiments. */
export const V4_LEGACY_COLORS = Object.freeze([
  "rgb(255,0,0)",
  "rgb(0,255,0)",
  "rgb(0,0,255)",
  "rgb(255,255,0)",
  "rgb(255,0,255)",
  "rgb(0,255,255)",
  "rgb(128,0,0)",
  "rgb(0,128,0)",
  "rgb(0,0,128)",
  "rgb(128,128,0)",
  "rgb(128,0,128)",
  "rgb(0,128,128)",
  "rgb(128,128,128)",
  "rgb(255,128,0)",
  "rgb(128,255,0)",
  "rgb(128,0,255)",
  "rgb(255,0,128)",
  "rgb(0,128,255)",
  "rgb(0,255,128)",
  "rgb(255,128,128)",
]);

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

/** Preset-specific camera compositions retained from the historical V4 view. */
export const V4_PRESET_CAMERA_VIEWS = deepFreeze({
  P01: {
    direction: [0, 0, 1],
    up: [0, 1, 0],
    distance: 5,
    fov: 75,
  },
  P02: {
    direction: [0, 0, 1],
    up: [0, 1, 0],
    distance: 5,
    fov: 75,
  },
  P03: {
    direction: [0, 0, 1],
    up: [0, 1, 0],
    distance: 5,
    fov: 75,
  },
  P04: {
    direction: [0, 0, 1],
    up: [0, 1, 0],
    distance: 5,
    fov: 75,
  },
  P05: {
    direction: [0, 0, 1],
    up: [0, 1, 0],
    distance: 5,
    fov: 75,
  },
});

/** Display choices that intentionally form part of a preset's initial view. */
export const V4_PRESET_DISPLAY_DEFAULTS = deepFreeze({
  P03: { showPaths: false },
});

/** Preset shown when the reader first opens the 3D experiment. */
export const V4_DEFAULT_PRESET_ID = "P03";

function historicalPreset(
  number,
  label,
  bigRadius,
  smallRadius,
  nbrBalls,
  rotationSpeed,
  [rx, ry, rz],
  phaseXYZ,
  [phaseX, phaseY, phaseZ],
  nbrColors,
  colors = V4_LEGACY_COLORS,
) {
  const suffix = String(number).padStart(2, "0");
  return {
    id: `P${suffix}`,
    label,
    bigRadius,
    smallRadius,
    nbrBalls,
    rotationSpeed,
    rx,
    ry,
    rz,
    phaseXYZ,
    phaseX,
    phaseY,
    phaseZ,
    nbrColors,
    silouhette: false,
    colors,
  };
}

/** The five selected configurations supplied from the historical V4 preset exporter. */
export const V4_HISTORICAL_PRESETS = deepFreeze([
  historicalPreset(1, "Crossed loops", 2, 1, 120, 0.9, [true, false, false], -26, [-36, -34, 25], 2),
  historicalPreset(2, "Coiled braid", 2, 1, 120, 2.9, [false, true, false], -26, [-97, 26, 87], 2),
  historicalPreset(3, "Red rosette", 2, 1, 120, 1.3, [false, true, false], -26, [-97, 26, -99], 1),
  historicalPreset(4, "Interlaced ribbons", 1.8, 0.8, 200, 0.5, [true, false, false], 100, [-100, 100, -2], 2),
  historicalPreset(5, "Twin rings", 1.2, 1.5, 160, 0.3, [true, true, true], 100, [-20, -100, -100], 2),
]);

function finite(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${name} must be finite.`);
  return number;
}

function integer(value, name) {
  const number = finite(value, name);
  if (!Number.isInteger(number)) throw new TypeError(`${name} must be an integer.`);
  return number;
}

function equivalentWinding(value, pointCount) {
  let winding = ((integer(value, "winding") % pointCount) + pointCount) % pointCount;
  if (winding >= pointCount / 2) winding -= pointCount;
  return winding;
}

/**
 * Convert one historical export to the current V4 model. The removed shared
 * phase is folded into each axis with the sign change required by the clean
 * model's subtractive convention, then reduced modulo N. This preserves every
 * sampled point while keeping each independent winding inside -100…100.
 */
export function v4PresetToConfig(preset) {
  if (!preset || typeof preset !== "object") throw new TypeError("preset must be an object.");
  const pointCount = integer(preset.nbrBalls, "preset.nbrBalls");
  if (pointCount < 3 || pointCount > 200) {
    throw new RangeError("preset.nbrBalls must be between 3 and 200.");
  }
  const carrierRadius = finite(preset.bigRadius, "preset.bigRadius");
  const localRadius = finite(preset.smallRadius, "preset.smallRadius");
  const angularSpeed = finite(preset.rotationSpeed, "preset.rotationSpeed");
  if (carrierRadius < 0 || localRadius < 0 || angularSpeed < 0) {
    throw new RangeError("preset radii and rotation speed cannot be negative.");
  }
  const axes = [preset.rx, preset.ry, preset.rz];
  if (!axes.every((value) => typeof value === "boolean")) {
    throw new TypeError("preset rx, ry, and rz values must be boolean.");
  }
  const shared = integer(preset.phaseXYZ, "preset.phaseXYZ");
  const colorGroups = integer(preset.nbrColors, "preset.nbrColors");
  if (!Array.isArray(preset.colors) || preset.colors.length === 0 ||
      !preset.colors.every((color) => typeof color === "string" && color.trim())) {
    throw new TypeError("preset.colors must contain CSS color strings.");
  }
  if (colorGroups < 1 || colorGroups > preset.colors.length) {
    throw new RangeError("preset.nbrColors must fit within preset.colors.");
  }
  return deepFreeze({
    pointCount,
    carrierRadius,
    localRadius,
    angularSpeed,
    phase: {
      x: equivalentWinding(-(shared + integer(preset.phaseX, "preset.phaseX")), pointCount),
      y: equivalentWinding(-(shared + integer(preset.phaseY, "preset.phaseY")), pointCount),
      z: equivalentWinding(-(shared + integer(preset.phaseZ, "preset.phaseZ")), pointCount),
    },
    animateAxes: { x: preset.rx, y: preset.ry, z: preset.rz },
    colorGroups,
    colors: [...preset.colors],
  });
}
