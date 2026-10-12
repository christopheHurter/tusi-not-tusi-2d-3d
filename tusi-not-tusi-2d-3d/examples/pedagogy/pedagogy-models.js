import {
  createEulerDiameterTusi3D,
  createNotTusi2D,
  createTusi2D,
  interpolateParameters,
  interpolatePoints,
} from "../../src/core/index.js";

const TAU = 2 * Math.PI;
const MAX_V4_MOTION_PATHS = 96;

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function finite(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new TypeError(`${name} must be finite.`);
  return number;
}

function integer(value, name, minimum = 1) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum) {
    throw new RangeError(`${name} must be an integer greater than or equal to ${minimum}.`);
  }
  return number;
}

function normalizedWeights(weights) {
  if (!Array.isArray(weights) || weights.length === 0) {
    throw new TypeError("weights must be a non-empty array.");
  }
  const values = weights.map((value, index) => {
    const weight = finite(value, `weights[${index}]`);
    if (weight < 0) throw new RangeError("weights cannot be negative.");
    return weight;
  });
  const total = values.reduce((sum, value) => sum + value, 0);
  if (!(total > 0)) throw new RangeError("at least one weight must be positive.");
  return values.map((value) => value / total);
}

/** Motion laws available on a fixed diameter in the introductory lesson. */
export const LINE_MOTION_PROFILES = deepFreeze([
  "harmonic",
  "constant-speed",
]);

const LINE_MOTION_PROFILE_SET = new Set(LINE_MOTION_PROFILES);

/**
 * A unit-amplitude triangular wave with the same endpoints and 2π period as
 * cos(phase). It moves at constant speed between endpoints and reverses
 * instantaneously at integer multiples of π.
 *
 * T(phase) = 1 - (2 / π) acos(cos(phase)).
 */
export function triangleWave(phase) {
  const angle = finite(phase, "phase");
  const wrapped = ((angle % TAU) + TAU) % TAU;
  return wrapped <= Math.PI
    ? 1 - (2 * wrapped) / Math.PI
    : (2 * wrapped) / Math.PI - 3;
}

/**
 * Return the signed velocity along a sample's fixed line.
 *
 * `phase` is the sample's fixed phase offset, so the motion phase is
 * `angularSpeed * time - phase`. Harmonic velocity is defined everywhere and
 * crosses zero smoothly. With nonzero amplitude, constant-speed velocity is
 * undefined at its instantaneous reversals, represented here by `null`. Zero
 * amplitude produces a constant position, so its velocity is defined as zero.
 */
export function lineSignedVelocityAtTime(
  motionProfile,
  config,
  time,
  phase = 0,
  amplitude = 1,
) {
  if (!LINE_MOTION_PROFILE_SET.has(motionProfile)) {
    throw new RangeError(
      `motionProfile must be one of: ${LINE_MOTION_PROFILES.join(", ")}.`,
    );
  }
  if (config === null || typeof config !== "object" || Array.isArray(config)) {
    throw new TypeError("config must be an object.");
  }
  const radius = finite(config.radius, "config.radius");
  const angularSpeed = finite(config.angularSpeed, "config.angularSpeed");
  const sampleTime = finite(time, "time");
  const phaseOffset = finite(phase, "phase");
  const amplitudeScale = finite(amplitude, "amplitude");
  if (radius < 0) throw new RangeError("config.radius cannot be negative.");
  if (amplitudeScale < 0 || amplitudeScale > 1) {
    throw new RangeError("amplitude must be between 0 and 1.");
  }
  if (radius === 0 || angularSpeed === 0 || amplitudeScale === 0) return 0;

  const motionPhase = angularSpeed * sampleTime - phaseOffset;
  if (motionProfile === "harmonic") {
    return -radius * amplitudeScale * angularSpeed * Math.sin(motionPhase);
  }

  const direction = Math.sin(motionPhase);
  if (Math.abs(direction) <= 1e-12) return null;
  return -(2 * radius * amplitudeScale * angularSpeed / Math.PI) * Math.sign(direction);
}

/**
 * Create fixed-diameter motion for the introductory Tusi lesson.
 *
 * Unique diameter directions use half-circle sampling by default, so N = 2
 * produces one horizontal and one vertical line rather than two copies of the
 * same unoriented diameter. `harmonic` is the canonical Tusi law R cos(m).
 * `constant-speed` replaces
 * only that scalar law with R T(m), retaining the same fixed paths, phase
 * convention, period, endpoints, and average path speed for a fair comparison.
 */
export function createLineOscillator2D({
  motionProfile = "harmonic",
  sampling = "half-circle",
  amplitude = 1,
  amplitudeShift = 0,
  ...config
} = {}) {
  if (!LINE_MOTION_PROFILE_SET.has(motionProfile)) {
    throw new RangeError(
      `motionProfile must be one of: ${LINE_MOTION_PROFILES.join(", ")}.`,
    );
  }
  const motionAmplitude = finite(amplitude, "amplitude");
  const motionAmplitudeShift = finite(amplitudeShift, "amplitudeShift");
  if (motionAmplitude < 0 || motionAmplitude > 1) {
    throw new RangeError("amplitude must be between 0 and 1.");
  }
  if (motionAmplitudeShift < -1 || motionAmplitudeShift > 1) {
    throw new RangeError("amplitudeShift must be between -1 and 1.");
  }
  if (motionAmplitude + Math.abs(motionAmplitudeShift) > 1 + 1e-12) {
    throw new RangeError("amplitude + |amplitudeShift| must be less than or equal to 1.");
  }
  const base = createTusi2D({ ...config, sampling });
  const center = base.config.center;

  return Object.freeze({
    kind: base.kind,
    dimension: base.dimension,
    config: base.config,
    paths: base.paths,
    motionProfile,
    amplitude: motionAmplitude,
    amplitudeShift: motionAmplitudeShift,
    sample(time = base.config.animation.time) {
      const sampleTime = finite(time, "time");
      return base.paths.map((path) => {
        const phase = base.config.phase.winding * path.theta;
        const motionPhase = base.config.angularSpeed * sampleTime - phase;
        const unitDisplacement = motionProfile === "harmonic"
          ? Math.cos(motionPhase)
          : triangleWave(motionPhase);
        const signedRadius = base.config.radius *
          (motionAmplitude * unitDisplacement + motionAmplitudeShift);
        return {
          index: path.index,
          pathIndex: path.index,
          position: center.map(
            (coordinate, axis) => coordinate + path.direction[axis] * signedRadius,
          ),
          phase,
          motionPhase,
          traversalPhase: motionPhase,
          signedRadius,
          radius: Math.abs(signedRadius),
          circulation: 0,
          motionProfile,
        };
      });
    },
  });
}

/** Closed turning-hoop construction used by the Simple 3-D experiment. */
export const HOOP_SHAPE_DEFAULTS = deepFreeze({
  diameterTurns: -1,
  hoopTurns: 2,
  tiltDegrees: 60,
});

/** Planar Lissajous oscillators mapped onto the unit sphere. */
export const LISSAJOUS_SHAPE_DEFAULTS = deepFreeze({
  horizontalCycles: 1,
  verticalCycles: 2,
  alignmentDegrees: 0,
});

/** A small circle carried around the sphere by an equatorial frame. */
export const EPICYCLE_SHAPE_DEFAULTS = deepFreeze({
  carrierTurns: 1,
  epicycleTurns: 2,
  angularRadiusDegrees: 35,
  destinationPhaseDegrees: 0,
});

/**
 * Reusable UI presets discovered while exploring the spherical Epicycle mode.
 *
 * These values deliberately live beside the experiment helpers rather than in
 * the core preset registry: selecting one restores both its geometry and the
 * accompanying display state without changing the public model schema.
 */
export const TUSI3D_EPICYCLE_PRESETS = deepFreeze([
  {
    id: "epicycle-four-corner-frame",
    label: "E1 Four-corner frame",
    pointCount: 567,
    radius: 1.15,
    epicycleShape: {
      carrierTurns: 19,
      epicycleTurns: 76,
      angularRadiusDegrees: 27,
      destinationPhaseDegrees: -30,
    },
    motionWinding: 0,
    motionProfile: "harmonic",
    pointSize: 10,
    colorGroups: 1,
    display: {
      showReferenceSphere: false,
      showEndpointPaths: false,
      showPaths: false,
      showSelected: false,
    },
  },
  {
    id: "epicycle-near-cusp-heart",
    label: "E2 Near-cusp heart",
    pointCount: 480,
    radius: 1,
    epicycleShape: {
      carrierTurns: 1,
      epicycleTurns: 4,
      angularRadiusDegrees: 14,
      destinationPhaseDegrees: 0,
    },
    motionWinding: 0,
    motionProfile: "harmonic",
    pointSize: 7,
    colorGroups: 1,
    display: {
      showReferenceSphere: false,
      showEndpointPaths: false,
      showPaths: false,
      showSelected: false,
    },
  },
  {
    id: "epicycle-twin-orbit",
    label: "E3 Twin orbit",
    pointCount: 360,
    radius: 1,
    epicycleShape: {
      carrierTurns: 1,
      epicycleTurns: 2,
      angularRadiusDegrees: 62,
      destinationPhaseDegrees: 85,
    },
    motionWinding: 0,
    motionProfile: "harmonic",
    pointSize: 9,
    colorGroups: 2,
    display: {
      showReferenceSphere: false,
      showEndpointPaths: false,
      showPaths: false,
      showSelected: false,
    },
  },
  {
    id: "epicycle-double-ribbon",
    label: "E4 Double ribbon",
    pointCount: 480,
    radius: 1,
    epicycleShape: {
      carrierTurns: 5,
      epicycleTurns: 2,
      angularRadiusDegrees: 55,
      destinationPhaseDegrees: 0,
    },
    motionWinding: 1,
    motionProfile: "harmonic",
    pointSize: 8,
    colorGroups: 2,
    display: {
      showReferenceSphere: false,
      showEndpointPaths: false,
      showPaths: false,
      showSelected: false,
    },
  },
  {
    id: "epicycle-five-blade-turbine",
    label: "E5 Five-blade turbine",
    pointCount: 520,
    radius: 1,
    epicycleShape: {
      carrierTurns: 4,
      epicycleTurns: 5,
      angularRadiusDegrees: 75,
      destinationPhaseDegrees: 130,
    },
    motionWinding: 1,
    motionProfile: "harmonic",
    pointSize: 8,
    colorGroups: 5,
    display: {
      showReferenceSphere: false,
      showEndpointPaths: false,
      showPaths: false,
      showSelected: false,
    },
  },
  {
    id: "epicycle-linear-four-cross",
    label: "E6 Linear four-cross",
    pointCount: 520,
    radius: 1,
    epicycleShape: {
      carrierTurns: 7,
      epicycleTurns: 4,
      angularRadiusDegrees: 60,
      destinationPhaseDegrees: 80,
    },
    motionWinding: 2,
    motionProfile: "constant-speed",
    pointSize: 8,
    colorGroups: 4,
    display: {
      showReferenceSphere: false,
      showEndpointPaths: false,
      showPaths: false,
      showSelected: false,
    },
  },
]);

function shapeNumber(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(name + " must be a finite number.");
  }
  return value;
}

function normalizeHoopShape(shape) {
  if (shape === null || typeof shape !== "object" || Array.isArray(shape)) {
    throw new TypeError("hoopShape must be an object.");
  }
  for (const key of Object.keys(shape)) {
    if (!Object.hasOwn(HOOP_SHAPE_DEFAULTS, key)) {
      throw new RangeError("Unsupported hoopShape field: " + key + ".");
    }
  }
  const values = Object.fromEntries(Object.entries(HOOP_SHAPE_DEFAULTS).map(([key, fallback]) => [
    key, shapeNumber(shape[key] === undefined ? fallback : shape[key], "hoopShape." + key),
  ]));
  for (const key of ["diameterTurns", "hoopTurns"]) {
    if (!Number.isInteger(values[key]) || values[key] < -100 || values[key] > 100) {
      throw new RangeError("hoopShape." + key + " must be an integer between -100 and 100.");
    }
  }
  if (values.tiltDegrees < 0 || values.tiltDegrees > 180) {
    throw new RangeError("hoopShape.tiltDegrees must be between 0 and 180.");
  }
  return deepFreeze(values);
}

function directionForHoopShape(parameter, { diameterTurns, hoopTurns, tiltDegrees }) {
  const theta = parameter % TAU;
  // These exact planar limits avoid spurious z residuals from sin(pi), and
  // zero tilt with the default turns is the ordinary full-circle Tusi order.
  if (tiltDegrees === 0 || tiltDegrees === 180) {
    const netTurns = hoopTurns + (tiltDegrees === 0 ? diameterTurns : -diameterTurns);
    return [Math.cos(netTurns * theta), Math.sin(netTurns * theta), 0];
  }
  const diameterAngle = diameterTurns * theta;
  const onHoop = [Math.cos(diameterAngle), Math.sin(diameterAngle), 0];
  const tilted = rotateX(onHoop, tiltDegrees * Math.PI / 180);
  return rotateZ(tilted, hoopTurns * theta);
}

/**
 * Unit direction for a diameter in a turning hoop; parameter is in radians.
 * Rz(hoopTurns*theta) Rx(tilt) Rz(diameterTurns*theta) [1,0,0].
 * Both turn counts are integers, so endpoint position and tangent close.
 * The hoop is a construction indexed by theta, not an additional motion:
 * each ball still travels along one time-independent antipodal diameter.
 */
export function hoopDiameterDirection(parameter, hoopShape = {}) {
  return directionForHoopShape(
    finite(parameter, "parameter"),
    normalizeHoopShape(hoopShape),
  );
}

function normalizeLissajousShape(shape) {
  if (shape === null || typeof shape !== "object" || Array.isArray(shape)) {
    throw new TypeError("lissajousShape must be an object.");
  }
  for (const key of Object.keys(shape)) {
    if (!Object.hasOwn(LISSAJOUS_SHAPE_DEFAULTS, key)) {
      throw new RangeError("Unsupported lissajousShape field: " + key + ".");
    }
  }
  const values = Object.fromEntries(Object.entries(LISSAJOUS_SHAPE_DEFAULTS).map(([key, fallback]) => [
    key, shapeNumber(shape[key] === undefined ? fallback : shape[key], "lissajousShape." + key),
  ]));
  for (const key of ["horizontalCycles", "verticalCycles"]) {
    if (!Number.isInteger(values[key]) || values[key] < 1 || values[key] > 100) {
      throw new RangeError("lissajousShape." + key + " must be an integer between 1 and 100.");
    }
  }
  if (values.alignmentDegrees < -180 || values.alignmentDegrees > 180) {
    throw new RangeError("lissajousShape.alignmentDegrees must be between -180 and 180.");
  }
  return deepFreeze(values);
}

function directionForLissajousShape(parameter, { horizontalCycles, verticalCycles, alignmentDegrees }) {
  const theta = parameter % TAU;
  // Equal cycles and zero alignment give an exact equator. In particular,
  // one cycle of each recovers the indexed full-circle 2-D Tusi directions.
  if (horizontalCycles === verticalCycles && alignmentDegrees === 0) {
    const angle = horizontalCycles * theta;
    return [Math.cos(angle), Math.sin(angle), 0];
  }
  const x = Math.cos(horizontalCycles * theta);
  const y = Math.sin(verticalCycles * theta + alignmentDegrees * Math.PI / 180);
  const squaredRadius = x * x + y * y;
  const denominator = 1 + squaredRadius;
  return [2 * x / denominator, 2 * y / denominator, (1 - squaredRadius) / denominator];
}

/**
 * Unit direction from a stereographic lift of two planar Lissajous oscillators.
 * Integer construction cycles close the endpoint curve; their relative
 * alignment changes geometry, not the separate phase of the moving balls.
 * The denominator is at least one, including when the planar curve crosses
 * the origin, and each direction defines a time-independent antipodal diameter.
 */
export function lissajousDiameterDirection(parameter, lissajousShape = {}) {
  return directionForLissajousShape(
    finite(parameter, "parameter"),
    normalizeLissajousShape(lissajousShape),
  );
}

function normalizeEpicycleShape(shape) {
  if (shape === null || typeof shape !== "object" || Array.isArray(shape)) {
    throw new TypeError("epicycleShape must be an object.");
  }
  for (const key of Object.keys(shape)) {
    if (!Object.hasOwn(EPICYCLE_SHAPE_DEFAULTS, key)) {
      throw new RangeError("Unsupported epicycleShape field: " + key + ".");
    }
  }
  const values = Object.fromEntries(Object.entries(EPICYCLE_SHAPE_DEFAULTS).map(([key, fallback]) => [
    key, shapeNumber(shape[key] === undefined ? fallback : shape[key], "epicycleShape." + key),
  ]));
  for (const key of ["carrierTurns", "epicycleTurns"]) {
    if (!Number.isInteger(values[key]) || values[key] < -100 || values[key] > 100) {
      throw new RangeError("epicycleShape." + key + " must be an integer between -100 and 100.");
    }
  }
  if (values.angularRadiusDegrees < 0 || values.angularRadiusDegrees > 90) {
    throw new RangeError("epicycleShape.angularRadiusDegrees must be between 0 and 90.");
  }
  if (values.destinationPhaseDegrees < -180 || values.destinationPhaseDegrees > 180) {
    throw new RangeError("epicycleShape.destinationPhaseDegrees must be between -180 and 180.");
  }
  return deepFreeze(values);
}

function directionForEpicycleShape(parameter, { carrierTurns, epicycleTurns, angularRadiusDegrees }) {
  const theta = parameter % TAU;
  // This exact limit is the ordinary equatorial diameter fan and avoids a
  // spurious z residual when the local angular radius is zero.
  if (angularRadiusDegrees === 0) {
    const carrierAngle = carrierTurns * theta;
    return [Math.cos(carrierAngle), Math.sin(carrierAngle), 0];
  }
  const carrierAngle = carrierTurns * theta;
  const epicycleAngle = epicycleTurns * theta;
  const angularRadius = angularRadiusDegrees * Math.PI / 180;
  const cosCarrier = Math.cos(carrierAngle);
  const sinCarrier = Math.sin(carrierAngle);
  const cosRadius = Math.cos(angularRadius);
  const sinRadius = Math.sin(angularRadius);
  const sinEpicycle = Math.sin(epicycleAngle);
  return [
    cosRadius * cosCarrier - sinRadius * sinEpicycle * sinCarrier,
    cosRadius * sinCarrier + sinRadius * sinEpicycle * cosCarrier,
    sinRadius * Math.cos(epicycleAngle),
  ];
}

/**
 * Unit direction from a spherical epicycle indexed by the construction angle.
 * The carrier supplies an equatorial unit direction and tangent; the epicycle
 * moves at a fixed angular distance within the tangent/vertical circle.
 * Integer turn counts close the curve. This constructs the direction of one
 * endpoint; an optional destination phase is applied only when pairing it
 * with the second endpoint in createLineOscillator3D. The construction is
 * independent of the separate playback time and motion winding.
 */
export function epicycleDiameterDirection(parameter, epicycleShape = {}) {
  return directionForEpicycleShape(
    finite(parameter, "parameter"),
    normalizeEpicycleShape(epicycleShape),
  );
}

/**
 * Compare harmonic and constant-speed motion on fixed 3-D diameters.
 *
 * Advanced geometry preserves the canonical core's Euler-wound paths exactly.
 * Simple, Lissajous, and Epicycle replace only their directions with a
 * turning-hoop, sphere-mapped Lissajous, or spherical-epicycle curve. A
 * nonzero Epicycle destination phase pairs -R*u(theta) with
 * +R*u(theta+delta), replacing the diameter by a fixed chord. Geometry modes,
 * shapes, and motion law belong to this experiment, not the core schema. No
 * geometry family depends on motion winding.
 */
export function createLineOscillator3D({
  motionProfile = "harmonic",
  geometryMode = "advanced",
  hoopShape = {},
  lissajousShape = {},
  epicycleShape = {},
  ...config
} = {}) {
  if (!LINE_MOTION_PROFILE_SET.has(motionProfile)) {
    throw new RangeError(
      `motionProfile must be one of: ${LINE_MOTION_PROFILES.join(", ")}.`,
    );
  }
  if (!["simple", "advanced", "lissajous", "epicycle"].includes(geometryMode)) {
    throw new RangeError("geometryMode must be simple, advanced, lissajous, or epicycle.");
  }
  for (const legacyField of ["spectralShape", "harmonicShape"]) {
    if (Object.hasOwn(config, legacyField)) {
      throw new RangeError(legacyField + " is no longer supported. Use hoopShape instead.");
    }
  }
  const shape = normalizeHoopShape(hoopShape);
  const lissajous = normalizeLissajousShape(lissajousShape);
  const epicycle = normalizeEpicycleShape(epicycleShape);
  const base = createEulerDiameterTusi3D(config);
  const center = base.config.center;
  const paths = geometryMode === "advanced"
    ? base.paths
    : deepFreeze(base.paths.map((path) => {
      let direction;
      if (geometryMode === "simple") direction = directionForHoopShape(path.parameter, shape);
      else if (geometryMode === "lissajous") direction = directionForLissajousShape(path.parameter, lissajous);
      else direction = directionForEpicycleShape(path.parameter, epicycle);
      if (geometryMode === "epicycle" && epicycle.destinationPhaseDegrees !== 0) {
        const destinationPhaseRadians = epicycle.destinationPhaseDegrees * Math.PI / 180;
        // Radial directions point from the sphere center to their named
        // endpoints. The origin is the negative end of the unshifted axis.
        const originDirection = direction.map((coordinate) => -coordinate);
        const destinationDirection = directionForEpicycleShape(
          path.parameter + destinationPhaseRadians,
          epicycle,
        );
        const start = center.map((coordinate, axis) =>
          coordinate + base.config.radius * originDirection[axis]);
        const end = center.map((coordinate, axis) =>
          coordinate + base.config.radius * destinationDirection[axis]);
        const midpoint = start.map((coordinate, axis) => (coordinate + end[axis]) / 2);
        const chordVectorOnUnitSphere = originDirection.map(
          (coordinate, axis) => destinationDirection[axis] - coordinate,
        );
        const unitSphereChordLength = Math.hypot(...chordVectorOnUnitSphere);
        const halfLength = base.config.radius * unitSphereChordLength / 2;
        const chordDirection = unitSphereChordLength > 1e-14
          ? chordVectorOnUnitSphere.map((coordinate) => coordinate / unitSphereChordLength)
          // At an exactly collapsed chord there is no unique line direction.
          // Retain a finite unit vector so existing renderer contracts remain
          // usable; `degenerate` and zero `halfLength` carry the true geometry.
          : [...direction];
        const centerOffset = midpoint.map((coordinate, axis) => coordinate - center[axis]);
        const centerOffsetDistance = Math.hypot(...centerOffset);
        return {
          ...path,
          role: "chord",
          // The renderer's `diameter` primitive is its finite line-segment
          // descriptor. Keep that compatibility tag while role names the
          // mathematical path accurately.
          type: "diameter",
          direction: chordDirection,
          start,
          end,
          originDirection,
          destinationDirection,
          midpoint,
          centerOffset,
          centerOffsetDistance,
          halfLength,
          chordLength: 2 * halfLength,
          destinationPhaseRadians,
          passesThroughCenter: centerOffsetDistance <= 1e-12 * Math.max(1, base.config.radius),
          degenerate: halfLength <= 1e-14 * Math.max(1, base.config.radius),
        };
      }
      return {
        ...path,
        direction,
        start: center.map((coordinate, axis) =>
          coordinate - base.config.radius * direction[axis]),
        end: center.map((coordinate, axis) =>
          coordinate + base.config.radius * direction[axis]),
      };
    }));

  return Object.freeze({
    kind: base.kind,
    dimension: base.dimension,
    config: base.config,
    paths,
    motionProfile,
    geometryMode,
    hoopShape: shape,
    lissajousShape: lissajous,
    epicycleShape: epicycle,
    sample(time = base.config.animation.time) {
      const sampleTime = finite(time, "time");
      return paths.map((path) => {
        const phase = base.config.phase.winding * path.parameter;
        const motionPhase = base.config.angularSpeed * sampleTime - phase;
        const unitDisplacement = motionProfile === "harmonic"
          ? Math.cos(motionPhase)
          : triangleWave(motionPhase);
        const signedRadius = base.config.radius * unitDisplacement;
        if (geometryMode === "epicycle" && epicycle.destinationPhaseDegrees !== 0) {
          const startWeight = (1 - unitDisplacement) / 2;
          const endWeight = (1 + unitDisplacement) / 2;
          const position = path.start.map((coordinate, axis) =>
            startWeight * coordinate + endWeight * path.end[axis]);
          return {
            index: path.index,
            pathIndex: path.index,
            position,
            phase,
            motionPhase,
            traversalPhase: motionPhase,
            // Retain the signed [-R,+R] motion coordinate used by the
            // radius palette. On a shifted chord this is not radial distance.
            signedRadius,
            // `radius` remains literal: distance of the sample from the sphere
            // center. At zero destination phase it is exactly |signedRadius|.
            radius: Math.hypot(...position.map((coordinate, axis) => coordinate - center[axis])),
            circulation: 0,
            motionProfile,
          };
        }
        return {
          index: path.index,
          pathIndex: path.index,
          position: center.map(
            (coordinate, axis) => coordinate + path.direction[axis] * signedRadius,
          ),
          phase,
          motionPhase,
          traversalPhase: motionPhase,
          signedRadius,
          radius: Math.abs(signedRadius),
          circulation: 0,
          motionProfile,
        };
      });
    },
  });
}

/**
 * Create the fixed-circle analogue used by the Not Tusi teaching page. The default equal
 * radius split (r₁ = r₂ = R/2) makes every local circle pass through the
 * common center while its point travels with constant angular speed.
 */
export function createFixedCircleOscillator2D({
  orbitRatio = 0.5,
  circulation = "forward",
  ...config
} = {}) {
  const base = createNotTusi2D({
    ...config,
    orbitRatio,
    circulation,
  });
  const orbitRadius = base.config.orbitRatio * base.config.radius;

  return Object.freeze({
    kind: base.kind,
    dimension: base.dimension,
    config: base.config,
    paths: base.paths,
    motionProfile: "constant-angular",
    carrierRadius: base.config.radius - orbitRadius,
    orbitRadius,
    sample(time = base.config.animation.time) {
      return base.sample(time);
    },
  });
}

/**
 * The four presets loaded by the historical "V3 circles interpolation" demo.
 * Positions use normalized selector-canvas coordinates: x grows rightward and
 * y grows downward, matching the original 600 x 600 canvas.
 */
export const V3_HISTORICAL_PRESETS = deepFreeze([
  {
    id: "P1",
    label: "Top left",
    position: [0.25, 0.25],
    pointCount: 120,
    shift: 20,
    colorCount: 6,
    smallRadius: 200,
    bigRadius: 100,
  },
  {
    id: "P2",
    label: "Top right",
    position: [0.75, 0.25],
    pointCount: 120,
    shift: -5,
    colorCount: 1,
    smallRadius: 20,
    bigRadius: 200,
  },
  {
    id: "P3",
    label: "Bottom right",
    position: [0.75, 0.75],
    pointCount: 120,
    shift: 169,
    colorCount: 5,
    smallRadius: 200,
    bigRadius: 100,
  },
  {
    id: "P4",
    label: "Bottom left",
    position: [0.25, 0.75],
    pointCount: 120,
    shift: 179,
    colorCount: 2,
    smallRadius: 200,
    bigRadius: 100,
  },
]);

/**
 * Four Tusi counterparts for the historical V3 presets.
 *
 * P1 is the hand-tuned visual match selected in the teaching interface. P2–P4
 * preserve N, color grouping, overall radius B + S, and the indexed radial
 * phase w = 1 - s (mod N). The paths necessarily remain diameters, so these
 * are close visual counterparts rather than identical constructions.
 */
export const TUSI_PARAMETER_PRESETS = deepFreeze([
  {
    id: "P1",
    label: "Top left match",
    position: [0.25, 0.25],
    pointCount: 120,
    winding: -31,
    radius: 241,
    amplitude: 0.97,
    amplitudeShift: -0.01,
    colorCount: 4,
  },
  {
    id: "P2",
    label: "Top right match",
    position: [0.75, 0.25],
    pointCount: 120,
    winding: 6,
    radius: 220,
    amplitude: 0.09,
    amplitudeShift: 0.91,
    colorCount: 1,
  },
  {
    id: "P3",
    label: "Bottom right match",
    position: [0.75, 0.75],
    pointCount: 120,
    winding: -48,
    radius: 300,
    amplitude: 0.33,
    amplitudeShift: 0.67,
    colorCount: 5,
  },
  {
    id: "P4",
    label: "Bottom left match",
    position: [0.25, 0.75],
    pointCount: 120,
    winding: -58,
    radius: 300,
    amplitude: 0.33,
    amplitudeShift: 0.67,
    colorCount: 2,
  },
]);

/** The repeated RGBA palette used by the historical V3 renderer. */
export const V3_LEGACY_COLORS = deepFreeze([
  "rgba(255,0,0,0.5)",
  "rgba(0,255,0,0.5)",
  "rgba(0,0,255,0.5)",
  "rgba(255,255,0,0.5)",
  "rgba(255,0,255,0.5)",
  "rgba(0,255,255,0.5)",
  "rgba(128,0,0,0.5)",
  "rgba(0,128,0,0.5)",
  "rgba(0,0,128,0.5)",
  "rgba(128,128,0,0.5)",
  "rgba(128,0,128,0.5)",
  "rgba(0,128,128,0.5)",
  "rgba(128,128,128,0.5)",
  "rgba(255,128,0,0.5)",
  "rgba(128,255,0,0.5)",
  "rgba(128,0,255,0.5)",
  "rgba(255,0,128,0.5)",
  "rgba(0,128,255,0.5)",
  "rgba(0,255,128,0.5)",
  "rgba(255,128,128,0.5)",
]);

function normalizeV3Preset(preset, label = "preset") {
  if (preset === null || typeof preset !== "object" || Array.isArray(preset)) {
    throw new TypeError(`${label} must be an object.`);
  }
  const pointCount = integer(preset.pointCount, `${label}.pointCount`);
  const shift = finite(preset.shift, `${label}.shift`);
  const colorCount = integer(preset.colorCount, `${label}.colorCount`);
  if (colorCount > V3_LEGACY_COLORS.length) {
    throw new RangeError(
      `${label}.colorCount cannot exceed ${V3_LEGACY_COLORS.length}.`,
    );
  }
  const smallRadius = finite(preset.smallRadius, `${label}.smallRadius`);
  const bigRadius = finite(preset.bigRadius, `${label}.bigRadius`);
  if (smallRadius < 0 || bigRadius < 0 || smallRadius + bigRadius <= 0) {
    throw new RangeError(
      `${label}.smallRadius and ${label}.bigRadius must be non-negative with a positive sum.`,
    );
  }
  const sampling = preset.sampling ?? "full-circle";
  if (sampling !== "full-circle" && sampling !== "half-circle") {
    throw new RangeError(`${label}.sampling must be full-circle or half-circle.`);
  }
  return {
    pointCount,
    shift,
    colorCount,
    smallRadius,
    bigRadius,
    sampling,
  };
}

function normalizeTusiParameterPreset(preset, label = "preset") {
  if (preset === null || typeof preset !== "object" || Array.isArray(preset)) {
    throw new TypeError(`${label} must be an object.`);
  }
  const pointCount = integer(preset.pointCount, `${label}.pointCount`);
  const winding = integer(preset.winding, `${label}.winding`, -Infinity);
  const radius = finite(preset.radius, `${label}.radius`);
  const amplitude = finite(preset.amplitude, `${label}.amplitude`);
  const amplitudeShift = finite(preset.amplitudeShift, `${label}.amplitudeShift`);
  const colorCount = integer(preset.colorCount, `${label}.colorCount`);
  if (radius <= 0) throw new RangeError(`${label}.radius must be positive.`);
  if (amplitude < 0 || amplitude > 1) {
    throw new RangeError(`${label}.amplitude must be between 0 and 1.`);
  }
  if (amplitudeShift < -1 || amplitudeShift > 1) {
    throw new RangeError(`${label}.amplitudeShift must be between -1 and 1.`);
  }
  if (amplitude + Math.abs(amplitudeShift) > 1 + 1e-12) {
    throw new RangeError(`${label} must satisfy amplitude + |amplitudeShift| <= 1.`);
  }
  if (colorCount > V3_LEGACY_COLORS.length) {
    throw new RangeError(
      `${label}.colorCount cannot exceed ${V3_LEGACY_COLORS.length}.`,
    );
  }
  return {
    pointCount,
    winding,
    radius,
    amplitude,
    amplitudeShift,
    colorCount,
  };
}

function parseRgba(color) {
  const match = /^rgba\((\d+),(\d+),(\d+),(\d*\.?\d+)\)$/.exec(color);
  if (!match) throw new TypeError(`Unsupported V3 color: ${color}`);
  return match.slice(1).map(Number);
}

function rgbaForNormalizedPreset(preset, index) {
  return parseRgba(V3_LEGACY_COLORS[index % preset.colorCount]);
}

function compactNumber(value) {
  const rounded = Math.abs(value - Math.round(value)) < 1e-12
    ? Math.round(value)
    : Number(value.toFixed(12));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function rgbaCss(rgba) {
  return `rgba(${rgba.map(compactNumber).join(",")})`;
}

/**
 * Convert an independent historical carrier/local-radius preset into the
 * publication core's canonical Not-Tusi configuration.
 */
export function v3PresetToConfig(preset) {
  const values = normalizeV3Preset(preset);
  const radius = values.bigRadius + values.smallRadius;
  return createNotTusi2D({
    radius,
    pointCount: values.pointCount,
    angularSpeed: 1,
    sampling: values.sampling,
    phase: { winding: -values.shift },
    orbitRatio: values.smallRadius / radius,
    circulation: "forward",
    animation: { time: 0, speed: 1, playing: true },
    visualization: { showPaths: false, palette: "phase", pointSize: 5 },
  }).config;
}

/** Return the historical repeated palette color for one indexed sample. */
export function v3ColorForIndex(preset, index) {
  const values = normalizeV3Preset(preset);
  const sampleIndex = integer(index, "index", 0);
  return V3_LEGACY_COLORS[sampleIndex % values.colorCount];
}

/**
 * Create the historical circle construction through the canonical Not-Tusi
 * core. Sample records additionally expose deterministic color and RGBA data.
 */
export function createV3CircleModel(preset) {
  const values = normalizeV3Preset(preset);
  const base = createNotTusi2D(v3PresetToConfig(values));
  const frozenPreset = deepFreeze({ ...values });
  return Object.freeze({
    kind: base.kind,
    dimension: base.dimension,
    config: base.config,
    paths: base.paths,
    preset: frozenPreset,
    sample(time = base.config.animation.time) {
      return base.sample(time).map((point) => {
        const rgba = rgbaForNormalizedPreset(values, point.index);
        return {
          ...point,
          color: rgbaCss(rgba),
          rgba: Object.freeze(rgba),
        };
      });
    },
  });
}

/** Create a full-circle harmonic Tusi model from one Parameter Sets preset. */
export function createTusiParameterModel(preset) {
  const values = normalizeTusiParameterPreset(preset);
  const base = createLineOscillator2D({
    motionProfile: "harmonic",
    sampling: "full-circle",
    pointCount: values.pointCount,
    radius: values.radius,
    angularSpeed: 1,
    phase: { winding: values.winding },
    amplitude: values.amplitude,
    amplitudeShift: values.amplitudeShift,
  });
  const frozenPreset = deepFreeze({ ...values });
  return Object.freeze({
    ...base,
    geometry: "tusi",
    preset: frozenPreset,
    sample(time = base.config.animation.time) {
      return base.sample(time).map((point) => {
        const rgba = rgbaForNormalizedPreset(values, point.index);
        return {
          ...point,
          color: rgbaCss(rgba),
          rgba: Object.freeze(rgba),
        };
      });
    },
  });
}

/**
 * Shepard-blend the five historical semantic fields, rounding once after the
 * complete weighted sum exactly as the original selector did.
 */
export function interpolateV3PresetSet(presets, weights) {
  if (!Array.isArray(presets) || presets.length === 0) {
    throw new TypeError("presets must be a non-empty array.");
  }
  if (presets.length !== weights?.length) {
    throw new RangeError("presets and weights must have the same length.");
  }
  const values = presets.map((preset, index) =>
    normalizeV3Preset(preset, `presets[${index}]`));
  const normalized = normalizedWeights(weights);
  const blend = (field) => Math.round(values.reduce(
    (sum, preset, index) => sum + normalized[index] * preset[field],
    0,
  ));
  return deepFreeze({
    pointCount: blend("pointCount"),
    shift: blend("shift"),
    colorCount: blend("colorCount"),
    smallRadius: blend("smallRadius"),
    bigRadius: blend("bigRadius"),
  });
}

/** Blend the Tusi preset family while preserving valid inside-circle motion. */
export function interpolateTusiParameterSet(presets, weights) {
  if (!Array.isArray(presets) || presets.length === 0) {
    throw new TypeError("presets must be a non-empty array.");
  }
  if (presets.length !== weights?.length) {
    throw new RangeError("presets and weights must have the same length.");
  }
  const values = presets.map((preset, index) =>
    normalizeTusiParameterPreset(preset, `presets[${index}]`));
  const normalized = normalizedWeights(weights);
  const blend = (field) => values.reduce(
    (sum, preset, index) => sum + normalized[index] * preset[field],
    0,
  );
  const compact = (value) => Number(value.toFixed(4));
  const amplitudeShift = compact(blend("amplitudeShift"));
  const amplitude = Math.min(
    compact(blend("amplitude")),
    compact(1 - Math.abs(amplitudeShift)),
  );
  return deepFreeze({
    pointCount: Math.round(blend("pointCount")),
    winding: Math.round(blend("winding")),
    radius: compact(blend("radius")),
    amplitude,
    amplitudeShift,
    colorCount: Math.round(blend("colorCount")),
  });
}

/**
 * Create a multi-anchor point-space blend. Unlike the historical prototype,
 * this validates correspondence eagerly and never pads or resamples points.
 */
export function createV3PointInterpolationFactory(presets) {
  if (!Array.isArray(presets) || presets.length === 0) {
    throw new TypeError("presets must be a non-empty array.");
  }
  const values = presets.map((preset, index) =>
    normalizeV3Preset(preset, `presets[${index}]`));
  const models = values.map(createV3CircleModel);
  const reference = models[0];
  for (let index = 1; index < models.length; index += 1) {
    const model = models[index];
    if (model.config.pointCount !== reference.config.pointCount) {
      throw new RangeError(
        `V3 point interpolation requires equal point counts; received ${reference.config.pointCount} and ${model.config.pointCount}.`,
      );
    }
    if (model.config.sampling !== reference.config.sampling) {
      throw new RangeError(
        `V3 point interpolation requires the same sampling order; received ${reference.config.sampling} and ${model.config.sampling}.`,
      );
    }
    if (
      model.paths.length !== reference.paths.length ||
      model.paths.some((path, pathIndex) => path.index !== reference.paths[pathIndex]?.index)
    ) {
      throw new RangeError(
        "V3 point interpolation requires paths with the same indexed sampling order.",
      );
    }
  }

  const extent = Math.max(...models.map((model) => model.config.radius));
  const config = deepFreeze({ ...reference.config, radius: extent });
  const frozenPresets = deepFreeze(values.map((preset) => ({ ...preset })));
  let cachedSampleTime = NaN;
  let cachedSamples = null;
  const samplesAt = (sampleTime) => {
    if (sampleTime !== cachedSampleTime) {
      cachedSampleTime = sampleTime;
      cachedSamples = models.map((model) => model.sample(sampleTime));
    }
    return cachedSamples;
  };

  return Object.freeze({
    create(weights) {
      if (presets.length !== weights?.length) {
        throw new RangeError("presets and weights must have the same length.");
      }
      const frozenWeights = deepFreeze([...normalizedWeights(weights)]);
      return Object.freeze({
        kind: "pedagogy-v3-point-interpolation",
        dimension: reference.dimension,
        config,
        paths: Object.freeze([]),
        presets: frozenPresets,
        weights: frozenWeights,
        sample(time = config.animation.time) {
          const sampleTime = finite(time, "time");
          const samples = samplesAt(sampleTime);
          return samples[0].map((referencePoint, pointIndex) => {
            const weighted = (field) => samples.reduce(
              (sum, points, modelIndex) =>
                sum + frozenWeights[modelIndex] * points[pointIndex][field],
              0,
            );
            const position = referencePoint.position.map((_, axis) =>
              samples.reduce(
                (sum, points, modelIndex) =>
                  sum + frozenWeights[modelIndex] * points[pointIndex].position[axis],
                0,
              ));
            const rgba = [0, 1, 2, 3].map((component) =>
              frozenPresets.reduce(
                (sum, preset, modelIndex) =>
                  sum + frozenWeights[modelIndex] * rgbaForNormalizedPreset(preset, pointIndex)[component],
                0,
              ));
            return {
              index: referencePoint.index,
              pathIndex: referencePoint.pathIndex,
              position,
              phase: weighted("phase"),
              motionPhase: weighted("motionPhase"),
              traversalPhase: weighted("traversalPhase"),
              signedRadius: weighted("signedRadius"),
              radius: Math.hypot(...position),
              circulation: referencePoint.circulation,
              color: rgbaCss(rgba),
              rgba: Object.freeze(rgba),
            };
          });
        },
      });
    },
  });
}

export function createV3PointInterpolationModel(presets, weights) {
  return createV3PointInterpolationFactory(presets).create(weights);
}

/** Prepare reusable Tusi anchor models for rapidly changing point weights. */
export function createTusiParameterPointInterpolationFactory(presets) {
  if (!Array.isArray(presets) || presets.length === 0) {
    throw new TypeError("presets must be a non-empty array.");
  }
  const values = presets.map((preset, index) =>
    normalizeTusiParameterPreset(preset, `presets[${index}]`));
  const models = values.map(createTusiParameterModel);
  const reference = models[0];
  for (let index = 1; index < models.length; index += 1) {
    const model = models[index];
    if (model.config.pointCount !== reference.config.pointCount) {
      throw new RangeError(
        `Tusi point interpolation requires equal point counts; received ${reference.config.pointCount} and ${model.config.pointCount}.`,
      );
    }
    if (model.config.sampling !== reference.config.sampling) {
      throw new RangeError(
        `Tusi point interpolation requires the same sampling order; received ${reference.config.sampling} and ${model.config.sampling}.`,
      );
    }
  }

  const extent = Math.max(...models.map((model) => model.config.radius));
  const config = deepFreeze({ ...reference.config, radius: extent });
  const frozenPresets = deepFreeze(values.map((preset) => ({ ...preset })));
  let cachedSampleTime = NaN;
  let cachedSamples = null;
  const samplesAt = (sampleTime) => {
    if (sampleTime !== cachedSampleTime) {
      cachedSampleTime = sampleTime;
      cachedSamples = models.map((model) => model.sample(sampleTime));
    }
    return cachedSamples;
  };

  return Object.freeze({
    create(weights) {
      if (presets.length !== weights?.length) {
        throw new RangeError("presets and weights must have the same length.");
      }
      const frozenWeights = deepFreeze([...normalizedWeights(weights)]);
      return Object.freeze({
        kind: "pedagogy-tusi-point-interpolation",
        geometry: "tusi",
        dimension: reference.dimension,
        config,
        paths: Object.freeze([]),
        presets: frozenPresets,
        weights: frozenWeights,
        sample(time = config.animation.time) {
          const sampleTime = finite(time, "time");
          const samples = samplesAt(sampleTime);
          return samples[0].map((referencePoint, pointIndex) => {
            const weighted = (field) => samples.reduce(
              (sum, points, modelIndex) =>
                sum + frozenWeights[modelIndex] * points[pointIndex][field],
              0,
            );
            const position = referencePoint.position.map((_, axis) =>
              samples.reduce(
                (sum, points, modelIndex) =>
                  sum + frozenWeights[modelIndex] * points[pointIndex].position[axis],
                0,
              ));
            const rgba = [0, 1, 2, 3].map((component) =>
              frozenPresets.reduce(
                (sum, preset, modelIndex) =>
                  sum + frozenWeights[modelIndex] * rgbaForNormalizedPreset(preset, pointIndex)[component],
                0,
              ));
            return {
              index: referencePoint.index,
              pathIndex: referencePoint.pathIndex,
              position,
              phase: weighted("phase"),
              motionPhase: weighted("motionPhase"),
              traversalPhase: weighted("traversalPhase"),
              signedRadius: weighted("signedRadius"),
              radius: Math.hypot(...position),
              circulation: referencePoint.circulation,
              color: rgbaCss(rgba),
              rgba: Object.freeze(rgba),
            };
          });
        },
      });
    },
  });
}

/** Blend corresponding indexed samples generated by multiple Tusi presets. */
export function createTusiParameterPointInterpolationModel(presets, weights) {
  return createTusiParameterPointInterpolationFactory(presets).create(weights);
}

/** Return robust inverse-distance weights with an exact-anchor short circuit. */
export function inverseDistanceWeights(query, anchors, power = 2) {
  if (!Array.isArray(query) || query.length !== 2 || !query.every(Number.isFinite)) {
    throw new TypeError("query must contain two finite coordinates.");
  }
  if (!Array.isArray(anchors) || anchors.length === 0) {
    throw new TypeError("anchors must be a non-empty array of 2-D positions.");
  }
  const exponent = finite(power, "power");
  if (!(exponent > 0)) throw new RangeError("power must be greater than zero.");

  const distances = anchors.map((anchor, index) => {
    const position = anchor.position ?? anchor;
    if (!Array.isArray(position) || position.length !== 2 || !position.every(Number.isFinite)) {
      throw new TypeError(`anchor ${index} must contain a finite 2-D position.`);
    }
    return Math.hypot(query[0] - position[0], query[1] - position[1]);
  });
  const exact = distances.findIndex((distance) => distance <= 1e-9);
  if (exact >= 0) return distances.map((_, index) => (index === exact ? 1 : 0));
  return normalizedWeights(distances.map((distance) => 1 / distance ** exponent));
}

/** Blend any number of compatible configurations using the public pairwise API. */
export function interpolateParameterSet(configs, weights) {
  if (!Array.isArray(configs) || configs.length === 0) {
    throw new TypeError("configs must be a non-empty array.");
  }
  if (configs.length !== weights?.length) {
    throw new RangeError("configs and weights must have the same length.");
  }
  const normalized = normalizedWeights(weights);
  const first = normalized.findIndex((weight) => weight > 0);
  let result = configs[first];
  let accumulated = normalized[first];
  for (let index = first + 1; index < configs.length; index += 1) {
    const weight = normalized[index];
    if (weight === 0) continue;
    const nextTotal = accumulated + weight;
    result = interpolateParameters(result, configs[index], weight / nextTotal);
    accumulated = nextTotal;
  }
  return result;
}

/**
 * Build a lazy point-space blend without padding or resampling. Every pairwise
 * step uses interpolatePoints, so incompatible sampling fails clearly.
 */
export function createWeightedPointModel(models, weights) {
  if (!Array.isArray(models) || models.length === 0) {
    throw new TypeError("models must be a non-empty array.");
  }
  if (models.length !== weights?.length) {
    throw new RangeError("models and weights must have the same length.");
  }
  const normalized = normalizedWeights(weights);
  const first = normalized.findIndex((weight) => weight > 0);
  let aggregate = models[first];
  let accumulated = normalized[first];

  for (let index = first + 1; index < models.length; index += 1) {
    const weight = normalized[index];
    if (weight === 0) continue;
    const previous = aggregate;
    const next = models[index];
    const nextTotal = accumulated + weight;
    const alpha = weight / nextTotal;
    aggregate = Object.freeze({
      kind: "pedagogy-weighted-point-interpolation",
      dimension: previous.dimension,
      config: previous.config,
      paths: previous.paths,
      sample(time) {
        return interpolatePoints(previous, next, time, alpha);
      },
    });
    accumulated = nextTotal;
  }
  return aggregate;
}

function rotateX([x, y, z], angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return [x, cosine * y - sine * z, sine * y + cosine * z];
}

function rotateY([x, y, z], angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return [cosine * x + sine * z, y, -sine * x + cosine * z];
}

function rotateZ([x, y, z], angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return [cosine * x - sine * y, sine * x + cosine * y, z];
}

function normalizeSeed(seed) {
  if (!Array.isArray(seed) || seed.length !== 3) {
    throw new TypeError("seed must contain three coordinates.");
  }
  const vector = seed.map((value, axis) => finite(value, `seed[${axis}]`));
  const length = Math.hypot(...vector);
  if (!(length > 1e-12)) throw new RangeError("seed must be non-zero.");
  return vector.map((value) => value / length);
}

/**
 * Clean, DOM-independent reconstruction of the historical V4 carrier-ring
 * lesson. This is a pedagogical model, not an additional manuscript model kind.
 */
export function createV4CarrierRingModel(overrides = {}) {
  const center = [...(overrides.center ?? [0, 0, 0])];
  if (center.length !== 3 || !center.every(Number.isFinite)) {
    throw new TypeError("center must contain three finite coordinates.");
  }
  const pointCount = integer(overrides.pointCount ?? 36, "pointCount");
  const carrierRadius = finite(overrides.carrierRadius ?? 1.35, "carrierRadius");
  const localRadius = finite(overrides.localRadius ?? 0.55, "localRadius");
  if (carrierRadius < 0 || localRadius < 0) {
    throw new RangeError("carrierRadius and localRadius cannot be negative.");
  }
  const angularSpeed = finite(overrides.angularSpeed ?? 0.8, "angularSpeed");
  const seed = normalizeSeed(overrides.seed ?? [0.58, 0.34, 0.74]);
  const rawPhase = overrides.phase ?? {};
  const phase = {
    x: integer(rawPhase.x ?? 1, "phase.x", -Infinity),
    y: integer(rawPhase.y ?? 1, "phase.y", -Infinity),
    z: integer(rawPhase.z ?? 1, "phase.z", -Infinity),
  };
  const rawAxes = overrides.animateAxes ?? {};
  const animateAxes = {
    x: rawAxes.x ?? true,
    y: rawAxes.y ?? true,
    z: rawAxes.z ?? true,
  };
  if (!Object.values(animateAxes).every((value) => typeof value === "boolean")) {
    throw new TypeError("animateAxes values must be boolean.");
  }
  const colorGroups = integer(overrides.colorGroups ?? 6, "colorGroups");
  const colors = overrides.colors == null
    ? null
    : [...overrides.colors].map((color, index) => {
      if (typeof color !== "string" || !color.trim()) {
        throw new TypeError(`colors[${index}] must be a CSS color string.`);
      }
      return color;
    });
  if (colors && (colors.length === 0 || colorGroups > colors.length)) {
    throw new RangeError("colors must contain at least colorGroups entries.");
  }
  const radius = carrierRadius + localRadius;
  const config = deepFreeze({
    kind: "pedagogy-v4-carrier-ring",
    center,
    radius: Math.max(radius, 1e-6),
    pointCount,
    angularSpeed,
    sampling: "carrier-ring",
    carrierRadius,
    localRadius,
    seed,
    phase,
    animateAxes,
    colorGroups,
    colors,
    visualization: {
      showPaths: overrides.visualization?.showPaths ?? true,
      palette: overrides.visualization?.palette ?? "phase",
      pointSize: finite(overrides.visualization?.pointSize ?? 10, "visualization.pointSize"),
    },
  });

  const centers = Array.from({ length: pointCount }, (_, index) => {
    const theta = (TAU * index) / pointCount;
    return {
      index,
      theta,
      position: [
        center[0] + carrierRadius * Math.cos(theta),
        center[1] + carrierRadius * Math.sin(theta),
        center[2],
      ],
    };
  });
  const local = seed.map((value) => value * localRadius);
  const axisPhaseAt = (entry, clock) => ({
    x: (animateAxes.x ? clock : 0) - phase.x * entry.theta,
    y: (animateAxes.y ? clock : 0) - phase.y * entry.theta,
    z: (animateAxes.z ? clock : 0) - phase.z * entry.theta,
  });
  const positionAt = (entry, clock) => {
    const axisPhase = axisPhaseAt(entry, clock);
    const rotated = rotateZ(
      rotateY(rotateX(local, axisPhase.x), axisPhase.y),
      axisPhase.z,
    );
    return {
      axisPhase,
      position: entry.position.map((value, axis) => value + rotated[axis]),
    };
  };
  const trajectorySegments = 128;
  const motionPathCount = Math.min(pointCount, MAX_V4_MOTION_PATHS);
  const motionPathCenters = Array.from({ length: motionPathCount }, (_, pathIndex) =>
    centers[Math.floor((pathIndex * pointCount) / motionPathCount)]);
  const paths = [
    {
      index: -1,
      type: "circle",
      dimension: 3,
      center: [...center],
      radius: carrierRadius,
      basisU: [1, 0, 0],
      basisV: [0, 1, 0],
      role: "carrier-ring",
    },
    ...motionPathCenters.map((entry) => ({
      index: entry.index,
      type: "curve",
      dimension: 3,
      center: [...entry.position],
      radius: localRadius,
      points: Array.from({ length: trajectorySegments }, (_, segment) =>
        positionAt(entry, (TAU * segment) / trajectorySegments).position),
      closed: true,
      role: "motion-path",
    })),
  ];

  return Object.freeze({
    kind: config.kind,
    dimension: 3,
    config,
    paths: deepFreeze(paths),
    sample(time = 0) {
      const clock = finite(time, "time") * angularSpeed;
      return centers.map((entry) => {
        const { axisPhase, position } = positionAt(entry, clock);
        const overallRadius = Math.hypot(
          position[0] - center[0],
          position[1] - center[1],
          position[2] - center[2],
        );
        return {
          index: entry.index,
          pathIndex: entry.index,
          position,
          phase: axisPhase.z,
          colorPhase: ((entry.index % colorGroups) / colorGroups) * TAU,
          motionPhase: clock,
          traversalPhase: clock,
          axisPhase,
          color: colors?.[entry.index % colorGroups],
          signedRadius: overallRadius,
          radius: overallRadius,
          circulation: 1,
        };
      });
    },
  });
}
