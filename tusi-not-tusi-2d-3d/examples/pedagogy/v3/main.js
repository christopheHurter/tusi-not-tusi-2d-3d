// Reusable core operations for ordinary pairwise transitions.
export {
  createNotTusi2D,
  interpolateParameters,
  interpolatePoints,
} from "../../../src/core/index.js";

// Historical four-anchor V3 adapter used by this lesson.
export {
  V3_HISTORICAL_PRESETS,
  createV3CircleModel,
  createV3PointInterpolationModel,
  interpolateV3PresetSet,
  inverseDistanceWeights,
} from "../pedagogy-models.js";

import "../pedagogy-page.js";
