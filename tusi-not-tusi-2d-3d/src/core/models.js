import { createConfig } from "./config.js";
import { TAU, fibonacciSphere, sphereTangentBasis } from "./geometry.js";

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function assertTime(time) {
  if (typeof time !== "number" || !Number.isFinite(time)) {
    throw new TypeError("time must be a finite number");
  }
}

function circulationForIndex(mode, index) {
  if (mode === "reverse") return -1;
  if (mode === "alternating") return index % 2 === 0 ? 1 : -1;
  return 1;
}

function addScaled(center, direction, scale) {
  return center.map((coordinate, axis) => coordinate + direction[axis] * scale);
}

function addVectors(center, ...vectors) {
  return center.map(
    (coordinate, axis) =>
      coordinate + vectors.reduce((sum, vector) => sum + vector[axis], 0),
  );
}

function rotateX3([x, y, z], angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return [x, cosine * y - sine * z, sine * y + cosine * z];
}

function rotateY3([x, y, z], angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return [cosine * x + sine * z, y, -sine * x + cosine * z];
}

function rotateZ3([x, y, z], angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return [cosine * x - sine * y, sine * x + cosine * y, z];
}

function eulerWoundDirection(seed, orientationWindings, orientationBends, parameter) {
  const bendPhase = Math.sin(parameter);
  const angle = (axis) => orientationWindings[axis] * parameter + orientationBends[axis] * bendPhase;
  const afterX = rotateX3(seed, angle("x"));
  const afterY = rotateY3(afterX, angle("y"));
  const direction = rotateZ3(afterY, angle("z"));
  const length = Math.hypot(...direction);
  return direction.map((coordinate) => coordinate / length);
}

function distanceFrom(position, center) {
  return Math.hypot(
    ...position.map((coordinate, axis) => coordinate - center[axis]),
  );
}

function signedDistance(radius, halfPhaseCosine) {
  return halfPhaseCosine < 0 ? -radius : radius;
}

function sampleAngles(pointCount, sampling) {
  const extent = sampling === "half-circle" ? Math.PI : TAU;
  return Object.freeze(
    Array.from({ length: pointCount }, (_, index) => (extent * index) / pointCount),
  );
}

function phase3D(config, sample) {
  return (
    config.phase.twist * sample.longitude +
    config.phase.pitch * sample.colatitude +
    config.phase.height * sample.z
  );
}

function createFrozenModel(kind, dimension, config, paths, sampleAtTime) {
  const frozenPaths = deepFreeze(paths);
  return Object.freeze({
    kind,
    dimension,
    config,
    paths: frozenPaths,
    sample(time = config.animation.time) {
      assertTime(time);
      return sampleAtTime(time);
    },
  });
}

/**
 * Create the 2-D Tusi sphere-of-lines analogue.
 * Motion phase is always `angularSpeed * time - phase`.
 */
export function createTusi2D(overrides = {}) {
  const config = createConfig("tusi-2d", overrides);
  const angles = sampleAngles(config.pointCount, config.sampling);
  const paths = angles.map((theta, index) => {
    const direction = [Math.cos(theta), Math.sin(theta)];
    return {
      index,
      type: "diameter",
      dimension: 2,
      theta,
      direction,
      start: addScaled(config.center, direction, -config.radius),
      end: addScaled(config.center, direction, config.radius),
    };
  });

  return createFrozenModel(
    config.kind,
    2,
    config,
    paths,
    (time) =>
      paths.map((path) => {
        const phase = config.phase.winding * path.theta;
        const motionPhase = config.angularSpeed * time - phase;
        const traversalPhase = motionPhase;
        const signedRadius = config.radius * Math.cos(motionPhase);
        return {
          index: path.index,
          pathIndex: path.index,
          position: addScaled(config.center, path.direction, signedRadius),
          phase,
          motionPhase,
          traversalPhase,
          signedRadius,
          radius: Math.abs(signedRadius),
          circulation: 0,
        };
      }),
  );
}

/**
 * Create the 2-D Not-Tusi circle construction.
 * `motionPhase` remains `angularSpeed * time - phase`; circulation is
 * represented separately by `traversalPhase`.
 */
export function createNotTusi2D(overrides = {}) {
  const config = createConfig("not-tusi-2d", overrides);
  const r2 = config.orbitRatio * config.radius;
  const r1 = config.radius - r2;
  const angles = sampleAngles(config.pointCount, config.sampling);
  const paths = angles.map((theta, index) => {
    const direction = [Math.cos(theta), Math.sin(theta)];
    return {
      index,
      type: "circle",
      dimension: 2,
      theta,
      direction,
      center: addScaled(config.center, direction, r1),
      radius: r2,
      basisU: [1, 0],
      basisV: [0, 1],
      circulation: circulationForIndex(config.circulation, index),
    };
  });

  return createFrozenModel(
    config.kind,
    2,
    config,
    paths,
    (time) =>
      paths.map((path) => {
        const phase = config.phase.winding * path.theta;
        const circulation = path.circulation;
        const motionPhase = config.angularSpeed * time - phase;
        const traversalPhase = circulation * config.angularSpeed * time - phase;
        const orbitVector = [
          r2 * Math.cos(traversalPhase),
          r2 * Math.sin(traversalPhase),
        ];
        const position = addVectors(path.center, orbitVector);
        const radius = distanceFrom(position, config.center);
        const relativeCirclePhase = traversalPhase - path.theta;
        return {
          index: path.index,
          pathIndex: path.index,
          position,
          phase,
          motionPhase,
          traversalPhase,
          signedRadius: signedDistance(
            radius,
            Math.cos(relativeCirclePhase / 2),
          ),
          radius,
          circulation,
        };
      }),
  );
}

/**
 * Create an Euler-rotated family of fixed 3-D diameter paths.
 *
 * Directions are evaluated absolutely from the normalized seed about fixed
 * global axes as
 * `Rz(z*s + bz*sin(s)) Ry(y*s + by*sin(s)) Rx(x*s + bx*sin(s)) seed`,
 * rather than by repeatedly applying one composite rotation. Integer turns
 * and real periodic bends (in radians) close the endpoint curve smoothly at
 * `s = 2*pi`. Zero bends reproduce the original integer-turn presets.
 */
export function createTusi3D(overrides = {}) {
  const config = createConfig("tusi-3d", overrides);
  const paths = Array.from({ length: config.pointCount }, (_, index) => {
    const parameter = (TAU * index) / config.pointCount;
    const direction = eulerWoundDirection(
      config.seed,
      config.orientationWindings,
      config.orientationBends,
      parameter,
    );
    return {
      index,
      id: `diameter-${index}`,
      role: "diameter",
      type: "diameter",
      dimension: 3,
      parameter,
      direction,
      start: addScaled(config.center, direction, -config.radius),
      end: addScaled(config.center, direction, config.radius),
    };
  });

  return createFrozenModel(
    config.kind,
    3,
    config,
    paths,
    (time) =>
      paths.map((path) => {
        const phase = config.phase.winding * path.parameter;
        const motionPhase = config.angularSpeed * time - phase;
        const traversalPhase = motionPhase;
        const signedRadius = config.radius * Math.cos(motionPhase);
        return {
          index: path.index,
          pathIndex: path.index,
          position: addScaled(config.center, path.direction, signedRadius),
          phase,
          motionPhase,
          traversalPhase,
          signedRadius,
          radius: Math.abs(signedRadius),
          circulation: 0,
        };
      }),
  );
}

/** Explicit name for the Euler-wound fixed-diameter 3-D Tusi factory. */
export function createEulerDiameterTusi3D(overrides = {}) {
  return createTusi3D(overrides);
}

/** Create the 3-D Not-Tusi sphere of fixed circular paths. */
export function createNotTusi3D(overrides = {}) {
  const config = createConfig("not-tusi-3d", overrides);
  const r2 = config.orbitRatio * config.radius;
  const r1 = config.radius - r2;
  const sphere = fibonacciSphere(config.pointCount);
  const paths = sphere.map((sample) => {
    const basis = sphereTangentBasis(sample, config.circlePlane);
    return {
      index: sample.index,
      type: "circle",
      dimension: 3,
      direction: [...sample.direction],
      longitude: sample.longitude,
      colatitude: sample.colatitude,
      z: sample.z,
      center: addScaled(config.center, sample.direction, r1),
      radius: r2,
      basisU: [...basis.radial],
      basisV: [...basis.tangent],
      normal: [...basis.normal],
      plane: config.circlePlane,
      circulation: circulationForIndex(config.circulation, sample.index),
    };
  });

  return createFrozenModel(
    config.kind,
    3,
    config,
    paths,
    (time) =>
      paths.map((path) => {
        const phase = phase3D(config, path);
        const circulation = path.circulation;
        const motionPhase = config.angularSpeed * time - phase;
        const traversalPhase = circulation * config.angularSpeed * time - phase;
        const orbitVector = path.basisU.map(
          (component, axis) =>
            r2 *
            (Math.cos(traversalPhase) * component +
              Math.sin(traversalPhase) * path.basisV[axis]),
        );
        const position = addVectors(path.center, orbitVector);
        const radius = distanceFrom(position, config.center);
        return {
          index: path.index,
          pathIndex: path.index,
          position,
          phase,
          motionPhase,
          traversalPhase,
          signedRadius: signedDistance(radius, Math.cos(traversalPhase / 2)),
          radius,
          circulation,
        };
      }),
  );
}

/** Dispatch to the appropriate named model factory using `config.kind`. */
export function createModel(config) {
  switch (config?.kind) {
    case "tusi-2d":
      return createTusi2D(config);
    case "not-tusi-2d":
      return createNotTusi2D(config);
    case "tusi-3d":
      return createTusi3D(config);
    case "not-tusi-3d":
      return createNotTusi3D(config);
    default:
      throw new TypeError(
        "config.kind must be tusi-2d, not-tusi-2d, tusi-3d, or not-tusi-3d",
      );
  }
}
