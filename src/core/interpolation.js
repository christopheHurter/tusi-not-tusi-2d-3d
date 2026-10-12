import { createConfig } from "./config.js";
import { createModel } from "./models.js";

export class InterpolationError extends TypeError {
  constructor(message) {
    super(message);
    this.name = "InterpolationError";
  }
}

function clampAlpha(alpha) {
  if (typeof alpha !== "number" || !Number.isFinite(alpha)) {
    throw new InterpolationError("alpha must be a finite number");
  }
  return Math.max(0, Math.min(1, alpha));
}

function lerp(a, b, alpha) {
  return a + (b - a) * alpha;
}

function nearest(a, b, alpha) {
  return alpha < 0.5 ? a : b;
}

function asCanonicalConfig(value, label) {
  const candidate = value?.config ?? value;
  if (candidate === null || typeof candidate !== "object") {
    throw new InterpolationError(`${label} must be a model or configuration`);
  }
  try {
    return createConfig(candidate.kind, candidate);
  } catch (error) {
    throw new InterpolationError(`${label} is invalid: ${error.message}`);
  }
}

function enumFields(config) {
  const fields = [
    ["sampling", config.sampling],
    ["visualization.palette", config.visualization.palette],
  ];
  if (config.kind === "tusi-3d") {
    fields.push(
      ["phase.winding", config.phase.winding],
      ["seed[0]", config.seed[0]],
      ["seed[1]", config.seed[1]],
      ["seed[2]", config.seed[2]],
      ["orientationWindings.x", config.orientationWindings.x],
      ["orientationWindings.y", config.orientationWindings.y],
      ["orientationWindings.z", config.orientationWindings.z],
      ["orientationBends.x", config.orientationBends.x],
      ["orientationBends.y", config.orientationBends.y],
      ["orientationBends.z", config.orientationBends.z],
    );
  }
  if (config.kind.startsWith("not-tusi-")) {
    fields.push(["circulation", config.circulation]);
  }
  if (config.kind === "not-tusi-3d") {
    fields.push(["circlePlane", config.circlePlane]);
  }
  return fields;
}

/**
 * Linearly interpolate two compatible parameter configurations.
 * Continuous values are linear, pointCount is rounded, and alpha is clamped.
 */
export function interpolateParameters(a, b, alpha) {
  const amount = clampAlpha(alpha);
  const configA = asCanonicalConfig(a, "a");
  const configB = asCanonicalConfig(b, "b");

  if (configA.kind !== configB.kind) {
    throw new InterpolationError(
      `parameter interpolation requires matching model kinds; received ${configA.kind} and ${configB.kind}`,
    );
  }

  const enumsA = new Map(enumFields(configA));
  for (const [field, valueB] of enumFields(configB)) {
    const valueA = enumsA.get(field);
    if (valueA !== valueB) {
      throw new InterpolationError(
        `parameter interpolation requires matching ${field}; received ${String(valueA)} and ${String(valueB)}`,
      );
    }
  }

  if (amount === 0) return configA;
  if (amount === 1) return configB;

  const phase = Object.fromEntries(
    Object.keys(configA.phase).map((key) => [
      key,
      lerp(configA.phase[key], configB.phase[key], amount),
    ]),
  );

  const overrides = {
    schemaVersion: configA.schemaVersion,
    kind: configA.kind,
    center: configA.center.map((coordinate, axis) =>
      lerp(coordinate, configB.center[axis], amount),
    ),
    radius: lerp(configA.radius, configB.radius, amount),
    pointCount: Math.round(
      lerp(configA.pointCount, configB.pointCount, amount),
    ),
    angularSpeed: lerp(
      configA.angularSpeed,
      configB.angularSpeed,
      amount,
    ),
    sampling: configA.sampling,
    phase,
    animation: {
      time: lerp(configA.animation.time, configB.animation.time, amount),
      speed: lerp(configA.animation.speed, configB.animation.speed, amount),
      playing: nearest(
        configA.animation.playing,
        configB.animation.playing,
        amount,
      ),
    },
    visualization: {
      showPaths: nearest(
        configA.visualization.showPaths,
        configB.visualization.showPaths,
        amount,
      ),
      palette: configA.visualization.palette,
      pointSize: lerp(
        configA.visualization.pointSize,
        configB.visualization.pointSize,
        amount,
      ),
    },
  };

  if (configA.kind.startsWith("not-tusi-")) {
    overrides.orbitRatio = lerp(
      configA.orbitRatio,
      configB.orbitRatio,
      amount,
    );
    overrides.circulation = configA.circulation;
  }
  if (configA.kind === "not-tusi-3d") {
    overrides.circlePlane = configA.circlePlane;
  }
  if (configA.kind === "tusi-3d") {
    // These fields define the closed family of fixed diameters, or its
    // discrete timing winding. They must match (checked above) rather than
    // being silently reset to defaults or discontinuously rounded.
    overrides.seed = [...configA.seed];
    overrides.orientationWindings = { ...configA.orientationWindings };
    overrides.orientationBends = { ...configA.orientationBends };
  }

  return createConfig(configA.kind, overrides);
}

function asModel(value, label) {
  if (
    value !== null &&
    typeof value === "object" &&
    typeof value.sample === "function" &&
    Array.isArray(value.paths) &&
    value.config
  ) {
    return value;
  }
  try {
    return createModel(asCanonicalConfig(value, label));
  } catch (error) {
    if (error instanceof InterpolationError) throw error;
    throw new InterpolationError(`${label} is invalid: ${error.message}`);
  }
}

/**
 * Blend corresponding sampled points from two compatible configurations.
 * The models may differ in kind, but dimension, count, and sampling order must
 * match so correspondence is explicit rather than inferred or padded.
 */
export function interpolatePoints(a, b, time, alpha) {
  if (typeof time !== "number" || !Number.isFinite(time)) {
    throw new InterpolationError("time must be a finite number");
  }
  const amount = clampAlpha(alpha);
  const modelA = asModel(a, "a");
  const modelB = asModel(b, "b");

  if (modelA.dimension !== modelB.dimension) {
    throw new InterpolationError(
      `point interpolation requires equal dimensions; received ${modelA.dimension} and ${modelB.dimension}`,
    );
  }
  if (modelA.config.pointCount !== modelB.config.pointCount) {
    throw new InterpolationError(
      `point interpolation requires equal point counts; received ${modelA.config.pointCount} and ${modelB.config.pointCount}`,
    );
  }
  if (modelA.config.sampling !== modelB.config.sampling) {
    throw new InterpolationError(
      `point interpolation requires the same sampling order; received ${modelA.config.sampling} and ${modelB.config.sampling}`,
    );
  }
  if (
    modelA.paths.length !== modelB.paths.length ||
    modelA.paths.some((path, index) => path.index !== modelB.paths[index]?.index)
  ) {
    throw new InterpolationError(
      "point interpolation requires paths with the same indexed sampling order",
    );
  }

  const pointsA = modelA.sample(time);
  const pointsB = modelB.sample(time);
  if (amount === 0) return pointsA;
  if (amount === 1) return pointsB;
  return pointsA.map((pointA, index) => {
    const pointB = pointsB[index];
    return {
      index: pointA.index,
      pathIndex: pointA.pathIndex,
      position: pointA.position.map((coordinate, axis) =>
        lerp(coordinate, pointB.position[axis], amount),
      ),
      phase: lerp(pointA.phase, pointB.phase, amount),
      motionPhase: lerp(
        pointA.motionPhase,
        pointB.motionPhase,
        amount,
      ),
      traversalPhase: lerp(
        pointA.traversalPhase,
        pointB.traversalPhase,
        amount,
      ),
      signedRadius: lerp(
        pointA.signedRadius,
        pointB.signedRadius,
        amount,
      ),
      radius: lerp(pointA.radius, pointB.radius, amount),
      circulation: nearest(
        pointA.circulation,
        pointB.circulation,
        amount,
      ),
    };
  });
}
