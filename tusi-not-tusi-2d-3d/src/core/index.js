export {
  SCHEMA_VERSION,
  MODEL_KINDS,
  SAMPLING_METHODS,
  CIRCULATION_MODES,
  CIRCLE_PLANES,
  PALETTES,
  ConfigValidationError,
  validateConfig,
  createConfig,
  getDefaultConfig,
  serializeConfig,
  deserializeConfig,
} from "./config.js";

export {
  TAU,
  GOLDEN_ANGLE,
  fibonacciSphere,
  sphereTangentBasis,
} from "./geometry.js";

export {
  createModel,
  createTusi2D,
  createNotTusi2D,
  createTusi3D,
  createEulerDiameterTusi3D,
  createNotTusi3D,
} from "./models.js";

export {
  InterpolationError,
  interpolateParameters,
  interpolatePoints,
} from "./interpolation.js";

export {
  PRESET_CATALOG,
  listPresets,
  getPreset,
} from "./presets.js";
