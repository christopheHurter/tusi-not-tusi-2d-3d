/**
 * Canonical, versioned configuration handling for every Tusi/Not-Tusi model.
 * This module intentionally has no DOM or rendering dependencies.
 */

export const SCHEMA_VERSION = 1;

export const MODEL_KINDS = Object.freeze([
  "tusi-2d",
  "not-tusi-2d",
  "tusi-3d",
  "not-tusi-3d",
]);

export const SAMPLING_METHODS = Object.freeze([
  "full-circle",
  "half-circle",
  "fibonacci-sphere",
]);

export const CIRCULATION_MODES = Object.freeze([
  "forward",
  "reverse",
  "alternating",
]);

export const CIRCLE_PLANES = Object.freeze(["meridian", "azimuthal"]);

export const PALETTES = Object.freeze([
  "phase",
  "radius",
  "direction",
  "mono",
]);

const KIND_SET = new Set(MODEL_KINDS);
const SAMPLING_SET = new Set(SAMPLING_METHODS);
const CIRCULATION_SET = new Set(CIRCULATION_MODES);
const PLANE_SET = new Set(CIRCLE_PLANES);
const PALETTE_SET = new Set(PALETTES);

const COMMON_KEYS = Object.freeze([
  "schemaVersion",
  "kind",
  "center",
  "radius",
  "pointCount",
  "angularSpeed",
  "sampling",
  "phase",
  "animation",
  "visualization",
]);

const ORIENTATION_WINDING_KEYS = Object.freeze(["x", "y", "z"]);

const ANIMATION_KEYS = Object.freeze(["time", "speed", "playing"]);
const VISUALIZATION_KEYS = Object.freeze([
  "showPaths",
  "palette",
  "pointSize",
]);

const DEFAULT_ANIMATION = Object.freeze({
  time: 0,
  speed: 1,
  playing: true,
});

const DEFAULT_VISUALIZATION = Object.freeze({
  showPaths: true,
  palette: "phase",
  pointSize: 5,
});

const DEFAULT_CONFIGS = deepFreeze({
  "tusi-2d": {
    schemaVersion: SCHEMA_VERSION,
    kind: "tusi-2d",
    center: [0, 0],
    radius: 1,
    pointCount: 24,
    angularSpeed: 1,
    sampling: "full-circle",
    phase: { winding: 0 },
    animation: DEFAULT_ANIMATION,
    visualization: DEFAULT_VISUALIZATION,
  },
  "not-tusi-2d": {
    schemaVersion: SCHEMA_VERSION,
    kind: "not-tusi-2d",
    center: [0, 0],
    radius: 1,
    pointCount: 24,
    angularSpeed: 1,
    sampling: "full-circle",
    phase: { winding: 0 },
    orbitRatio: 0.5,
    circulation: "forward",
    animation: DEFAULT_ANIMATION,
    visualization: DEFAULT_VISUALIZATION,
  },
  "tusi-3d": {
    schemaVersion: SCHEMA_VERSION,
    kind: "tusi-3d",
    center: [0, 0, 0],
    radius: 1,
    pointCount: 200,
    angularSpeed: 1,
    sampling: "full-circle",
    seed: [0.42, 0.61, 0.67],
    orientationWindings: { x: 1, y: 2, z: 3 },
    orientationBends: { x: 0, y: 0, z: 0 },
    phase: { winding: 1 },
    animation: DEFAULT_ANIMATION,
    visualization: DEFAULT_VISUALIZATION,
  },
  "not-tusi-3d": {
    schemaVersion: SCHEMA_VERSION,
    kind: "not-tusi-3d",
    center: [0, 0, 0],
    radius: 1,
    pointCount: 260,
    angularSpeed: 1,
    sampling: "fibonacci-sphere",
    phase: { twist: 0, pitch: 0, height: 0 },
    orbitRatio: 0.5,
    circulation: "forward",
    circlePlane: "meridian",
    animation: DEFAULT_ANIMATION,
    visualization: DEFAULT_VISUALIZATION,
  },
});

export class ConfigValidationError extends TypeError {
  constructor(errors, message = "Invalid Tusi/Not-Tusi configuration") {
    const normalizedErrors = Array.isArray(errors) ? errors : [String(errors)];
    super(`${message}: ${normalizedErrors.join("; ")}`);
    this.name = "ConfigValidationError";
    this.errors = Object.freeze([...normalizedErrors]);
  }
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, cloneValue(child)]),
    );
  }
  return value;
}

function expectedDimension(kind) {
  return kind?.endsWith("-3d") ? 3 : 2;
}

function isNotTusi(kind) {
  return kind?.startsWith("not-tusi-");
}

function expectedPhaseKeys(kind) {
  return kind === "not-tusi-3d"
    ? ["twist", "pitch", "height"]
    : ["winding"];
}

function expectedTopLevelKeys(kind) {
  const keys = [...COMMON_KEYS];
  if (kind === "tusi-3d") keys.push("seed", "orientationWindings", "orientationBends");
  if (isNotTusi(kind)) keys.push("orbitRatio", "circulation");
  if (kind === "not-tusi-3d") keys.push("circlePlane");
  return keys;
}

function reportUnknownKeys(value, expectedKeys, path, errors) {
  if (!isPlainObject(value)) return;
  const expected = new Set(expectedKeys);
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) errors.push(`${path}.${key} is not supported`);
  }
}

function reportMissingKeys(value, expectedKeys, path, errors) {
  if (!isPlainObject(value)) return;
  for (const key of expectedKeys) {
    if (!Object.hasOwn(value, key)) errors.push(`${path}.${key} is required`);
  }
}

function reportFiniteNumber(value, path, errors, predicate = () => true, rule = "") {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${path} must be a finite number`);
  } else if (!predicate(value)) {
    errors.push(`${path} ${rule}`.trim());
  }
}

function validateNestedObject(value, keys, path, errors) {
  if (!isPlainObject(value)) {
    errors.push(`${path} must be an object`);
    return false;
  }
  reportUnknownKeys(value, keys, path, errors);
  reportMissingKeys(value, keys, path, errors);
  return true;
}

/**
 * Validate a complete canonical configuration without modifying it.
 *
 * @returns {{valid: boolean, errors: readonly string[]}}
 */
export function validateConfig(config) {
  const errors = [];

  if (!isPlainObject(config)) {
    return Object.freeze({
      valid: false,
      errors: Object.freeze(["config must be an object"]),
    });
  }

  const kind = config.kind;
  if (!KIND_SET.has(kind)) {
    errors.push(`config.kind must be one of: ${MODEL_KINDS.join(", ")}`);
  }

  const topLevelKeys = KIND_SET.has(kind)
    ? expectedTopLevelKeys(kind)
    : COMMON_KEYS;
  reportUnknownKeys(config, topLevelKeys, "config", errors);
  reportMissingKeys(config, topLevelKeys, "config", errors);

  if (config.schemaVersion !== SCHEMA_VERSION) {
    errors.push(
      `config.schemaVersion must be ${SCHEMA_VERSION}; received ${String(config.schemaVersion)}`,
    );
  }

  const dimension = KIND_SET.has(kind) ? expectedDimension(kind) : undefined;
  if (
    !Array.isArray(config.center) ||
    config.center.length !== dimension ||
    !config.center.every((value) => typeof value === "number" && Number.isFinite(value))
  ) {
    errors.push(`config.center must contain ${dimension ?? "the expected"} finite coordinates`);
  }

  reportFiniteNumber(
    config.radius,
    "config.radius",
    errors,
    (value) => value > 0,
    "must be greater than 0",
  );

  if (!Number.isInteger(config.pointCount) || config.pointCount < 1) {
    errors.push("config.pointCount must be a positive integer");
  }

  reportFiniteNumber(config.angularSpeed, "config.angularSpeed", errors);

  if (!SAMPLING_SET.has(config.sampling)) {
    errors.push(`config.sampling must be one of: ${SAMPLING_METHODS.join(", ")}`);
  } else if (dimension === 2 && config.sampling === "fibonacci-sphere") {
    errors.push("config.sampling must be full-circle or half-circle for a 2-D model");
  } else if (kind === "tusi-3d" && config.sampling !== "full-circle") {
    errors.push("config.sampling must be full-circle for the Euler-wound 3-D Tusi model");
  } else if (kind === "not-tusi-3d" && config.sampling !== "fibonacci-sphere") {
    errors.push("config.sampling must be fibonacci-sphere for a 3-D model");
  }

  const phaseKeys = expectedPhaseKeys(kind);
  if (validateNestedObject(config.phase, phaseKeys, "config.phase", errors)) {
    for (const key of phaseKeys) {
      reportFiniteNumber(config.phase[key], `config.phase.${key}`, errors);
    }
    if (kind === "tusi-3d" && !Number.isInteger(config.phase.winding)) {
      errors.push("config.phase.winding must be an integer for the Euler-wound 3-D Tusi model");
    }
  }

  if (kind === "tusi-3d") {
    if (
      !Array.isArray(config.seed) ||
      config.seed.length !== 3 ||
      !config.seed.every((value) => typeof value === "number" && Number.isFinite(value))
    ) {
      errors.push("config.seed must contain three finite coordinates");
    } else if (!(Math.hypot(...config.seed) > 0)) {
      errors.push("config.seed must be non-zero");
    }

    if (
      validateNestedObject(
        config.orientationWindings,
        ORIENTATION_WINDING_KEYS,
        "config.orientationWindings",
        errors,
      )
    ) {
      for (const key of ORIENTATION_WINDING_KEYS) {
        reportFiniteNumber(
          config.orientationWindings[key],
          `config.orientationWindings.${key}`,
          errors,
          Number.isInteger,
          "must be an integer",
        );
      }
    }
    if (validateNestedObject(config.orientationBends, ORIENTATION_WINDING_KEYS, "config.orientationBends", errors)) {
      for (const key of ORIENTATION_WINDING_KEYS) {
        reportFiniteNumber(config.orientationBends[key], `config.orientationBends.${key}`, errors);
      }
    }
  }

  if (isNotTusi(kind)) {
    reportFiniteNumber(
      config.orbitRatio,
      "config.orbitRatio",
      errors,
      (value) => value >= 0 && value <= 1,
      "must be between 0 and 1",
    );
    if (!CIRCULATION_SET.has(config.circulation)) {
      errors.push(
        `config.circulation must be one of: ${CIRCULATION_MODES.join(", ")}`,
      );
    }
  }

  if (kind === "not-tusi-3d" && !PLANE_SET.has(config.circlePlane)) {
    errors.push(`config.circlePlane must be one of: ${CIRCLE_PLANES.join(", ")}`);
  }

  if (
    validateNestedObject(
      config.animation,
      ANIMATION_KEYS,
      "config.animation",
      errors,
    )
  ) {
    reportFiniteNumber(config.animation.time, "config.animation.time", errors);
    reportFiniteNumber(
      config.animation.speed,
      "config.animation.speed",
      errors,
      (value) => value >= 0,
      "must be greater than or equal to 0",
    );
    if (typeof config.animation.playing !== "boolean") {
      errors.push("config.animation.playing must be a boolean");
    }
  }

  if (
    validateNestedObject(
      config.visualization,
      VISUALIZATION_KEYS,
      "config.visualization",
      errors,
    )
  ) {
    if (typeof config.visualization.showPaths !== "boolean") {
      errors.push("config.visualization.showPaths must be a boolean");
    }
    if (!PALETTE_SET.has(config.visualization.palette)) {
      errors.push(`config.visualization.palette must be one of: ${PALETTES.join(", ")}`);
    }
    reportFiniteNumber(
      config.visualization.pointSize,
      "config.visualization.pointSize",
      errors,
      (value) => value > 0,
      "must be greater than 0",
    );
  }

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
  });
}

function mergeConfig(defaultConfig, overrides) {
  const merged = {
    ...cloneValue(defaultConfig),
    ...cloneValue(overrides),
  };

  for (const key of ["phase", "orientationWindings", "orientationBends", "animation", "visualization"]) {
    if (defaultConfig[key] === undefined && overrides[key] === undefined) continue;
    if (overrides[key] === undefined) {
      merged[key] = cloneValue(defaultConfig[key]);
    } else if (isPlainObject(overrides[key])) {
      merged[key] = {
        ...cloneValue(defaultConfig[key]),
        ...cloneValue(overrides[key]),
      };
    }
  }

  return merged;
}

function canonicalize(config) {
  const canonical = {
    schemaVersion: config.schemaVersion,
    kind: config.kind,
    center: [...config.center],
    radius: config.radius,
    pointCount: config.pointCount,
    angularSpeed: config.angularSpeed,
    sampling: config.sampling,
    phase: cloneValue(config.phase),
  };

  if (config.kind === "tusi-3d") {
    const seedLength = Math.hypot(...config.seed);
    canonical.seed = config.seed.map((coordinate) => coordinate / seedLength);
    canonical.orientationWindings = cloneValue(config.orientationWindings);
    canonical.orientationBends = cloneValue(config.orientationBends);
  }

  if (isNotTusi(config.kind)) {
    canonical.orbitRatio = config.orbitRatio;
    canonical.circulation = config.circulation;
  }
  if (config.kind === "not-tusi-3d") {
    canonical.circlePlane = config.circlePlane;
  }

  canonical.animation = cloneValue(config.animation);
  canonical.visualization = cloneValue(config.visualization);
  return deepFreeze(canonical);
}

/**
 * Create a complete, deeply frozen configuration by applying overrides to the
 * documented defaults for `kind`. Unknown fields and invalid values throw.
 */
export function createConfig(kind, overrides = {}) {
  if (!KIND_SET.has(kind)) {
    throw new ConfigValidationError(
      `kind must be one of: ${MODEL_KINDS.join(", ")}`,
    );
  }
  if (!isPlainObject(overrides)) {
    throw new ConfigValidationError("overrides must be an object");
  }
  if (overrides.kind !== undefined && overrides.kind !== kind) {
    throw new ConfigValidationError(
      `overrides.kind (${String(overrides.kind)}) does not match ${kind}`,
    );
  }

  const candidate = mergeConfig(DEFAULT_CONFIGS[kind], overrides);
  candidate.kind = kind;
  const result = validateConfig(candidate);
  if (!result.valid) throw new ConfigValidationError(result.errors);
  return canonicalize(candidate);
}

/** Return a fresh, deeply frozen canonical default configuration. */
export function getDefaultConfig(kind) {
  return createConfig(kind);
}

/** Serialize a validated configuration using canonical property order. */
export function serializeConfig(config, space = 2) {
  const canonical = createConfig(config?.kind, config);
  if (!Number.isInteger(space) || space < 0 || space > 10) {
    throw new RangeError("space must be an integer from 0 through 10");
  }
  return JSON.stringify(canonical, null, space);
}

/** Parse, validate, canonicalize, and deeply freeze a serialized configuration. */
export function deserializeConfig(text) {
  if (typeof text !== "string") {
    throw new ConfigValidationError("serialized configuration must be a string");
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new ConfigValidationError(
      `serialized configuration is not valid JSON (${error.message})`,
    );
  }

  if (!isPlainObject(parsed)) {
    throw new ConfigValidationError("serialized configuration must contain an object");
  }
  return createConfig(parsed.kind, parsed);
}
