import assert from "node:assert/strict";
import test from "node:test";
import {
  LINE_MOTION_PROFILES,
  HOOP_SHAPE_DEFAULTS,
  LISSAJOUS_SHAPE_DEFAULTS,
  EPICYCLE_SHAPE_DEFAULTS,
  TUSI3D_EPICYCLE_PRESETS,
  TUSI_PARAMETER_PRESETS,
  V3_HISTORICAL_PRESETS,
  V3_LEGACY_COLORS,
  createFixedCircleOscillator2D,
  createLineOscillator2D,
  createLineOscillator3D,
  createTusiParameterModel,
  createTusiParameterPointInterpolationModel,
  createV3CircleModel,
  createV3PointInterpolationModel,
  createV4CarrierRingModel,
  createWeightedPointModel,
  epicycleDiameterDirection,
  hoopDiameterDirection,
  interpolateParameterSet,
  interpolateTusiParameterSet,
  interpolateV3PresetSet,
  inverseDistanceWeights,
  lissajousDiameterDirection,
  lineSignedVelocityAtTime,
  triangleWave,
  v3ColorForIndex,
  v3PresetToConfig,
} from "../examples/pedagogy/pedagogy-models.js";
import {
  V4_DEFAULT_PRESET_ID,
  V4_HISTORICAL_PRESETS,
  V4_LEGACY_COLORS,
  V4_PRESET_CAMERA_VIEWS,
  V4_PRESET_DISPLAY_DEFAULTS,
  v4PresetToConfig,
} from "../examples/pedagogy/v4-presets.js";
import { createEulerDiameterTusi3D, createModel, createNotTusi2D, getPreset } from "../src/core/index.js";

const TAU = 2 * Math.PI;

test("3-D Tusi uses the four Euler-wound geometry presets", () => {
  const expected = [
    ["tusi-3d-planar-ring", "G1", "Planar ring", { x: 0, y: 0, z: 1 }],
    ["tusi-3d-two-axis-loop", "G2", "Two-axis loop", { x: 1, y: 0, z: 2 }],
    ["tusi-3d-three-axis-weave", "G3", "Three-axis weave", { x: 1, y: 2, z: 3 }],
    ["tusi-3d-dense-weave", "G4", "Dense weave", { x: 2, y: 3, z: 5 }],
  ];
  for (const [id, paperCallout, label, orientationWindings] of expected) {
    const preset = getPreset(id);
    assert.equal(preset.kind, "tusi-3d");
    assert.equal(preset.paperCallout, paperCallout);
    assert.equal(preset.label, label);
    assert.deepEqual(preset.config.orientationWindings, orientationWindings);
    assert.deepEqual(preset.config.phase, { winding: 1 });
    assert.equal(preset.config.visualization.palette, "radius");
  }
});

test("3-D harmonic line motion exactly preserves core positions, metadata, and frozen geometry", () => {
  const configuration = {
    pointCount: 37,
    center: [0.2, -0.3, 0.4],
    radius: 1.7,
    angularSpeed: -1.4,
    seed: [0.3, -0.5, 0.8],
    orientationWindings: { x: -2, y: 3, z: 5 },
    orientationBends: { x: 0.35, y: -0.65, z: 1.15 },
    phase: { winding: -7 },
    animation: { time: 0.75 },
  };
  const core = createEulerDiameterTusi3D(configuration);
  const model = createLineOscillator3D(configuration);
  assert.equal(model.kind, "tusi-3d");
  assert.equal(model.dimension, 3);
  assert.equal(model.motionProfile, "harmonic");
  assert.equal(model.geometryMode, "advanced");
  assert.deepEqual(model.hoopShape, HOOP_SHAPE_DEFAULTS);
  assert.deepEqual(model.config, core.config);
  assert.deepEqual(model.paths, core.paths);
  assert.equal(Object.hasOwn(model.config, "motionProfile"), false);
  for (const value of [model, model.config, model.config.center,
    model.config.orientationBends, model.paths, model.paths[0],
    model.paths[0].direction, model.paths[0].start, model.paths[0].end]) {
    assert.equal(Object.isFrozen(value), true);
  }
  assert.throws(() => { model.config.radius = 4; }, TypeError);
  assert.throws(() => { model.paths[0].direction[0] = 4; }, TypeError);
  for (const time of [-3.1, 0, 0.37, 2.4]) {
    const points = model.sample(time);
    assert.equal(points.every((point) => point.motionProfile === "harmonic"), true);
    assert.deepEqual(points.map(({ motionProfile, ...point }) => point), core.sample(time));
  }
  assert.deepEqual(model.sample(), model.sample(configuration.animation.time));
  configuration.center[0] = 99;
  configuration.orientationBends.x = 99;
  assert.equal(model.config.center[0], 0.2);
  assert.equal(model.config.orientationBends.x, 0.35);
});

test("3-D linear motion changes only the displacement law on the same antipodal diameters", () => {
  const configuration = {
    pointCount: 17,
    center: [-0.3, 0.5, 0.7],
    radius: 2.1,
    angularSpeed: 1.3,
    orientationWindings: { x: 1, y: -2, z: 3 },
    orientationBends: { x: -0.8, y: 1.25, z: 0.45 },
    phase: { winding: 4 },
  };
  const harmonic = createLineOscillator3D(configuration);
  const linear = createLineOscillator3D({ ...configuration, motionProfile: "constant-speed" });
  assert.equal(linear.motionProfile, "constant-speed");
  assert.deepEqual(linear.config, harmonic.config);
  assert.deepEqual(linear.paths, harmonic.paths);
  const period = TAU / configuration.angularSpeed;
  const pathsBeforeSampling = structuredClone(linear.paths);
  for (const time of [-2.4, 0, 0.37, 3.7]) {
    const smoothPoints = harmonic.sample(time);
    const repeatedPoints = linear.sample(time + period);
    linear.sample(time).forEach((point, index) => {
      const path = linear.paths[index];
      const smooth = smoothPoints[index];
      const expectedSignedRadius = configuration.radius * triangleWave(point.motionPhase);
      assert.equal(point.signedRadius, expectedSignedRadius);
      assert.equal(point.radius, Math.abs(expectedSignedRadius));
      assert.equal(point.motionProfile, "constant-speed");
      for (const key of ["index", "pathIndex", "phase", "motionPhase", "traversalPhase", "circulation"]) {
        assert.equal(point[key], smooth[key]);
      }
      assert.ok(point.radius <= configuration.radius + 1e-12);
      for (let axis = 0; axis < 3; axis += 1) {
        assert.ok(Math.abs(point.position[axis] - configuration.center[axis] -
          path.direction[axis] * expectedSignedRadius) < 1e-12);
        assert.ok(Math.abs(point.position[axis] - repeatedPoints[index].position[axis]) < 1e-12);
      }
    });
  }
  for (const path of linear.paths) {
    const phase = configuration.phase.winding * path.parameter;
    const positiveTime = phase / configuration.angularSpeed;
    const negativeTime = (phase + Math.PI) / configuration.angularSpeed;
    const positive = linear.sample(positiveTime)[path.index];
    const negative = linear.sample(negativeTime)[path.index];
    assert.ok(Math.abs(positive.signedRadius - configuration.radius) < 1e-12);
    assert.ok(Math.abs(negative.signedRadius + configuration.radius) < 1e-12);
    assert.ok(Math.hypot(...positive.position.map((value, axis) => value - path.end[axis])) < 1e-12);
    assert.ok(Math.hypot(...negative.position.map((value, axis) => value - path.start[axis])) < 1e-12);
  }
  assert.deepEqual(linear.paths, pathsBeforeSampling);
});

test("3-D linear motion has constant speed on each leg and instantaneous reversals", () => {
  for (const angularSpeed of [-1.7, 1.7]) {
    const model = createLineOscillator3D({
      motionProfile: "constant-speed",
      pointCount: 11,
      radius: 2.3,
      angularSpeed,
      orientationBends: { x: 0.4, y: -0.7, z: 1.3 },
      phase: { winding: -3 },
    });
    const index = 4;
    const phase = model.config.phase.winding * model.paths[index].parameter;
    const h = 1e-6;
    const expectedSpeed = 2 * model.config.radius * Math.abs(angularSpeed) / Math.PI;
    for (const motionPhase of [0.2 * Math.PI, 0.7 * Math.PI, 1.2 * Math.PI, 1.7 * Math.PI]) {
      const time = (motionPhase + phase) / angularSpeed;
      const before = model.sample(time - h)[index];
      const after = model.sample(time + h)[index];
      const scalarVelocity = (after.signedRadius - before.signedRadius) / (2 * h);
      const speed = Math.hypot(...after.position.map((value, axis) =>
        (value - before.position[axis]) / (2 * h)));
      assert.ok(Math.abs(speed - expectedSpeed) < 1e-7);
      assert.ok(Math.abs(scalarVelocity - lineSignedVelocityAtTime(
        "constant-speed", model.config, time, phase,
      )) < 1e-7);
    }
    for (const motionPhase of [0, Math.PI]) {
      const time = (motionPhase + phase) / angularSpeed;
      const displacement = model.sample(time)[index].signedRadius;
      const leftVelocity = (displacement - model.sample(time - h)[index].signedRadius) / h;
      const rightVelocity = (model.sample(time + h)[index].signedRadius - displacement) / h;
      assert.ok(Math.abs(Math.abs(leftVelocity) - expectedSpeed) < 1e-7);
      assert.ok(Math.abs(Math.abs(rightVelocity) - expectedSpeed) < 1e-7);
      assert.equal(Math.sign(leftVelocity), -Math.sign(rightVelocity));
    }
  }
});

test("both 3-D line profiles stay finite, collinear, and radius-bounded at public control limits", () => {
  for (const motionProfile of LINE_MOTION_PROFILES) {
    const defaultModel = createLineOscillator3D({ motionProfile });
    assert.equal(defaultModel.config.pointCount, 200);
    assert.equal(defaultModel.sample().length, 200);
    for (const [pointCount, radius, winding] of [
      [3, 0.1, -100], [200, 2.5, 100], [1000, 0.1, -100], [1000, 2.5, 100],
    ]) {
      const model = createLineOscillator3D({
        motionProfile,
        pointCount,
        radius,
        center: [0.6, -0.4, 0.2],
        orientationWindings: { x: -100, y: 100, z: -100 },
        orientationBends: { x: -3, y: 3, z: -3 },
        phase: { winding },
      });
      for (const time of [-100, -Math.PI, 0, 0.4, 2.7, 100]) {
        const points = model.sample(time);
        assert.equal(points.length, pointCount);
        for (const point of points) {
          assert.equal(point.position.every(Number.isFinite), true);
          assert.equal([point.phase, point.motionPhase, point.signedRadius, point.radius].every(Number.isFinite), true);
          assert.ok(point.radius <= radius + 1e-12);
          const path = model.paths[point.pathIndex];
          const offset = point.position.map((value, axis) => value - model.config.center[axis]);
          assert.ok(Math.hypot(...offset) <= radius + 1e-12);
          assert.ok(Math.hypot(...offset.map((value, axis) =>
            value - point.signedRadius * path.direction[axis])) < 1e-12);
        }
      }
    }
    const stationary = createLineOscillator3D({ motionProfile, angularSpeed: 0 });
    assert.deepEqual(stationary.sample(0), stationary.sample(20));
  }
});

test("3-D line motion validates its profile and shares 2-D finite-time behavior", () => {
  for (const motionProfile of ["ease", "linear", "", null, 7]) {
    assert.throws(() => createLineOscillator3D({ motionProfile }), /motionProfile must be one of/);
  }
  assert.throws(() => createLineOscillator3D({ pointCount: 0 }), /pointCount must be a positive integer/);
  for (const motionProfile of LINE_MOTION_PROFILES) {
    const model = createLineOscillator3D({ motionProfile, animation: { time: 0.63 } });
    const planar = createLineOscillator2D({ motionProfile, animation: { time: 0.63 } });
    for (const time of [Number.NaN, Infinity, -Infinity, "not a time", {}]) {
      assert.throws(() => model.sample(time), /time must be finite/);
      assert.throws(() => planar.sample(time), /time must be finite/);
    }
    assert.deepEqual(model.sample(), model.sample(0.63));
    for (const time of ["0.5", null]) {
      assert.deepEqual(model.sample(time), model.sample(Number(time)));
      assert.deepEqual(planar.sample(time), planar.sample(Number(time)));
    }
  }
});

test("turning-hoop directions agree with an independent expanded rotation formula", () => {
  for (const diameterTurns of [-100, -3, -1, 0, 1, 100]) {
    for (const hoopTurns of [-100, -2, 0, 2, 100]) {
      for (const tiltDegrees of [0, 17.25, 60, 90, 179.9, 180]) {
        const shape = { diameterTurns, hoopTurns, tiltDegrees };
        const tilt = tiltDegrees * Math.PI / 180;
        for (let index = 0; index < 37; index += 1) {
          const theta = TAU * index / 37;
          const diameter = diameterTurns * theta;
          const hoop = hoopTurns * theta;
          const expected = [
            Math.cos(hoop) * Math.cos(diameter) - Math.sin(hoop) * Math.cos(tilt) * Math.sin(diameter),
            Math.sin(hoop) * Math.cos(diameter) + Math.cos(hoop) * Math.cos(tilt) * Math.sin(diameter),
            Math.sin(tilt) * Math.sin(diameter),
          ];
          const actual = hoopDiameterDirection(theta, shape);
          assert.ok(Math.hypot(...actual.map((value, axis) => value - expected[axis])) < 1e-12);
        }
      }
    }
  }
});

test("turning-hoop curves preserve unit length and smooth position/tangent closure at control limits", () => {
  const shapes = [
    HOOP_SHAPE_DEFAULTS,
    { diameterTurns: -100, hoopTurns: 100, tiltDegrees: 0 },
    { diameterTurns: 100, hoopTurns: 100, tiltDegrees: 0 },
    { diameterTurns: -100, hoopTurns: 100, tiltDegrees: 90 },
    { diameterTurns: 100, hoopTurns: -100, tiltDegrees: 179.9 },
    { diameterTurns: -100, hoopTurns: 100, tiltDegrees: 180 },
    { diameterTurns: 0, hoopTurns: 0, tiltDegrees: 73.2 },
  ];
  for (const shape of shapes) {
    assert.deepEqual(hoopDiameterDirection(0, shape), hoopDiameterDirection(TAU, shape));
    const tilt = shape.tiltDegrees * Math.PI / 180;
    const expectedDerivative = [
      0,
      shape.hoopTurns + shape.diameterTurns * Math.cos(tilt),
      shape.diameterTurns * Math.sin(tilt),
    ];
    const h = 1e-6;
    for (const seam of [0, TAU]) {
      const before = hoopDiameterDirection(seam - h, shape);
      const after = hoopDiameterDirection(seam + h, shape);
      const derivative = after.map((value, axis) => (value - before[axis]) / (2 * h));
      assert.ok(Math.hypot(...derivative.map((value, axis) => value - expectedDerivative[axis])) < 1e-5);
    }
    for (let index = 0; index < 1000; index += 1) {
      const theta = TAU * index / 1000;
      const direction = hoopDiameterDirection(theta, shape);
      const repeated = hoopDiameterDirection(theta + TAU, shape);
      assert.equal(direction.every(Number.isFinite), true);
      assert.ok(Math.abs(Math.hypot(...direction) - 1) < 1e-12);
      assert.ok(Math.hypot(...direction.map((value, axis) => value - repeated[axis])) < 1e-12);
    }
  }
});

test("zero hoop tilt uses the sum of turns and exactly recovers standard full-circle Tusi by default", () => {
  for (const [diameterTurns, hoopTurns] of [[-1, 2], [-3, 5], [2, -2], [-100, -100]]) {
    for (let index = 0; index < 101; index += 1) {
      const theta = TAU * index / 101;
      const angle = (diameterTurns + hoopTurns) * theta;
      assert.deepEqual(hoopDiameterDirection(theta, { diameterTurns, hoopTurns, tiltDegrees: 0 }),
        [Math.cos(angle), Math.sin(angle), 0]);
    }
  }
  for (const motionProfile of LINE_MOTION_PROFILES) {
    const common = { pointCount: 41, radius: 2.5, angularSpeed: 1.3, phase: { winding: -3 } };
    const planar = createLineOscillator2D({ ...common, motionProfile, sampling: "full-circle" });
    const simple = createLineOscillator3D({
      ...common, motionProfile, geometryMode: "simple", hoopShape: { tiltDegrees: 0 },
    });
    for (const time of [0, 0.3, 1.7]) {
      const expected = planar.sample(time);
      for (const point of simple.sample(time)) {
        assert.equal(point.position[2], 0);
        assert.deepEqual(point.position.slice(0, 2), expected[point.index].position);
      }
    }
  }
});

test("zero hoop turns fixes a tilted plane and 180-degree tilt reverses the diameter contribution", () => {
  for (const tiltDegrees of [0, 17.25, 60, 90, 180]) {
    const tilt = tiltDegrees * Math.PI / 180;
    const normal = [0, -Math.sin(tilt), Math.cos(tilt)];
    for (let index = 0; index < 101; index += 1) {
      const theta = TAU * index / 101;
      const direction = hoopDiameterDirection(theta, { diameterTurns: 3, hoopTurns: 0, tiltDegrees });
      assert.ok(Math.abs(direction.reduce((sum, value, axis) => sum + value * normal[axis], 0)) < 1e-12);
    }
  }
  for (const [diameterTurns, hoopTurns] of [[-1, 2], [-3, 5], [2, -2], [-100, 100]]) {
    for (let index = 0; index < 101; index += 1) {
      const theta = TAU * index / 101;
      const angle = (hoopTurns - diameterTurns) * theta;
      assert.deepEqual(hoopDiameterDirection(theta, { diameterTurns, hoopTurns, tiltDegrees: 180 }),
        [Math.cos(angle), Math.sin(angle), 0]);
    }
  }
});

test("each hoop control changes generic geometry, fractional tilt varies continuously, and defaults are nonplanar", () => {
  const thetaValues = Array.from({ length: 97 }, (_, index) => TAU * index / 97);
  const shapes = [
    { ...HOOP_SHAPE_DEFAULTS, diameterTurns: -2 },
    { ...HOOP_SHAPE_DEFAULTS, hoopTurns: 3 },
    { ...HOOP_SHAPE_DEFAULTS, tiltDegrees: 25.5 },
  ];
  for (const shape of shapes) {
    const largestChange = Math.max(...thetaValues.map((theta) => {
      const baseline = hoopDiameterDirection(theta);
      return Math.hypot(...hoopDiameterDirection(theta, shape).map((value, axis) => value - baseline[axis]));
    }));
    assert.ok(largestChange > 0.2);
  }
  for (const theta of thetaValues) {
    const at = hoopDiameterDirection(theta, { tiltDegrees: 73.25 });
    for (const tiltDegrees of [73.25 - 1e-5, 73.25 + 1e-5]) {
      const near = hoopDiameterDirection(theta, { tiltDegrees });
      assert.ok(Math.hypot(...at.map((value, axis) => value - near[axis])) < 1.8e-7);
    }
  }
  const a = hoopDiameterDirection(0);
  const b = hoopDiameterDirection(Math.PI / 2);
  const c = hoopDiameterDirection(Math.PI / 4);
  const determinant = a[0] * (b[1] * c[2] - b[2] * c[1]) -
    a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  assert.ok(Math.abs(determinant) > 0.2);
});

test("both turning-hoop motions preserve antipodal fixed diameters and radius bounds at N = 1000", () => {
  for (const motionProfile of LINE_MOTION_PROFILES) {
    for (const hoopShape of [
      HOOP_SHAPE_DEFAULTS,
      { diameterTurns: -100, hoopTurns: 100, tiltDegrees: 0 },
      { diameterTurns: 100, hoopTurns: -100, tiltDegrees: 90 },
      { diameterTurns: -100, hoopTurns: 100, tiltDegrees: 180 },
    ]) {
      const model = createLineOscillator3D({
        geometryMode: "simple", hoopShape, motionProfile, pointCount: 1000,
        center: [0.3, -0.5, 0.7], radius: 2.5, angularSpeed: 1.3, phase: { winding: -100 },
      });
      const fixedPaths = structuredClone(model.paths);
      assert.equal(model.paths.length, 1000);
      for (const path of model.paths) {
        assert.equal(path.type, "diameter");
        assert.equal(path.role, "diameter");
        assert.equal(path.dimension, 3);
        assert.ok(Math.abs(Math.hypot(...path.direction) - 1) < 1e-12);
        for (let axis = 0; axis < 3; axis += 1) {
          assert.ok(Math.abs(path.start[axis] + path.end[axis] - 2 * model.config.center[axis]) < 1e-12);
          assert.ok(Math.abs(path.end[axis] - model.config.center[axis] - 2.5 * path.direction[axis]) < 1e-12);
        }
      }
      for (const time of [-100, -Math.PI, 0, 0.4, 2.7, 100]) {
        const points = model.sample(time);
        assert.equal(points.length, 1000);
        for (const point of points) {
          assert.equal(point.position.every(Number.isFinite), true);
          assert.ok(point.radius <= 2.5 + 1e-12);
          const expectedRadius = 2.5 * (motionProfile === "harmonic"
            ? Math.cos(point.motionPhase) : triangleWave(point.motionPhase));
          assert.equal(point.signedRadius, expectedRadius);
          const path = model.paths[point.index];
          const offset = point.position.map((value, axis) => value - model.config.center[axis]);
          assert.ok(Math.hypot(...offset) <= 2.5 + 1e-12);
          assert.ok(Math.hypot(...offset.map((value, axis) =>
            value - point.signedRadius * path.direction[axis])) < 1e-12);
        }
      }
      const path = model.paths[137];
      const phase = model.config.phase.winding * path.parameter;
      for (const [motionPhase, endpoint] of [[0, path.end], [Math.PI, path.start]]) {
        const point = model.sample((phase + motionPhase) / model.config.angularSpeed)[path.index];
        assert.ok(Math.hypot(...point.position.map((value, axis) => value - endpoint[axis])) < 1e-12);
      }
      assert.deepEqual(model.paths, fixedPaths);
    }
  }
});

test("hoop geometry is independent of time, phase and Advanced settings and retains centered radius scaling", () => {
  const options = {
    geometryMode: "simple", hoopShape: { diameterTurns: 3, hoopTurns: -2, tiltDegrees: 73.25 },
    pointCount: 29, center: [0.3, -0.5, 0.7], radius: 0.5, phase: { winding: 1 },
    animation: { time: 0.6 },
  };
  const base = createLineOscillator3D(options);
  const otherOrientation = createLineOscillator3D({
    ...options, seed: [1, 0, 0], orientationWindings: { x: -100, y: 100, z: -9 },
    orientationBends: { x: -3, y: 3, z: 1.1 },
  });
  const otherPhase = createLineOscillator3D({ ...options, phase: { winding: 7 } });
  const otherTime = createLineOscillator3D({ ...options, animation: { time: 1.4 } });
  assert.deepEqual(base.paths, otherOrientation.paths);
  assert.deepEqual(base.sample(), otherOrientation.sample());
  assert.deepEqual(base.paths, otherPhase.paths);
  assert.deepEqual(base.paths, otherTime.paths);
  assert.notDeepEqual(base.sample(), otherPhase.sample());
  assert.notDeepEqual(base.sample(), otherTime.sample());
  assert.deepEqual(base.sample(), base.sample(0.6));
  assert.equal(base.geometryMode, "simple");
  assert.deepEqual(base.hoopShape, options.hoopShape);
  for (const key of ["geometryMode", "hoopShape", "lissajousShape", "epicycleShape", "spectralShape", "harmonicShape", "motionProfile"]) {
    assert.equal(Object.hasOwn(base.config, key), false);
  }
  assert.equal(Object.hasOwn(base, "harmonicShape"), false);
  assert.equal(Object.hasOwn(base, "spectralShape"), false);
  for (const value of [base, base.config, base.paths, base.paths[0], base.paths[0].direction,
    base.paths[0].start, base.paths[0].end, base.hoopShape]) {
    assert.equal(Object.isFrozen(value), true);
  }
  options.hoopShape.tiltDegrees = 10;
  assert.equal(base.hoopShape.tiltDegrees, 73.25);
  assert.throws(() => { base.hoopShape.diameterTurns = 5; }, TypeError);
  assert.throws(() => { base.hoopShape.tiltDegrees = 5; }, TypeError);
  for (const motionProfile of LINE_MOTION_PROFILES) {
    const small = createLineOscillator3D({ ...options, motionProfile });
    const large = createLineOscillator3D({ ...options, motionProfile, radius: 2.5 });
    const smallPoints = small.sample(0.37);
    large.sample(0.37).forEach((point, index) => {
      assert.deepEqual(large.paths[index].direction, small.paths[index].direction);
      for (let axis = 0; axis < 3; axis += 1) {
        assert.ok(Math.abs(point.position[axis] - options.center[axis] -
          5 * (smallPoints[index].position[axis] - options.center[axis])) < 1e-12);
      }
    });
  }
});

test("hoop defaults clone omitted fields and never alter Advanced geometry", () => {
  assert.deepEqual(HOOP_SHAPE_DEFAULTS, { diameterTurns: -1, hoopTurns: 2, tiltDegrees: 60 });
  assert.equal(Object.isFrozen(HOOP_SHAPE_DEFAULTS), true);
  const a = createLineOscillator3D({ geometryMode: "simple" });
  const b = createLineOscillator3D({ geometryMode: "simple", hoopShape: HOOP_SHAPE_DEFAULTS });
  assert.deepEqual(a.hoopShape, HOOP_SHAPE_DEFAULTS);
  assert.deepEqual(a.paths, b.paths);
  assert.notEqual(a.hoopShape, HOOP_SHAPE_DEFAULTS);
  const partial = createLineOscillator3D({ hoopShape: { tiltDegrees: 47.25 } });
  assert.deepEqual(partial.hoopShape, { ...HOOP_SHAPE_DEFAULTS, tiltDegrees: 47.25 });
  for (const motionProfile of LINE_MOTION_PROFILES) {
    const advanced = createLineOscillator3D({ motionProfile });
    const changedShape = createLineOscillator3D({
      motionProfile, hoopShape: { diameterTurns: 100, hoopTurns: -100, tiltDegrees: 180 },
    });
    assert.deepEqual(advanced.config, changedShape.config);
    assert.deepEqual(advanced.paths, changedShape.paths);
    assert.deepEqual(advanced.sample(0.3), changedShape.sample(0.3));
  }
});

test("hoop geometry rejects invalid structure, numbers, ranges and both retired shape APIs", async () => {
  const module = await import("../examples/pedagogy/pedagogy-models.js");
  for (const retired of ["harmonicDiameterDirection", "spectralDiameterDirection", "SPECTRAL_SHAPE_DEFAULTS", "MAX_SPECTRAL_COMPONENTS"]) {
    assert.equal(Object.hasOwn(module, retired), false);
  }
  for (const legacy of ["harmonicShape", "spectralShape"]) {
    for (const value of [{}, undefined, null]) {
      assert.throws(() => createLineOscillator3D({ [legacy]: value }), /is no longer supported. Use hoopShape/);
    }
  }
  for (const geometryMode of ["", "euler", null, 1]) {
    assert.throws(() => createLineOscillator3D({ geometryMode }), /geometryMode must be simple, advanced, lissajous, or epicycle/);
  }
  for (const hoopShape of [null, [], "2", 2]) {
    assert.throws(() => createLineOscillator3D({ hoopShape }), /hoopShape must be an object/);
    assert.throws(() => hoopDiameterDirection(0, hoopShape), /hoopShape must be an object/);
  }
  const badShapes = [{ tilt: 60 }, { turns: 1 }, { diameterTurns: -1, extra: 0 }, { waves: 2 }, { heightOffset: 0 }];
  for (const key of ["diameterTurns", "hoopTurns"]) {
    for (const value of [null, false, "1", NaN, Infinity, -Infinity, -101, 101, 1.2]) {
      badShapes.push({ [key]: value });
    }
  }
  for (const tiltDegrees of [null, false, "60", NaN, Infinity, -Infinity, -0.01, 180.01]) {
    badShapes.push({ tiltDegrees });
  }
  for (const hoopShape of badShapes) {
    for (const geometryMode of ["simple", "advanced"]) {
      assert.throws(() => createLineOscillator3D({ geometryMode, hoopShape }), /hoopShape/);
    }
    assert.throws(() => hoopDiameterDirection(0, hoopShape), /hoopShape/);
  }
  for (const parameter of [NaN, Infinity, -Infinity, "bad"]) {
    assert.throws(() => hoopDiameterDirection(parameter), /parameter must be finite/);
  }
  for (const parameter of [-1e308, 1e308]) {
    assert.equal(hoopDiameterDirection(parameter).every(Number.isFinite), true);
  }
});

test("Lissajous defaults are frozen and do not alter the existing Simple or Advanced families", () => {
  assert.deepEqual(LISSAJOUS_SHAPE_DEFAULTS, {
    horizontalCycles: 1, verticalCycles: 2, alignmentDegrees: 0,
  });
  assert.equal(Object.isFrozen(LISSAJOUS_SHAPE_DEFAULTS), true);
  const defaultModel = createLineOscillator3D();
  assert.equal(defaultModel.geometryMode, "advanced");
  assert.deepEqual(defaultModel.lissajousShape, LISSAJOUS_SHAPE_DEFAULTS);
  const omitted = createLineOscillator3D({ geometryMode: "lissajous" });
  const explicit = createLineOscillator3D({
    geometryMode: "lissajous", lissajousShape: LISSAJOUS_SHAPE_DEFAULTS,
  });
  assert.equal(omitted.config.pointCount, 200);
  assert.deepEqual(omitted.paths, explicit.paths);
  assert.deepEqual(omitted.lissajousShape, LISSAJOUS_SHAPE_DEFAULTS);
  assert.notEqual(omitted.lissajousShape, LISSAJOUS_SHAPE_DEFAULTS);
  assert.notEqual(omitted.lissajousShape, explicit.lissajousShape);
  const partial = createLineOscillator3D({ lissajousShape: { alignmentDegrees: -47.25 } });
  assert.deepEqual(partial.lissajousShape, { ...LISSAJOUS_SHAPE_DEFAULTS, alignmentDegrees: -47.25 });
  for (const geometryMode of ["simple", "advanced"]) {
    for (const motionProfile of LINE_MOTION_PROFILES) {
      const baseline = createLineOscillator3D({ geometryMode, motionProfile });
      const changedShape = createLineOscillator3D({
        geometryMode, motionProfile,
        lissajousShape: { horizontalCycles: 100, verticalCycles: 99, alignmentDegrees: 179.25 },
      });
      assert.deepEqual(baseline.config, changedShape.config);
      assert.deepEqual(baseline.hoopShape, changedShape.hoopShape);
      assert.deepEqual(baseline.paths, changedShape.paths);
      assert.deepEqual(baseline.sample(0.37), changedShape.sample(0.37));
    }
  }
});

test("Lissajous directions match an independent stereographic formula", () => {
  for (const horizontalCycles of [1, 2, 7, 100]) {
    for (const verticalCycles of [1, 2, 5, 100]) {
      for (const alignmentDegrees of [-180, -73.25, 0, 51.5, 180]) {
        const shape = { horizontalCycles, verticalCycles, alignmentDegrees };
        for (const theta of [-0.37, 0, 0.13, 0.8, 1.9, TAU - 1e-7, TAU + 0.42]) {
          const x = Math.cos(horizontalCycles * theta);
          const y = Math.sin(verticalCycles * theta + alignmentDegrees * Math.PI / 180);
          const squaredRadius = x ** 2 + y ** 2;
          const expected = [2 * x, 2 * y, 1 - squaredRadius].map((value) => value / (1 + squaredRadius));
          const actual = lissajousDiameterDirection(theta, shape);
          assert.ok(Math.hypot(...actual.map((value, axis) => value - expected[axis])) < 1e-12);
        }
      }
    }
  }
});

test("Lissajous curves remain finite and unit length with smooth position and tangent closure", () => {
  const shapes = [
    LISSAJOUS_SHAPE_DEFAULTS,
    { horizontalCycles: 1, verticalCycles: 1, alignmentDegrees: 0 },
    { horizontalCycles: 1, verticalCycles: 100, alignmentDegrees: -180 },
    { horizontalCycles: 100, verticalCycles: 1, alignmentDegrees: 180 },
    { horizontalCycles: 100, verticalCycles: 99, alignmentDegrees: 37.25 },
    { horizontalCycles: 100, verticalCycles: 100, alignmentDegrees: 0 },
  ];
  for (const shape of shapes) {
    assert.deepEqual(lissajousDiameterDirection(0, shape), lissajousDiameterDirection(TAU, shape));
    const phi = shape.alignmentDegrees * Math.PI / 180;
    const y = Math.sin(phi);
    const yDerivative = shape.verticalCycles * Math.cos(phi);
    const denominator = 2 + y * y;
    const denominatorDerivative = 2 * y * yDerivative;
    const expectedDerivative = [
      -2 * denominatorDerivative / denominator ** 2,
      2 * yDerivative / denominator - 2 * y * denominatorDerivative / denominator ** 2,
      -2 * denominatorDerivative / denominator ** 2,
    ];
    const h = 1e-6;
    for (const seam of [0, TAU]) {
      const before = lissajousDiameterDirection(seam - h, shape);
      const after = lissajousDiameterDirection(seam + h, shape);
      const derivative = after.map((value, axis) => (value - before[axis]) / (2 * h));
      assert.ok(Math.hypot(...derivative.map((value, axis) => value - expectedDerivative[axis])) < 1e-5);
    }
    for (let index = 0; index < 1000; index += 1) {
      const theta = TAU * index / 1000;
      const direction = lissajousDiameterDirection(theta, shape);
      const repeated = lissajousDiameterDirection(theta + TAU, shape);
      assert.equal(direction.every(Number.isFinite), true);
      assert.ok(Math.abs(Math.hypot(...direction) - 1) < 1e-12);
      assert.ok(direction[2] >= -1 / 3 - 1e-12 && direction[2] <= 1);
      assert.ok(Math.hypot(...direction.map((value, axis) => value - repeated[axis])) < 1e-12);
    }
  }
});

test("Lissajous planar origin crossings map continuously to a valid sphere pole", () => {
  for (const theta of [Math.PI / 2, 3 * Math.PI / 2]) {
    const at = lissajousDiameterDirection(theta);
    assert.equal(at.every(Number.isFinite), true);
    assert.ok(Math.hypot(at[0], at[1], at[2] - 1) < 1e-14);
    for (const nearbyTheta of [theta - 1e-7, theta + 1e-7]) {
      const nearby = lissajousDiameterDirection(nearbyTheta);
      assert.equal(nearby.every(Number.isFinite), true);
      assert.ok(Math.hypot(...nearby.map((value, axis) => value - at[axis])) < 1e-6);
    }
  }
  const model = createLineOscillator3D({ geometryMode: "lissajous", pointCount: 4, radius: 2.5 });
  for (const index of [1, 3]) {
    assert.ok(Math.hypot(...model.paths[index].end.map((value, axis) => value - [0, 0, 2.5][axis])) < 1e-14);
    assert.ok(Math.hypot(...model.paths[index].start.map((value, axis) => value - [0, 0, -2.5][axis])) < 1e-14);
  }
});

test("one cycle per Lissajous oscillator with zero alignment exactly recovers both 2-D line laws", () => {
  const lissajousShape = { horizontalCycles: 1, verticalCycles: 1, alignmentDegrees: 0 };
  for (let index = 0; index < 101; index += 1) {
    const theta = TAU * index / 101;
    assert.deepEqual(lissajousDiameterDirection(theta, lissajousShape), [Math.cos(theta), Math.sin(theta), 0]);
  }
  for (const motionProfile of LINE_MOTION_PROFILES) {
    const common = { pointCount: 41, radius: 2.5, angularSpeed: 1.3, phase: { winding: -3 } };
    const planar = createLineOscillator2D({
      ...common, motionProfile, center: [0.3, -0.5], sampling: "full-circle",
    });
    const lifted = createLineOscillator3D({
      ...common, motionProfile, center: [0.3, -0.5, 0.7], geometryMode: "lissajous", lissajousShape,
    });
    for (const time of [-1.2, 0, 0.3, 1.7]) {
      const expected = planar.sample(time);
      for (const point of lifted.sample(time)) {
        assert.equal(point.position[2], 0.7);
        assert.deepEqual(point.position.slice(0, 2), expected[point.index].position);
        for (const key of ["phase", "motionPhase", "signedRadius", "radius"]) {
          assert.equal(point[key], expected[point.index][key]);
        }
      }
    }
  }
});

test("each Lissajous control affects generic geometry and real alignment remains continuous", () => {
  const thetaValues = Array.from({ length: 97 }, (_, index) => TAU * index / 97);
  for (const shape of [
    { ...LISSAJOUS_SHAPE_DEFAULTS, horizontalCycles: 2 },
    { ...LISSAJOUS_SHAPE_DEFAULTS, verticalCycles: 3 },
    { ...LISSAJOUS_SHAPE_DEFAULTS, alignmentDegrees: 35.25 },
  ]) {
    const largestChange = Math.max(...thetaValues.map((theta) => {
      const baseline = lissajousDiameterDirection(theta);
      return Math.hypot(...lissajousDiameterDirection(theta, shape).map((value, axis) => value - baseline[axis]));
    }));
    assert.ok(largestChange > 0.2);
  }
  for (const theta of thetaValues) {
    const at = lissajousDiameterDirection(theta, { alignmentDegrees: 37.25 });
    for (const alignmentDegrees of [37.25 - 1e-5, 37.25 + 1e-5]) {
      const near = lissajousDiameterDirection(theta, { alignmentDegrees });
      assert.ok(Math.hypot(...at.map((value, axis) => value - near[axis])) < 4e-7);
    }
    const left = lissajousDiameterDirection(theta, { alignmentDegrees: -180 });
    const right = lissajousDiameterDirection(theta, { alignmentDegrees: 180 });
    assert.ok(Math.hypot(...left.map((value, axis) => value - right[axis])) < 1e-12);
  }
  const a = lissajousDiameterDirection(0);
  const b = lissajousDiameterDirection(Math.PI / 2);
  const c = lissajousDiameterDirection(Math.PI / 4);
  const determinant = a[0] * (b[1] * c[2] - b[2] * c[1]) -
    a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  assert.ok(Math.abs(determinant) > 0.7);
});

test("both Lissajous motions preserve antipodal fixed diameters and radius bounds at N = 1000", () => {
  for (const motionProfile of LINE_MOTION_PROFILES) {
    for (const [pointCount, radius, winding, lissajousShape] of [
      [3, 0.1, -100, LISSAJOUS_SHAPE_DEFAULTS],
      [200, 2.5, 100, LISSAJOUS_SHAPE_DEFAULTS],
      [1000, 0.1, -100, { horizontalCycles: 1, verticalCycles: 100, alignmentDegrees: -180 }],
      [1000, 2.5, 100, { horizontalCycles: 100, verticalCycles: 1, alignmentDegrees: 180 }],
      [1000, 2.5, -100, { horizontalCycles: 100, verticalCycles: 99, alignmentDegrees: 37.25 }],
    ]) {
      const model = createLineOscillator3D({
        geometryMode: "lissajous", lissajousShape, motionProfile, pointCount,
        center: [0.3, -0.5, 0.7], radius, angularSpeed: 1.3, phase: { winding },
      });
      const fixedPaths = structuredClone(model.paths);
      assert.equal(model.paths.length, pointCount);
      for (const path of model.paths) {
        assert.equal(path.type, "diameter");
        assert.equal(path.role, "diameter");
        assert.equal(path.dimension, 3);
        assert.ok(Math.abs(Math.hypot(...path.direction) - 1) < 1e-12);
        for (let axis = 0; axis < 3; axis += 1) {
          assert.ok(Math.abs(path.start[axis] + path.end[axis] - 2 * model.config.center[axis]) < 1e-12);
          assert.ok(Math.abs(path.end[axis] - model.config.center[axis] - radius * path.direction[axis]) < 1e-12);
        }
      }
      const period = TAU / model.config.angularSpeed;
      for (const time of [-100, -Math.PI, 0, 0.4, 2.7, 100]) {
        const points = model.sample(time);
        const repeated = model.sample(time + period);
        assert.equal(points.length, pointCount);
        for (const point of points) {
          assert.equal(point.position.every(Number.isFinite), true);
          assert.equal([point.phase, point.motionPhase, point.signedRadius, point.radius].every(Number.isFinite), true);
          const expectedRadius = radius * (motionProfile === "harmonic"
            ? Math.cos(point.motionPhase) : triangleWave(point.motionPhase));
          assert.equal(point.signedRadius, expectedRadius);
          assert.ok(point.radius <= radius + 1e-12);
          const path = model.paths[point.index];
          const offset = point.position.map((value, axis) => value - model.config.center[axis]);
          assert.ok(Math.hypot(...offset) <= radius + 1e-12);
          assert.ok(Math.hypot(...offset.map((value, axis) => value - point.signedRadius * path.direction[axis])) < 1e-12);
          assert.ok(Math.hypot(...point.position.map((value, axis) => value - repeated[point.index].position[axis])) < 1e-12);
        }
      }
      const path = model.paths[Math.min(137, pointCount - 1)];
      const phase = model.config.phase.winding * path.parameter;
      for (const [motionPhase, endpoint] of [[0, path.end], [Math.PI, path.start]]) {
        const point = model.sample((phase + motionPhase) / model.config.angularSpeed)[path.index];
        assert.ok(Math.hypot(...point.position.map((value, axis) => value - endpoint[axis])) < 1e-12);
      }
      assert.deepEqual(model.paths, fixedPaths);
    }
  }
});

test("Lissajous geometry separates curve alignment from time, motion phase, hoop shape and radius", () => {
  const options = {
    geometryMode: "lissajous",
    lissajousShape: { horizontalCycles: 3, verticalCycles: 2, alignmentDegrees: -73.25 },
    pointCount: 29, center: [0.3, -0.5, 0.7], radius: 0.5, phase: { winding: 1 },
    animation: { time: 0.6 },
  };
  const base = createLineOscillator3D(options);
  const otherConstruction = createLineOscillator3D({
    ...options, seed: [1, 0, 0], orientationWindings: { x: -100, y: 100, z: -9 },
    orientationBends: { x: -3, y: 3, z: 1.1 },
    hoopShape: { diameterTurns: 100, hoopTurns: -100, tiltDegrees: 180 },
  });
  const otherPhase = createLineOscillator3D({ ...options, phase: { winding: 7 } });
  const otherTime = createLineOscillator3D({ ...options, animation: { time: 1.4 } });
  const otherAlignment = createLineOscillator3D({
    ...options, lissajousShape: { ...options.lissajousShape, alignmentDegrees: 25.5 },
  });
  assert.deepEqual(base.paths, otherConstruction.paths);
  assert.deepEqual(base.sample(), otherConstruction.sample());
  assert.deepEqual(base.paths, otherPhase.paths);
  assert.deepEqual(base.paths, otherTime.paths);
  assert.notDeepEqual(base.sample(), otherPhase.sample());
  assert.notDeepEqual(base.sample(), otherTime.sample());
  assert.notDeepEqual(base.paths, otherAlignment.paths);
  assert.deepEqual(base.sample().map((point) => point.phase), otherAlignment.sample().map((point) => point.phase));
  assert.deepEqual(base.sample(), base.sample(0.6));
  assert.equal(base.geometryMode, "lissajous");
  assert.deepEqual(base.lissajousShape, options.lissajousShape);
  for (const key of ["geometryMode", "hoopShape", "lissajousShape", "epicycleShape", "spectralShape", "harmonicShape", "motionProfile"]) {
    assert.equal(Object.hasOwn(base.config, key), false);
  }
  for (const value of [base, base.config, base.paths, base.paths[0], base.paths[0].direction,
    base.paths[0].start, base.paths[0].end, base.lissajousShape]) {
    assert.equal(Object.isFrozen(value), true);
  }
  options.lissajousShape.alignmentDegrees = 10;
  assert.equal(base.lissajousShape.alignmentDegrees, -73.25);
  assert.throws(() => { base.lissajousShape.horizontalCycles = 5; }, TypeError);
  assert.throws(() => { base.lissajousShape.alignmentDegrees = 5; }, TypeError);
  for (const motionProfile of LINE_MOTION_PROFILES) {
    const small = createLineOscillator3D({ ...options, motionProfile });
    const large = createLineOscillator3D({ ...options, motionProfile, radius: 2.5 });
    const smallPoints = small.sample(0.37);
    large.sample(0.37).forEach((point, index) => {
      assert.deepEqual(large.paths[index].direction, small.paths[index].direction);
      for (let axis = 0; axis < 3; axis += 1) {
        assert.ok(Math.abs(point.position[axis] - options.center[axis] -
          5 * (smallPoints[index].position[axis] - options.center[axis])) < 1e-12);
        assert.ok(Math.abs(large.paths[index].end[axis] - options.center[axis] -
          5 * (small.paths[index].end[axis] - options.center[axis])) < 1e-12);
      }
    });
    const stationary = createLineOscillator3D({ ...options, motionProfile, angularSpeed: 0 });
    assert.deepEqual(stationary.sample(0), stationary.sample(20));
  }
});

test("Lissajous shapes reject invalid structures, coerced numbers, ranges and unsupported amplitude fields", () => {
  for (const lissajousShape of [null, [], "2", 2, false]) {
    assert.throws(() => createLineOscillator3D({ lissajousShape }), /lissajousShape must be an object/);
    assert.throws(() => lissajousDiameterDirection(0, lissajousShape), /lissajousShape must be an object/);
  }
  const badShapes = [
    { horizontalFrequency: 1 }, { phase: 0 }, { horizontalAmplitude: 1 },
    { verticalAmplitude: 1 }, { horizontalCycles: 1, extra: 0 }, { turns: 1 },
  ];
  for (const key of ["horizontalCycles", "verticalCycles"]) {
    for (const value of [null, false, "1", NaN, Infinity, -Infinity, -1, 0, 101, 1.2]) {
      badShapes.push({ [key]: value });
    }
  }
  for (const alignmentDegrees of [null, false, "0", NaN, Infinity, -Infinity, -180.01, 180.01]) {
    badShapes.push({ alignmentDegrees });
  }
  for (const lissajousShape of badShapes) {
    for (const geometryMode of ["simple", "advanced", "lissajous", "epicycle"]) {
      assert.throws(() => createLineOscillator3D({ geometryMode, lissajousShape }), /lissajousShape/);
    }
    assert.throws(() => lissajousDiameterDirection(0, lissajousShape), /lissajousShape/);
  }
  for (const parameter of [NaN, Infinity, -Infinity, "bad"]) {
    assert.throws(() => lissajousDiameterDirection(parameter), /parameter must be finite/);
  }
  for (const parameter of [-1e308, 1e308, "0.5", null]) {
    assert.equal(lissajousDiameterDirection(parameter).every(Number.isFinite), true);
  }
  for (const motionProfile of LINE_MOTION_PROFILES) {
    const model = createLineOscillator3D({ geometryMode: "lissajous", motionProfile });
    for (const time of [NaN, Infinity, -Infinity, "bad"]) {
      assert.throws(() => model.sample(time), /time must be finite/);
    }
  }
});

test("Epicycle defaults are frozen and leave the existing three geometry modes unchanged", () => {
  assert.deepEqual(EPICYCLE_SHAPE_DEFAULTS, {
    carrierTurns: 1, epicycleTurns: 2, angularRadiusDegrees: 35,
    destinationPhaseDegrees: 0,
  });
  assert.equal(Object.isFrozen(EPICYCLE_SHAPE_DEFAULTS), true);
  const defaultModel = createLineOscillator3D();
  assert.equal(defaultModel.geometryMode, "advanced");
  assert.deepEqual(defaultModel.epicycleShape, EPICYCLE_SHAPE_DEFAULTS);
  const omitted = createLineOscillator3D({ geometryMode: "epicycle" });
  const explicit = createLineOscillator3D({
    geometryMode: "epicycle", epicycleShape: EPICYCLE_SHAPE_DEFAULTS,
  });
  assert.deepEqual(omitted.paths, explicit.paths);
  assert.deepEqual(omitted.epicycleShape, EPICYCLE_SHAPE_DEFAULTS);
  assert.notEqual(omitted.epicycleShape, EPICYCLE_SHAPE_DEFAULTS);
  assert.notEqual(omitted.epicycleShape, explicit.epicycleShape);
  const partial = createLineOscillator3D({ epicycleShape: { angularRadiusDegrees: 47.25 } });
  assert.deepEqual(partial.epicycleShape, { ...EPICYCLE_SHAPE_DEFAULTS, angularRadiusDegrees: 47.25 });
  for (const geometryMode of ["simple", "advanced", "lissajous"]) {
    for (const motionProfile of LINE_MOTION_PROFILES) {
      const baseline = createLineOscillator3D({ geometryMode, motionProfile });
      const changedShape = createLineOscillator3D({
        geometryMode, motionProfile,
        epicycleShape: {
          carrierTurns: -100,
          epicycleTurns: 100,
          angularRadiusDegrees: 90,
          destinationPhaseDegrees: -137.25,
        },
      });
      assert.deepEqual(baseline.config, changedShape.config);
      assert.deepEqual(baseline.paths, changedShape.paths);
      assert.deepEqual(baseline.sample(0.37), changedShape.sample(0.37));
    }
  }
});

test("the saved Epicycle UI presets exactly preserve the curated catalog", () => {
  const expectedPresets = [
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
  ];
  assert.deepEqual(TUSI3D_EPICYCLE_PRESETS, expectedPresets);
  assert.equal(
    new Set(TUSI3D_EPICYCLE_PRESETS.map((preset) => preset.id)).size,
    TUSI3D_EPICYCLE_PRESETS.length,
  );
  assert.equal(Object.isFrozen(TUSI3D_EPICYCLE_PRESETS), true);

  for (const preset of TUSI3D_EPICYCLE_PRESETS) {
    for (const value of [preset, preset.epicycleShape, preset.display]) {
      assert.equal(Object.isFrozen(value), true, `${preset.id} must be deeply frozen`);
    }
    assert.deepEqual(preset.display, {
      showReferenceSphere: false,
      showEndpointPaths: false,
      showPaths: false,
      showSelected: false,
    });

    const model = createLineOscillator3D({
      geometryMode: "epicycle",
      pointCount: preset.pointCount,
      radius: preset.radius,
      epicycleShape: preset.epicycleShape,
      phase: { winding: preset.motionWinding },
      motionProfile: preset.motionProfile,
      visualization: {
        pointSize: preset.pointSize,
        showPaths: preset.display.showPaths,
        palette: "radius",
      },
    });
    assert.equal(model.paths.length, preset.pointCount);
    assert.deepEqual(model.epicycleShape, preset.epicycleShape);
    assert.equal(model.config.phase.winding, preset.motionWinding);
    assert.equal(model.config.radius, preset.radius);
    assert.equal(model.motionProfile, preset.motionProfile);
    assert.equal(model.config.visualization.pointSize, preset.pointSize);
    assert.equal(model.config.visualization.showPaths, false);

    const shifted = preset.epicycleShape.destinationPhaseDegrees !== 0;
    for (const path of model.paths) {
      assert.equal(
        [...path.start, ...path.end, ...path.direction].every(Number.isFinite),
        true,
        `${preset.id} paths must be finite`,
      );
      assert.ok(Math.abs(Math.hypot(...path.start) - preset.radius) < 1e-10);
      assert.ok(Math.abs(Math.hypot(...path.end) - preset.radius) < 1e-10);
      if (shifted) {
        assert.equal(path.role, "chord");
        assert.equal(path.degenerate, false);
        assert.ok(path.chordLength > 1e-8 && path.chordLength <= 2 * preset.radius + 1e-12);
      } else {
        assert.ok(Math.hypot(...path.start.map((value, axis) => value + path.end[axis])) < 1e-10);
      }
    }

    for (const time of [0, 0.37, Math.PI / 2, 2.4, 2 * Math.PI]) {
      const points = model.sample(time);
      assert.equal(points.length, preset.pointCount);
      for (const point of points) {
        assert.equal(point.position.every(Number.isFinite), true);
        assert.equal(Number.isFinite(point.signedRadius), true);
        assert.ok(point.radius <= preset.radius + 1e-12);
      }
    }
  }

  const [firstPreset] = TUSI3D_EPICYCLE_PRESETS;
  assert.throws(() => { firstPreset.pointCount = 3; }, TypeError);
  assert.throws(() => { firstPreset.epicycleShape.carrierTurns = 1; }, TypeError);
  assert.throws(() => { firstPreset.display.showPaths = true; }, TypeError);
});

test("Epicycle directions agree with an independent expanded frame formula", () => {
  for (const carrierTurns of [-100, -3, 0, 1, 100]) {
    for (const epicycleTurns of [-100, -2, 0, 2, 100]) {
      for (const angularRadiusDegrees of [0, 17.25, 35, 60, 89.9, 90]) {
        const shape = { carrierTurns, epicycleTurns, angularRadiusDegrees };
        const eta = angularRadiusDegrees * Math.PI / 180;
        for (const theta of [-0.37, 0, 0.13, 0.8, 1.9, TAU - 1e-7, TAU + 0.42]) {
          const carrier = carrierTurns * theta;
          const epicycle = epicycleTurns * theta;
          const expected = [
            Math.cos(eta) * Math.cos(carrier) - Math.sin(eta) * Math.sin(epicycle) * Math.sin(carrier),
            Math.cos(eta) * Math.sin(carrier) + Math.sin(eta) * Math.sin(epicycle) * Math.cos(carrier),
            Math.sin(eta) * Math.cos(epicycle),
          ];
          const actual = epicycleDiameterDirection(theta, shape);
          assert.ok(Math.hypot(...actual.map((value, axis) => value - expected[axis])) < 1e-12);
        }
      }
    }
  }
});

test("Epicycle curves preserve unit length and smooth position and tangent closure", () => {
  const shapes = [
    EPICYCLE_SHAPE_DEFAULTS,
    { carrierTurns: -100, epicycleTurns: 100, angularRadiusDegrees: 0 },
    { carrierTurns: 100, epicycleTurns: -100, angularRadiusDegrees: 35.25 },
    { carrierTurns: -100, epicycleTurns: -100, angularRadiusDegrees: 89.9 },
    { carrierTurns: 100, epicycleTurns: 100, angularRadiusDegrees: 90 },
    { carrierTurns: 0, epicycleTurns: 0, angularRadiusDegrees: 73.2 },
  ];
  for (const shape of shapes) {
    assert.deepEqual(epicycleDiameterDirection(0, shape), epicycleDiameterDirection(TAU, shape));
    const eta = shape.angularRadiusDegrees * Math.PI / 180;
    const expectedDerivative = [0,
      shape.carrierTurns * Math.cos(eta) + shape.epicycleTurns * Math.sin(eta), 0];
    const h = 1e-6;
    for (const seam of [0, TAU]) {
      const before = epicycleDiameterDirection(seam - h, shape);
      const after = epicycleDiameterDirection(seam + h, shape);
      const derivative = after.map((value, axis) => (value - before[axis]) / (2 * h));
      assert.ok(Math.hypot(...derivative.map((value, axis) => value - expectedDerivative[axis])) < 1e-5);
    }
    for (let index = 0; index < 1000; index += 1) {
      const theta = TAU * index / 1000;
      const direction = epicycleDiameterDirection(theta, shape);
      const repeated = epicycleDiameterDirection(theta + TAU, shape);
      assert.equal(direction.every(Number.isFinite), true);
      assert.ok(Math.abs(Math.hypot(...direction) - 1) < 1e-12);
      assert.ok(Math.hypot(...direction.map((value, axis) => value - repeated[axis])) < 1e-12);
    }
  }
});

test("Epicycle limits recover 2-D Tusi, a latitude, and a fixed local circle", () => {
  const planarShape = { carrierTurns: 1, epicycleTurns: -100, angularRadiusDegrees: 0 };
  for (let index = 0; index < 101; index += 1) {
    const theta = TAU * index / 101;
    assert.deepEqual(epicycleDiameterDirection(theta, planarShape), [Math.cos(theta), Math.sin(theta), 0]);
  }
  for (const motionProfile of LINE_MOTION_PROFILES) {
    const common = { pointCount: 41, radius: 2.5, angularSpeed: 1.3, phase: { winding: -3 } };
    const planar = createLineOscillator2D({
      ...common, motionProfile, center: [0.3, -0.5], sampling: "full-circle",
    });
    const epicycle = createLineOscillator3D({
      ...common, motionProfile, center: [0.3, -0.5, 0.7], geometryMode: "epicycle",
      epicycleShape: planarShape,
    });
    for (const time of [-1.2, 0, 0.3, 1.7]) {
      const expected = planar.sample(time);
      for (const point of epicycle.sample(time)) {
        assert.equal(point.position[2], 0.7);
        assert.deepEqual(point.position.slice(0, 2), expected[point.index].position);
        for (const key of ["phase", "motionPhase", "signedRadius", "radius"]) {
          assert.equal(point[key], expected[point.index][key]);
        }
      }
    }
  }
  const eta = 35 * Math.PI / 180;
  for (let index = 0; index < 101; index += 1) {
    const theta = TAU * index / 101;
    const latitude = epicycleDiameterDirection(theta, {
      carrierTurns: 3, epicycleTurns: 0, angularRadiusDegrees: 35,
    });
    assert.ok(Math.abs(latitude[2] - Math.sin(eta)) < 1e-12);
    assert.ok(Math.abs(Math.hypot(latitude[0], latitude[1]) - Math.cos(eta)) < 1e-12);
    const localCircle = epicycleDiameterDirection(theta, {
      carrierTurns: 0, epicycleTurns: 3, angularRadiusDegrees: 35,
    });
    assert.ok(Math.abs(localCircle[0] - Math.cos(eta)) < 1e-12);
    assert.ok(Math.abs(Math.hypot(localCircle[1], localCircle[2]) - Math.sin(eta)) < 1e-12);
  }
});

test("each Epicycle control changes generic geometry and real angular radius varies continuously", () => {
  const thetaValues = Array.from({ length: 97 }, (_, index) => TAU * index / 97);
  for (const shape of [
    { ...EPICYCLE_SHAPE_DEFAULTS, carrierTurns: 2 },
    { ...EPICYCLE_SHAPE_DEFAULTS, epicycleTurns: 3 },
    { ...EPICYCLE_SHAPE_DEFAULTS, angularRadiusDegrees: 55.25 },
  ]) {
    const largestChange = Math.max(...thetaValues.map((theta) => {
      const baseline = epicycleDiameterDirection(theta);
      return Math.hypot(...epicycleDiameterDirection(theta, shape).map((value, axis) => value - baseline[axis]));
    }));
    assert.ok(largestChange > 0.2);
  }
  for (const theta of thetaValues) {
    const at = epicycleDiameterDirection(theta, { angularRadiusDegrees: 37.25 });
    for (const angularRadiusDegrees of [37.25 - 1e-5, 37.25 + 1e-5]) {
      const near = epicycleDiameterDirection(theta, { angularRadiusDegrees });
      assert.ok(Math.hypot(...at.map((value, axis) => value - near[axis])) < 2e-7);
    }
  }
  const a = epicycleDiameterDirection(0);
  const b = epicycleDiameterDirection(Math.PI);
  const c = epicycleDiameterDirection(Math.PI / 2);
  const determinant = a[0] * (b[1] * c[2] - b[2] * c[1]) -
    a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  assert.ok(Math.abs(determinant) > 0.7);
});

test("both Epicycle motions preserve antipodal fixed diameters and radius bounds at N = 1000", () => {
  for (const motionProfile of LINE_MOTION_PROFILES) {
    for (const [pointCount, radius, winding, epicycleShape] of [
      [3, 0.1, -100, EPICYCLE_SHAPE_DEFAULTS],
      [200, 2.5, 100, EPICYCLE_SHAPE_DEFAULTS],
      [1000, 0.1, -100, { carrierTurns: -100, epicycleTurns: 100, angularRadiusDegrees: 0 }],
      [1000, 2.5, 100, { carrierTurns: 100, epicycleTurns: -100, angularRadiusDegrees: 90 }],
      [1000, 2.5, -100, { carrierTurns: -100, epicycleTurns: -99, angularRadiusDegrees: 37.25 }],
    ]) {
      const model = createLineOscillator3D({
        geometryMode: "epicycle", epicycleShape, motionProfile, pointCount,
        center: [0.3, -0.5, 0.7], radius, angularSpeed: 1.3, phase: { winding },
      });
      const fixedPaths = structuredClone(model.paths);
      assert.equal(model.paths.length, pointCount);
      for (const path of model.paths) {
        assert.equal(path.type, "diameter");
        assert.equal(path.role, "diameter");
        assert.equal(path.dimension, 3);
        assert.ok(Math.abs(Math.hypot(...path.direction) - 1) < 1e-12);
        for (let axis = 0; axis < 3; axis += 1) {
          assert.ok(Math.abs(path.start[axis] + path.end[axis] - 2 * model.config.center[axis]) < 1e-12);
          assert.ok(Math.abs(path.end[axis] - model.config.center[axis] - radius * path.direction[axis]) < 1e-12);
        }
      }
      const period = TAU / model.config.angularSpeed;
      for (const time of [-100, -Math.PI, 0, 0.4, 2.7, 100]) {
        const points = model.sample(time);
        const repeated = model.sample(time + period);
        assert.equal(points.length, pointCount);
        for (const point of points) {
          assert.equal(point.position.every(Number.isFinite), true);
          assert.ok(point.radius <= radius + 1e-12);
          const expectedRadius = radius * (motionProfile === "harmonic"
            ? Math.cos(point.motionPhase) : triangleWave(point.motionPhase));
          assert.equal(point.signedRadius, expectedRadius);
          const path = model.paths[point.index];
          const offset = point.position.map((value, axis) => value - model.config.center[axis]);
          assert.ok(Math.hypot(...offset) <= radius + 1e-12);
          assert.ok(Math.hypot(...offset.map((value, axis) => value - point.signedRadius * path.direction[axis])) < 1e-12);
          assert.ok(Math.hypot(...point.position.map((value, axis) => value - repeated[point.index].position[axis])) < 1e-12);
        }
      }
      const path = model.paths[Math.min(137, pointCount - 1)];
      const phase = model.config.phase.winding * path.parameter;
      for (const [motionPhase, endpoint] of [[0, path.end], [Math.PI, path.start]]) {
        const point = model.sample((phase + motionPhase) / model.config.angularSpeed)[path.index];
        assert.ok(Math.hypot(...point.position.map((value, axis) => value - endpoint[axis])) < 1e-12);
      }
      assert.deepEqual(model.paths, fixedPaths);
    }
  }
});

test("zero Epicycle destination phase preserves the antipodal model and its metadata exactly", () => {
  const shape = { carrierTurns: 3, epicycleTurns: -2, angularRadiusDegrees: 47.25 };
  const omitted = createLineOscillator3D({
    geometryMode: "epicycle", epicycleShape: shape, pointCount: 61,
    center: [0.3, -0.5, 0.7], radius: 2.1, phase: { winding: -7 },
  });
  const explicit = createLineOscillator3D({
    geometryMode: "epicycle",
    epicycleShape: { ...shape, destinationPhaseDegrees: 0 },
    pointCount: 61, center: [0.3, -0.5, 0.7], radius: 2.1,
    phase: { winding: -7 },
  });
  assert.deepEqual(omitted.paths, explicit.paths);
  for (const time of [-1.7, 0, 0.43, 2.8]) {
    assert.deepEqual(omitted.sample(time), explicit.sample(time));
  }
  for (const path of explicit.paths) {
    assert.equal(path.role, "diameter");
    assert.equal(path.type, "diameter");
    for (const field of [
      "originDirection", "destinationDirection", "midpoint", "centerOffset",
      "halfLength", "chordLength", "destinationPhaseRadians", "passesThroughCenter", "degenerate",
    ]) {
      assert.equal(Object.hasOwn(path, field), false);
    }
  }
  for (const point of explicit.sample(0.37)) {
    assert.equal(point.radius, Math.abs(point.signedRadius));
  }
  for (const theta of [-0.4, 0, 0.7, 3.1, TAU]) {
    assert.deepEqual(
      epicycleDiameterDirection(theta, { ...shape, destinationPhaseDegrees: 139.5 }),
      epicycleDiameterDirection(theta, shape),
    );
  }
});

test("Epicycle destination phase pairs independently computed sphere endpoints into fixed chords", () => {
  const center = [0.3, -0.5, 0.7];
  const radius = 2.1;
  const shape = {
    carrierTurns: 3,
    epicycleTurns: -2,
    angularRadiusDegrees: 47.25,
    destinationPhaseDegrees: 31.5,
  };
  const model = createLineOscillator3D({
    geometryMode: "epicycle", epicycleShape: shape, pointCount: 73, center, radius,
  });
  const eta = shape.angularRadiusDegrees * Math.PI / 180;
  const delta = shape.destinationPhaseDegrees * Math.PI / 180;
  const directionAt = (theta) => {
    const carrier = shape.carrierTurns * theta;
    const local = shape.epicycleTurns * theta;
    return [
      Math.cos(eta) * Math.cos(carrier) - Math.sin(eta) * Math.sin(local) * Math.sin(carrier),
      Math.cos(eta) * Math.sin(carrier) + Math.sin(eta) * Math.sin(local) * Math.cos(carrier),
      Math.sin(eta) * Math.cos(local),
    ];
  };
  let offCenterCount = 0;
  for (const path of model.paths) {
    const originDirection = directionAt(path.parameter);
    const destinationDirection = directionAt(path.parameter + delta);
    const expectedStart = center.map((coordinate, axis) =>
      coordinate - radius * originDirection[axis]);
    const expectedEnd = center.map((coordinate, axis) =>
      coordinate + radius * destinationDirection[axis]);
    assert.ok(Math.hypot(...path.start.map((value, axis) => value - expectedStart[axis])) < 1e-12);
    assert.ok(Math.hypot(...path.end.map((value, axis) => value - expectedEnd[axis])) < 1e-12);
    assert.equal(path.role, "chord");
    assert.equal(path.type, "diameter");
    assert.equal(path.destinationPhaseRadians, delta);
    assert.ok(Math.hypot(...path.originDirection.map(
      (value, axis) => value + originDirection[axis],
    )) < 1e-12);
    assert.ok(Math.hypot(...path.destinationDirection.map(
      (value, axis) => value - destinationDirection[axis],
    )) < 1e-12);
    assert.ok(Math.abs(Math.hypot(...path.start.map((value, axis) => value - center[axis])) - radius) < 1e-12);
    assert.ok(Math.abs(Math.hypot(...path.end.map((value, axis) => value - center[axis])) - radius) < 1e-12);
    assert.deepEqual(path.midpoint, path.start.map((value, axis) => (value + path.end[axis]) / 2));
    assert.deepEqual(path.centerOffset, path.midpoint.map((value, axis) => value - center[axis]));
    assert.ok(Math.abs(path.centerOffsetDistance - Math.hypot(...path.centerOffset)) < 1e-12);
    assert.ok(Math.abs(path.chordLength - 2 * path.halfLength) < 1e-12);
    assert.ok(Math.abs(Math.hypot(...path.direction) - 1) < 1e-12);
    assert.ok(Math.abs(path.centerOffset.reduce(
      (sum, value, axis) => sum + value * path.direction[axis], 0,
    )) < 1e-12);
    assert.equal(path.degenerate, false);
    if (!path.passesThroughCenter) offCenterCount += 1;
  }
  assert.equal(offCenterCount, model.paths.length);

  // Integer construction turns close both independently shifted endpoint
  // curves, even though the shift itself is a real angle.
  for (const theta of [-0.3, 0, 0.8, 2.4]) {
    for (const phaseOffset of [0, delta]) {
      const direction = epicycleDiameterDirection(theta + phaseOffset, shape);
      const repeated = epicycleDiameterDirection(theta + phaseOffset + TAU, shape);
      assert.ok(Math.hypot(...direction.map((value, axis) => value - repeated[axis])) < 1e-12);
    }
  }
});

test("shifted Epicycle chords remain fixed and inside the sphere at N = 1000 for both motions", () => {
  const center = [0.3, -0.5, 0.7];
  const radius = 2.5;
  const shape = {
    carrierTurns: 100,
    epicycleTurns: -99,
    angularRadiusDegrees: 73.25,
    destinationPhaseDegrees: -137.5,
  };
  for (const motionProfile of LINE_MOTION_PROFILES) {
    const model = createLineOscillator3D({
      geometryMode: "epicycle", epicycleShape: shape, motionProfile,
      pointCount: 1000, center, radius, angularSpeed: 1.3, phase: { winding: -100 },
    });
    const fixedPaths = structuredClone(model.paths);
    for (const path of model.paths) {
      assert.equal(path.role, "chord");
      assert.ok(Math.abs(Math.hypot(...path.start.map((value, axis) => value - center[axis])) - radius) < 1e-11);
      assert.ok(Math.abs(Math.hypot(...path.end.map((value, axis) => value - center[axis])) - radius) < 1e-11);
    }
    const period = TAU / model.config.angularSpeed;
    for (const time of [-100, -Math.PI, 0, 0.4, 2.7, 100]) {
      const points = model.sample(time);
      const repeated = model.sample(time + period);
      for (const point of points) {
        const path = model.paths[point.pathIndex];
        const unitDisplacement = motionProfile === "harmonic"
          ? Math.cos(point.motionPhase)
          : triangleWave(point.motionPhase);
        const expected = path.start.map((value, axis) =>
          ((1 - unitDisplacement) / 2) * value +
          ((1 + unitDisplacement) / 2) * path.end[axis]);
        assert.equal(point.position.every(Number.isFinite), true);
        assert.ok(Math.hypot(...point.position.map((value, axis) => value - expected[axis])) < 1e-12);
        assert.equal(point.signedRadius, radius * unitDisplacement);
        assert.ok(Math.abs(point.radius - Math.hypot(...point.position.map(
          (value, axis) => value - center[axis],
        ))) < 1e-12);
        assert.ok(point.radius <= radius + 1e-11);
        assert.ok(Math.hypot(...point.position.map(
          (value, axis) => value - repeated[point.index].position[axis],
        )) < 1e-11);
      }
    }
    const path = model.paths[137];
    const phase = model.config.phase.winding * path.parameter;
    for (const [motionPhase, endpoint] of [[0, path.end], [Math.PI, path.start]]) {
      const point = model.sample((phase + motionPhase) / model.config.angularSpeed)[path.index];
      assert.ok(Math.hypot(...point.position.map((value, axis) => value - endpoint[axis])) < 1e-11);
    }
    assert.deepEqual(model.paths, fixedPaths);
  }
});

test("a 180-degree destination phase safely represents a collapsed planar chord", () => {
  const radius = 1.7;
  const model = createLineOscillator3D({
    geometryMode: "epicycle", pointCount: 37, radius,
    epicycleShape: {
      carrierTurns: 1,
      epicycleTurns: 0,
      angularRadiusDegrees: 0,
      destinationPhaseDegrees: 180,
    },
  });
  for (const path of model.paths) {
    assert.equal(path.degenerate, true);
    assert.ok(path.halfLength < 1e-12);
    assert.equal(path.direction.every(Number.isFinite), true);
    assert.ok(Math.abs(Math.hypot(...path.direction) - 1) < 1e-12);
    assert.ok(Math.hypot(...path.start.map((value, axis) => value - path.end[axis])) < 1e-12);
  }
  for (const motionProfile of LINE_MOTION_PROFILES) {
    const profileModel = createLineOscillator3D({
      geometryMode: "epicycle", pointCount: 37, radius, motionProfile,
      epicycleShape: model.epicycleShape,
    });
    for (const time of [-2, 0, 0.7, 3]) {
      profileModel.sample(time).forEach((point, index) => {
        assert.ok(Math.hypot(...point.position.map(
          (value, axis) => value - profileModel.paths[index].start[axis],
        )) < 1e-12);
        assert.ok(Math.abs(point.radius - radius) < 1e-12);
      });
    }
  }
});

test("Epicycle geometry is independent of time, motion phase, other shapes and radius", () => {
  const options = {
    geometryMode: "epicycle",
    epicycleShape: {
      carrierTurns: 3,
      epicycleTurns: -2,
      angularRadiusDegrees: 73.25,
      destinationPhaseDegrees: 43.5,
    },
    pointCount: 29, center: [0.3, -0.5, 0.7], radius: 0.5, phase: { winding: 1 },
    animation: { time: 0.6 },
  };
  const base = createLineOscillator3D(options);
  const otherConstruction = createLineOscillator3D({
    ...options, seed: [1, 0, 0], orientationWindings: { x: -100, y: 100, z: -9 },
    orientationBends: { x: -3, y: 3, z: 1.1 },
    hoopShape: { diameterTurns: 100, hoopTurns: -100, tiltDegrees: 180 },
    lissajousShape: { horizontalCycles: 100, verticalCycles: 99, alignmentDegrees: 179.25 },
  });
  const otherPhase = createLineOscillator3D({ ...options, phase: { winding: 7 } });
  const otherTime = createLineOscillator3D({ ...options, animation: { time: 1.4 } });
  const otherRadius = createLineOscillator3D({ ...options, radius: 2.5 });
  assert.deepEqual(base.paths, otherConstruction.paths);
  assert.deepEqual(base.sample(), otherConstruction.sample());
  assert.deepEqual(base.paths, otherPhase.paths);
  assert.deepEqual(base.paths, otherTime.paths);
  assert.notDeepEqual(base.sample(), otherPhase.sample());
  assert.notDeepEqual(base.sample(), otherTime.sample());
  assert.deepEqual(base.sample(), base.sample(0.6));
  assert.equal(base.geometryMode, "epicycle");
  assert.deepEqual(base.epicycleShape, options.epicycleShape);
  for (const key of ["geometryMode", "hoopShape", "lissajousShape", "epicycleShape", "spectralShape", "harmonicShape", "motionProfile"]) {
    assert.equal(Object.hasOwn(base.config, key), false);
  }
  for (const value of [base, base.config, base.paths, base.paths[0], base.paths[0].direction,
    base.paths[0].start, base.paths[0].end, base.paths[0].originDirection,
    base.paths[0].destinationDirection, base.paths[0].midpoint, base.paths[0].centerOffset,
    base.epicycleShape]) {
    assert.equal(Object.isFrozen(value), true);
  }
  options.epicycleShape.angularRadiusDegrees = 10;
  assert.equal(base.epicycleShape.angularRadiusDegrees, 73.25);
  assert.equal(base.epicycleShape.destinationPhaseDegrees, 43.5);
  assert.throws(() => { base.epicycleShape.carrierTurns = 5; }, TypeError);
  assert.throws(() => { base.epicycleShape.angularRadiusDegrees = 5; }, TypeError);
  const smallPoints = base.sample(0.37);
  otherRadius.sample(0.37).forEach((point, index) => {
    assert.deepEqual(otherRadius.paths[index].direction, base.paths[index].direction);
    for (let axis = 0; axis < 3; axis += 1) {
      assert.ok(Math.abs(point.position[axis] - options.center[axis] -
        5 * (smallPoints[index].position[axis] - options.center[axis])) < 1e-12);
      assert.ok(Math.abs(otherRadius.paths[index].end[axis] - options.center[axis] -
        5 * (base.paths[index].end[axis] - options.center[axis])) < 1e-12);
    }
  });
  for (const motionProfile of LINE_MOTION_PROFILES) {
    const stationary = createLineOscillator3D({ ...options, motionProfile, angularSpeed: 0 });
    assert.deepEqual(stationary.sample(0), stationary.sample(20));
  }
});

test("Epicycle shapes reject unknown fields, coerced numbers and out-of-range values", () => {
  for (const epicycleShape of [null, [], "2", 2, false]) {
    assert.throws(() => createLineOscillator3D({ epicycleShape }), /epicycleShape must be an object/);
    assert.throws(() => epicycleDiameterDirection(0, epicycleShape), /epicycleShape must be an object/);
  }
  const badShapes = [{ turns: 1 }, { radius: 35 }, { carrierTurns: 1, extra: 0 }];
  for (const key of ["carrierTurns", "epicycleTurns"]) {
    for (const value of [null, false, "1", NaN, Infinity, -Infinity, -101, 101, 1.2]) {
      badShapes.push({ [key]: value });
    }
  }
  for (const angularRadiusDegrees of [null, false, "35", NaN, Infinity, -Infinity, -0.01, 90.01]) {
    badShapes.push({ angularRadiusDegrees });
  }
  for (const destinationPhaseDegrees of [
    null, false, "35", NaN, Infinity, -Infinity, -180.01, 180.01,
  ]) {
    badShapes.push({ destinationPhaseDegrees });
  }
  for (const epicycleShape of badShapes) {
    for (const geometryMode of ["simple", "advanced", "lissajous", "epicycle"]) {
      assert.throws(() => createLineOscillator3D({ geometryMode, epicycleShape }), /epicycleShape/);
    }
    assert.throws(() => epicycleDiameterDirection(0, epicycleShape), /epicycleShape/);
  }
  for (const parameter of [NaN, Infinity, -Infinity, "bad"]) {
    assert.throws(() => epicycleDiameterDirection(parameter), /parameter must be finite/);
  }
  for (const parameter of [-1e308, 1e308, "0.5", null]) {
    assert.equal(epicycleDiameterDirection(parameter).every(Number.isFinite), true);
  }
});

test("Tusi line profiles preserve the original cosine law and allow N = 1", () => {
  assert.deepEqual(LINE_MOTION_PROFILES, ["harmonic", "constant-speed"]);
  assert.equal(Object.isFrozen(LINE_MOTION_PROFILES), true);
  const model = createLineOscillator2D({
    pointCount: 1,
    center: [0.25, -0.5],
    radius: 2,
    angularSpeed: 1.4,
    phase: { winding: 7 },
  });
  assert.equal(model.motionProfile, "harmonic");
  assert.equal(model.config.sampling, "half-circle");
  assert.equal(model.paths.length, 1);
  assert.equal(model.paths[0].theta, 0);
  assert.deepEqual(model.paths[0].start, [-1.75, -0.5]);
  assert.deepEqual(model.paths[0].end, [2.25, -0.5]);
  for (const time of [0, 0.37, 2.1]) {
    const point = model.sample(time)[0];
    const expected = 2 * Math.cos(1.4 * time);
    assert.ok(Math.abs(point.signedRadius - expected) < 1e-12);
    assert.ok(Math.abs(point.position[0] - (0.25 + expected)) < 1e-12);
    assert.equal(point.position[1], -0.5);
    assert.equal(point.position.every(Number.isFinite), true);
  }
});

test("Tusi uses unique half-circle diameters at N = 2", () => {
  const model = createLineOscillator2D({ pointCount: 2, center: [0, 0], radius: 1 });
  assert.equal(model.config.sampling, "half-circle");
  assert.deepEqual(model.paths.map(({ theta }) => theta), [0, Math.PI / 2]);
  assert.deepEqual(model.paths[0].start, [-1, 0]);
  assert.deepEqual(model.paths[0].end, [1, 0]);
  assert.ok(Math.hypot(model.paths[1].start[0], model.paths[1].start[1] + 1) < 1e-12);
  assert.ok(Math.hypot(model.paths[1].end[0], model.paths[1].end[1] - 1) < 1e-12);
  const dot = model.paths[0].direction.reduce(
    (sum, coordinate, axis) => sum + coordinate * model.paths[1].direction[axis],
    0,
  );
  assert.ok(Math.abs(dot) < 1e-12);
});

test("Tusi triangular comparison has constant speed and instantaneous endpoint reversals", () => {
  for (const phase of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2, TAU]) {
    const expected = [1, 0, -1, 0, 1][
      [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2, TAU].indexOf(phase)
    ];
    assert.ok(Math.abs(triangleWave(phase) - expected) < 1e-12);
    assert.ok(Math.abs(triangleWave(phase + 4 * TAU) - expected) < 1e-12);
  }

  const radius = 3;
  const angularSpeed = 2;
  const model = createLineOscillator2D({
    motionProfile: "constant-speed",
    pointCount: 1,
    radius,
    angularSpeed,
  });
  const h = 1e-6;
  const displacement = (time) => model.sample(time)[0].signedRadius;
  const interiorTime = Math.PI / (2 * angularSpeed);
  const interiorVelocity = (
    displacement(interiorTime + h) - displacement(interiorTime - h)
  ) / (2 * h);
  const speed = (2 * radius * angularSpeed) / Math.PI;
  assert.ok(Math.abs(interiorVelocity + speed) < 1e-8);

  const leftVelocity = (displacement(0) - displacement(-h)) / h;
  const rightVelocity = (displacement(h) - displacement(0)) / h;
  assert.ok(Math.abs(leftVelocity - speed) < 1e-8);
  assert.ok(Math.abs(rightVelocity + speed) < 1e-8);
  assert.ok(Math.abs(displacement(0) - radius) < 1e-12);
  assert.ok(Math.abs(displacement(Math.PI / angularSpeed) + radius) < 1e-12);
});

test("Tusi harmonic law slows smoothly to zero at both line endpoints", () => {
  const radius = 3;
  const angularSpeed = 2;
  const model = createLineOscillator2D({
    motionProfile: "harmonic",
    pointCount: 1,
    radius,
    angularSpeed,
  });
  const displacement = (time) => model.sample(time)[0].signedRadius;
  for (const endpointTime of [0, Math.PI / angularSpeed]) {
    const h = 1e-6;
    const velocity = (
      displacement(endpointTime + h) - displacement(endpointTime - h)
    ) / (2 * h);
    assert.ok(Math.abs(velocity) < 1e-9);
  }
  assert.ok(Math.abs(displacement(0) - radius) < 1e-12);
  assert.ok(Math.abs(displacement(Math.PI / angularSpeed) + radius) < 1e-12);
});

test("Tusi amplitude shift is an additive signed displacement as in historical V1", () => {
  const radius = 4;
  const model = createLineOscillator2D({
    motionProfile: "harmonic",
    pointCount: 1,
    radius,
    amplitude: 0.5,
    amplitudeShift: 0.25,
  });
  assert.equal(model.amplitude, 0.5);
  assert.equal(model.amplitudeShift, 0.25);
  assert.ok(Math.abs(model.sample(0)[0].signedRadius - radius * 0.75) < 1e-12);
  assert.ok(Math.abs(model.sample(Math.PI)[0].signedRadius + radius * 0.25) < 1e-12);
  assert.throws(
    () => createLineOscillator2D({ amplitude: 1.01 }),
    /amplitude must be between 0 and 1/,
  );
  assert.throws(
    () => createLineOscillator2D({ amplitudeShift: -1.01 }),
    /amplitudeShift must be between -1 and 1/,
  );
  assert.doesNotThrow(() => createLineOscillator2D({
    amplitude: 0.75,
    amplitudeShift: -0.25,
  }));
  assert.throws(
    () => createLineOscillator2D({ amplitude: 0.8, amplitudeShift: -0.21 }),
    /amplitude \+ \|amplitudeShift\| must be less than or equal to 1/,
  );
});

test("Tusi signed velocity is sinusoidal and smooth through harmonic reversals", () => {
  const config = { radius: 3, angularSpeed: 2 };
  const period = TAU / config.angularSpeed;
  const peak = config.radius * config.angularSpeed;
  const samples = [0, period / 4, period / 2, 3 * period / 4, period];
  const expected = [0, -peak, 0, peak, 0];
  samples.forEach((time, index) => {
    const velocity = lineSignedVelocityAtTime("harmonic", config, time);
    assert.ok(Math.abs(velocity - expected[index]) < 1e-12);
    const reverseParameterization = lineSignedVelocityAtTime(
      "harmonic",
      { ...config, angularSpeed: -config.angularSpeed },
      time,
    );
    assert.ok(Math.abs(reverseParameterization - expected[index]) < 1e-12);
  });

  const reversal = period / 2;
  const h = 1e-5;
  const before = lineSignedVelocityAtTime("harmonic", config, reversal - h);
  const at = lineSignedVelocityAtTime("harmonic", config, reversal);
  const after = lineSignedVelocityAtTime("harmonic", config, reversal + h);
  const leftSlope = (at - before) / h;
  const rightSlope = (after - at) / h;
  const expectedSlope = config.radius * config.angularSpeed ** 2;
  assert.ok(Math.abs(leftSlope - expectedSlope) < 1e-3);
  assert.ok(Math.abs(rightSlope - expectedSlope) < 1e-3);
  assert.ok(Math.abs(leftSlope - rightSlope) < 1e-8);
});

test("Tusi constant-motion velocity changes sign only at its abrupt reversals", () => {
  const config = { radius: 3, angularSpeed: 2 };
  const period = TAU / config.angularSpeed;
  const magnitude = (2 * config.radius * config.angularSpeed) / Math.PI;
  assert.ok(Math.abs(
    lineSignedVelocityAtTime("constant-speed", config, period / 4) + magnitude,
  ) < 1e-12);
  assert.ok(Math.abs(
    lineSignedVelocityAtTime("constant-speed", config, 3 * period / 4) - magnitude,
  ) < 1e-12);
  assert.equal(lineSignedVelocityAtTime("constant-speed", config, 0), null);
  assert.equal(lineSignedVelocityAtTime("constant-speed", config, period / 2), null);
  assert.equal(lineSignedVelocityAtTime("constant-speed", config, period), null);
});

test("zero-amplitude line motion has defined zero velocity", () => {
  const config = { radius: 3, angularSpeed: 2 };
  for (const motionProfile of LINE_MOTION_PROFILES) {
    for (const time of [0, Math.PI / 4, Math.PI / 2, Math.PI]) {
      assert.equal(
        lineSignedVelocityAtTime(motionProfile, config, time, 0.37, 0),
        0,
      );
    }
  }
  assert.throws(
    () => lineSignedVelocityAtTime("harmonic", config, 0, 0, 1.01),
    /amplitude must be between 0 and 1/,
  );
});

test("Tusi constant-motion reversals shift with a selected point's nonzero phase", () => {
  const config = { radius: 3, angularSpeed: 2 };
  const phase = Math.PI / 2;
  const firstReversal = Math.PI / 4;
  const secondReversal = 3 * Math.PI / 4;
  const h = 1e-6;
  const speed = 2 * config.radius * config.angularSpeed / Math.PI;

  for (const reversal of [firstReversal, secondReversal]) {
    assert.equal(
      lineSignedVelocityAtTime("constant-speed", config, reversal, phase),
      null,
    );
    const before = lineSignedVelocityAtTime("constant-speed", config, reversal - h, phase);
    const after = lineSignedVelocityAtTime("constant-speed", config, reversal + h, phase);
    assert.ok(Math.abs(Math.abs(before) - speed) < 1e-12);
    assert.ok(Math.abs(Math.abs(after) - speed) < 1e-12);
    assert.equal(Math.sign(before), -Math.sign(after));
  }
  assert.notEqual(
    lineSignedVelocityAtTime("constant-speed", config, 0, phase),
    null,
  );
});

test("Not Tusi fixed-circle analogue defaults to an equal-radius split", () => {
  const model = createFixedCircleOscillator2D({
    pointCount: 1,
    radius: 2,
    angularSpeed: 0.5,
  });
  assert.equal(model.kind, "not-tusi-2d");
  assert.equal(model.motionProfile, "constant-angular");
  assert.equal(model.carrierRadius, 1);
  assert.equal(model.orbitRadius, 1);
  assert.equal(model.paths.length, 1);
  assert.deepEqual(model.paths[0].center, [1, 0]);
  assert.equal(model.paths[0].radius, 1);
  const expectedPositions = [[2, 0], [1, 1], [0, 0], [1, -1], [2, 0]];
  [0, Math.PI, 2 * Math.PI, 3 * Math.PI, 4 * Math.PI].forEach((time, index) => {
    const point = model.sample(time)[0];
    assert.ok(Math.hypot(
      point.position[0] - expectedPositions[index][0],
      point.position[1] - expectedPositions[index][1],
    ) < 1e-12);
    assert.ok(Math.abs(Math.hypot(
      point.position[0] - model.paths[0].center[0],
      point.position[1] - model.paths[0].center[1],
    ) - model.orbitRadius) < 1e-12);
  });
  assert.equal(Object.isFrozen(model.config), true);
  assert.equal(Object.isFrozen(model.paths), true);
});

test("Tusi motion helpers reject invalid profiles and counts", () => {
  assert.throws(
    () => createLineOscillator2D({ motionProfile: "ease" }),
    /motionProfile must be one of/,
  );
  assert.throws(
    () => createLineOscillator2D({ pointCount: 0 }),
    /pointCount must be a positive integer/,
  );
  assert.throws(() => triangleWave(Number.NaN), /phase must be finite/);
});

test("V3 inverse-distance weights short-circuit exact anchors", () => {
  const anchors = [[0.1, 0.2], [0.8, 0.2], [0.1, 0.9], [0.8, 0.9]];
  assert.deepEqual(inverseDistanceWeights([0.8, 0.2], anchors), [0, 1, 0, 0]);
  const weights = inverseDistanceWeights([0.5, 0.5], anchors);
  assert.ok(Math.abs(weights.reduce((sum, weight) => sum + weight, 0) - 1) < 1e-15);
  assert.equal(weights.every((weight) => Number.isFinite(weight) && weight >= 0), true);
});

test("V3 multi-anchor interpolation uses compatible core operations", () => {
  const configs = [0, 1, 2, -2].map((winding, index) =>
    createNotTusi2D({
      pointCount: 24,
      phase: { winding },
      orbitRatio: 0.3 + index * 0.1,
    }).config,
  );
  const weights = [0.1, 0.2, 0.3, 0.4];
  const parameterConfig = interpolateParameterSet(configs, weights);
  const pointModel = createWeightedPointModel(configs.map(createModel), weights);
  assert.equal(parameterConfig.pointCount, 24);
  assert.equal(pointModel.sample(0.6).length, 24);
  assert.equal(pointModel.sample(0.6).every((point) => point.position.every(Number.isFinite)), true);
});

test("V3 historical preset table exactly preserves the four selector anchors", () => {
  assert.deepEqual(V3_HISTORICAL_PRESETS, [
    { id: "P1", label: "Top left", position: [0.25, 0.25], pointCount: 120, shift: 20, colorCount: 6, smallRadius: 200, bigRadius: 100 },
    { id: "P2", label: "Top right", position: [0.75, 0.25], pointCount: 120, shift: -5, colorCount: 1, smallRadius: 20, bigRadius: 200 },
    { id: "P3", label: "Bottom right", position: [0.75, 0.75], pointCount: 120, shift: 169, colorCount: 5, smallRadius: 200, bigRadius: 100 },
    { id: "P4", label: "Bottom left", position: [0.25, 0.75], pointCount: 120, shift: 179, colorCount: 2, smallRadius: 200, bigRadius: 100 },
  ]);
  assert.equal(Object.isFrozen(V3_HISTORICAL_PRESETS), true);
  assert.equal(Object.isFrozen(V3_HISTORICAL_PRESETS[0]), true);
  assert.equal(Object.isFrozen(V3_HISTORICAL_PRESETS[0].position), true);
  assert.equal(Object.isFrozen(V3_LEGACY_COLORS), true);
  assert.equal(V3_LEGACY_COLORS.length, 20);
});

test("Parameter Sets exposes a separate valid four-anchor Tusi family", () => {
  assert.deepEqual(TUSI_PARAMETER_PRESETS, [
    { id: "P1", label: "Top left match", position: [0.25, 0.25], pointCount: 120, winding: -31, radius: 241, amplitude: 0.97, amplitudeShift: -0.01, colorCount: 4 },
    { id: "P2", label: "Top right match", position: [0.75, 0.25], pointCount: 120, winding: 6, radius: 220, amplitude: 0.09, amplitudeShift: 0.91, colorCount: 1 },
    { id: "P3", label: "Bottom right match", position: [0.75, 0.75], pointCount: 120, winding: -48, radius: 300, amplitude: 0.33, amplitudeShift: 0.67, colorCount: 5 },
    { id: "P4", label: "Bottom left match", position: [0.25, 0.75], pointCount: 120, winding: -58, radius: 300, amplitude: 0.33, amplitudeShift: 0.67, colorCount: 2 },
  ]);
  assert.equal(Object.isFrozen(TUSI_PARAMETER_PRESETS), true);
  for (const [index, preset] of TUSI_PARAMETER_PRESETS.entries()) {
    const source = V3_HISTORICAL_PRESETS[index];
    assert.ok(preset.amplitude + Math.abs(preset.amplitudeShift) <= 1);
    assert.equal(preset.pointCount, source.pointCount);
    if (index === 0) {
      assert.deepEqual(
        { winding: preset.winding, radius: preset.radius, amplitude: preset.amplitude, amplitudeShift: preset.amplitudeShift, colorCount: preset.colorCount },
        { winding: -31, radius: 241, amplitude: 0.97, amplitudeShift: -0.01, colorCount: 4 },
      );
    } else {
      assert.equal(preset.colorCount, source.colorCount);
      assert.equal(preset.radius, source.bigRadius + source.smallRadius);
      assert.equal(preset.winding, [null, 6, -48, -58][index]);
      assert.ok(Math.abs(preset.radius * preset.amplitude -
        Math.min(source.bigRadius, source.smallRadius)) <= 2);
      assert.ok(Math.abs(preset.radius * preset.amplitudeShift -
        Math.max(source.bigRadius, source.smallRadius)) <= 2);
    }
    const model = createTusiParameterModel(preset);
    assert.equal(model.geometry, "tusi");
    assert.equal(model.config.sampling, "full-circle");
    assert.equal(model.config.pointCount, 120);
    assert.equal(model.config.phase.winding, preset.winding);
    for (const time of [0, 0.7, 2.4]) {
      assert.equal(model.sample(time).every((point) => point.radius <= preset.radius + 1e-10), true);
    }
  }
});

test("Tusi Parameter Sets supports safe parameter and indexed-point interpolation", () => {
  const center = interpolateTusiParameterSet(TUSI_PARAMETER_PRESETS, [1, 1, 1, 1]);
  assert.deepEqual(center, {
    pointCount: 120,
    winding: -33,
    radius: 265.25,
    amplitude: 0.43,
    amplitudeShift: 0.56,
    colorCount: 3,
  });
  assert.ok(center.amplitude + Math.abs(center.amplitudeShift) <= 1);
  const parameterModel = createTusiParameterModel(center);
  const pointModel = createTusiParameterPointInterpolationModel(
    TUSI_PARAMETER_PRESETS,
    [0.25, 0.25, 0.25, 0.25],
  );
  assert.equal(parameterModel.sample(0.8).length, 120);
  assert.equal(pointModel.sample(0.8).length, 120);
  assert.equal(pointModel.sample(0.8).every((point) => point.position.every(Number.isFinite)), true);

  const endpoint = createTusiParameterPointInterpolationModel(
    TUSI_PARAMETER_PRESETS,
    [1, 0, 0, 0],
  ).sample(0.63);
  const expected = createTusiParameterModel(TUSI_PARAMETER_PRESETS[0]).sample(0.63);
  endpoint.forEach((point, index) => {
    assert.ok(Math.hypot(
      point.position[0] - expected[index].position[0],
      point.position[1] - expected[index].position[1],
    ) < 1e-12);
  });
  assert.throws(
    () => createTusiParameterPointInterpolationModel([
      TUSI_PARAMETER_PRESETS[0],
      { ...TUSI_PARAMETER_PRESETS[1], pointCount: 23 },
    ], [0.5, 0.5]),
    /requires equal point counts/,
  );
  assert.throws(
    () => createTusiParameterModel({
      ...TUSI_PARAMETER_PRESETS[0],
      amplitude: 0.8,
      amplitudeShift: 0.3,
    }),
    /must satisfy amplitude/,
  );
});

test("V3 canonical adapter exactly reproduces the historical circle equation", () => {
  for (const preset of V3_HISTORICAL_PRESETS) {
    const config = v3PresetToConfig(preset);
    assert.equal(config.radius, preset.bigRadius + preset.smallRadius);
    assert.equal(config.orbitRatio, preset.smallRadius / config.radius);
    assert.equal(config.phase.winding, -preset.shift);
    assert.equal(config.pointCount, 120);
    const model = createV3CircleModel(preset);
    for (const time of [0, 0.37, 1.9]) {
      const points = model.sample(time);
      for (const index of [0, 1, 37, 119]) {
        const theta = (TAU * index) / preset.pointCount;
        const localPhase = time + preset.shift * theta;
        const expected = [
          preset.bigRadius * Math.cos(theta) + preset.smallRadius * Math.cos(localPhase),
          preset.bigRadius * Math.sin(theta) + preset.smallRadius * Math.sin(localPhase),
        ];
        assert.ok(Math.hypot(
          points[index].position[0] - expected[0],
          points[index].position[1] - expected[1],
        ) < 1e-12);
      }
    }
  }
});

test("V3 semantic parameter interpolation matches historical rounding", () => {
  const center = interpolateV3PresetSet(V3_HISTORICAL_PRESETS, [1, 1, 1, 1]);
  assert.deepEqual(center, {
    pointCount: 120,
    shift: 91,
    colorCount: 4,
    smallRadius: 155,
    bigRadius: 125,
  });
  const midpoint = interpolateV3PresetSet(
    V3_HISTORICAL_PRESETS.slice(0, 2),
    [0.5, 0.5],
  );
  assert.deepEqual(midpoint, {
    pointCount: 120,
    shift: 8,
    colorCount: 4,
    smallRadius: 110,
    bigRadius: 150,
  });
  const config = v3PresetToConfig(midpoint);
  assert.equal(config.radius, 260);
  assert.equal(config.orbitRatio, 110 / 260);
});

test("V3 repeated colors and point interpolation preserve indexed correspondence", () => {
  const [p1, p2, p3, p4] = V3_HISTORICAL_PRESETS;
  assert.equal(v3ColorForIndex(p1, 0), "rgba(255,0,0,0.5)");
  assert.equal(v3ColorForIndex(p1, 1), "rgba(0,255,0,0.5)");
  assert.equal(v3ColorForIndex(p1, 6), "rgba(255,0,0,0.5)");
  assert.equal(v3ColorForIndex(p2, 77), "rgba(255,0,0,0.5)");

  const time = 0.63;
  const endpoint = createV3PointInterpolationModel(
    V3_HISTORICAL_PRESETS,
    [1, 0, 0, 0],
  ).sample(time);
  const expectedEndpoint = createV3CircleModel(p1).sample(time);
  endpoint.forEach((point, index) => {
    assert.ok(Math.hypot(
      point.position[0] - expectedEndpoint[index].position[0],
      point.position[1] - expectedEndpoint[index].position[1],
    ) < 1e-12);
    assert.deepEqual(point.rgba, expectedEndpoint[index].rgba);
  });

  const weights = [0.25, 0.25, 0.25, 0.25];
  const center = createV3PointInterpolationModel(V3_HISTORICAL_PRESETS, weights).sample(time);
  const samples = [p1, p2, p3, p4].map((preset) =>
    createV3CircleModel(preset).sample(time));
  for (const index of [0, 1, 43, 119]) {
    const expectedPosition = [0, 1].map((axis) =>
      samples.reduce((sum, points) => sum + 0.25 * points[index].position[axis], 0));
    assert.ok(Math.hypot(
      center[index].position[0] - expectedPosition[0],
      center[index].position[1] - expectedPosition[1],
    ) < 1e-12);
  }
  assert.deepEqual(center[1].rgba, [63.75, 191.25, 0, 0.5]);
  assert.equal(center[1].color, "rgba(63.75,191.25,0,0.5)");
});

test("V3 point interpolation rejects incompatible samples without padding", () => {
  const unequalCount = {
    ...V3_HISTORICAL_PRESETS[1],
    pointCount: 119,
  };
  assert.throws(
    () => createV3PointInterpolationModel(
      [V3_HISTORICAL_PRESETS[0], unequalCount],
      [0.5, 0.5],
    ),
    /requires equal point counts/,
  );
  const unequalSampling = {
    ...V3_HISTORICAL_PRESETS[1],
    sampling: "half-circle",
  };
  assert.throws(
    () => createV3PointInterpolationModel(
      [V3_HISTORICAL_PRESETS[0], unequalSampling],
      [0.5, 0.5],
    ),
    /requires the same sampling order/,
  );
});

test("V4 historical preset list preserves and safely migrates all supplied entries", () => {
  assert.equal(V4_HISTORICAL_PRESETS.length, 5);
  assert.deepEqual(
    V4_HISTORICAL_PRESETS.map((preset) => preset.id),
    ["P01", "P02", "P03", "P04", "P05"],
  );
  assert.deepEqual(
    V4_HISTORICAL_PRESETS.map((preset) => preset.label),
    ["Crossed loops", "Coiled braid", "Red rosette", "Interlaced ribbons", "Twin rings"],
  );
  assert.equal(Object.isFrozen(V4_HISTORICAL_PRESETS), true);
  assert.deepEqual(V4_PRESET_CAMERA_VIEWS, {
    P01: { direction: [0, 0, 1], up: [0, 1, 0], distance: 5, fov: 75 },
    P02: { direction: [0, 0, 1], up: [0, 1, 0], distance: 5, fov: 75 },
    P03: { direction: [0, 0, 1], up: [0, 1, 0], distance: 5, fov: 75 },
    P04: { direction: [0, 0, 1], up: [0, 1, 0], distance: 5, fov: 75 },
    P05: { direction: [0, 0, 1], up: [0, 1, 0], distance: 5, fov: 75 },
  });
  assert.equal(Object.isFrozen(V4_PRESET_CAMERA_VIEWS.P01.direction), true);
  assert.deepEqual(V4_PRESET_DISPLAY_DEFAULTS, {
    P03: { showPaths: false },
  });
  assert.equal(Object.isFrozen(V4_PRESET_DISPLAY_DEFAULTS.P03), true);
  assert.equal(V4_DEFAULT_PRESET_ID, "P03");
  assert.deepEqual(
    V4_HISTORICAL_PRESETS.map((preset) => [
      preset.bigRadius, preset.smallRadius, preset.nbrBalls, preset.rotationSpeed,
      preset.rx, preset.ry, preset.rz,
      preset.phaseXYZ, preset.phaseX, preset.phaseY, preset.phaseZ,
      preset.nbrColors,
    ]),
    [
      [2, 1, 120, 0.9, true, false, false, -26, -36, -34, 25, 2],
      [2, 1, 120, 2.9, false, true, false, -26, -97, 26, 87, 2],
      [2, 1, 120, 1.3, false, true, false, -26, -97, 26, -99, 1],
      [1.8, 0.8, 200, 0.5, true, false, false, 100, -100, 100, -2, 2],
      [1.2, 1.5, 160, 0.3, true, true, true, 100, -20, -100, -100, 2],
    ],
  );

  const configs = V4_HISTORICAL_PRESETS.map((preset) => v4PresetToConfig(preset));
  assert.deepEqual(configs.map((config) => config.phase), [
    { x: -58, y: -60, z: 1 },
    { x: 3, y: 0, z: 59 },
    { x: 3, y: 0, z: 5 },
    { x: 0, y: 0, z: -98 },
    { x: -80, y: 0, z: 0 },
  ]);
  configs.forEach((config, index) => {
    const source = V4_HISTORICAL_PRESETS[index];
    assert.ok(config.pointCount >= 3 && config.pointCount <= 200);
    for (const axis of ["x", "y", "z"]) {
      assert.ok(Number.isInteger(config.phase[axis]));
      assert.ok(config.phase[axis] >= -100 && config.phase[axis] <= 100);
      const sourceAxis = source[`phase${axis.toUpperCase()}`];
      const remainder = ((config.phase[axis] + source.phaseXYZ + sourceAxis) % config.pointCount + config.pointCount) % config.pointCount;
      assert.equal(remainder, 0);
    }
    const model = createV4CarrierRingModel(config);
    assert.equal(model.sample(0.75).every((point) => point.position.every(Number.isFinite)), true);
  });
  const coloredModel = createV4CarrierRingModel(configs[0]);
  assert.equal(coloredModel.sample(0)[0].color, "rgb(255,0,0)");
  assert.equal(coloredModel.sample(0)[1].color, "rgb(0,255,0)");
});

test("the shared 3-D color cycle preserves the historical palette and indexed repetition", () => {
  assert.equal(Object.isFrozen(V4_LEGACY_COLORS), true);
  assert.equal(V4_LEGACY_COLORS.length, 20);
  assert.equal(new Set(V4_LEGACY_COLORS).size, 20);
  assert.deepEqual(V4_LEGACY_COLORS.slice(0, 6), [
    "rgb(255,0,0)", "rgb(0,255,0)", "rgb(0,0,255)",
    "rgb(255,255,0)", "rgb(255,0,255)", "rgb(0,255,255)",
  ]);
  for (const preset of V4_HISTORICAL_PRESETS) {
    assert.deepEqual(preset.colors, V4_LEGACY_COLORS);
  }
  for (const colorGroups of [1, 2, 3, 20]) {
    const model = createV4CarrierRingModel({
      pointCount: 43,
      colorGroups,
      colors: V4_LEGACY_COLORS,
    });
    for (const time of [0, 0.7, Math.PI]) {
      for (const point of model.sample(time)) {
        assert.equal(point.color, V4_LEGACY_COLORS[point.index % colorGroups]);
      }
    }
  }
});

test("V4 carrier-ring model is finite, immutable, and keeps the local radius", () => {
  const model = createV4CarrierRingModel({
    center: [0.2, -0.3, 0.4],
    pointCount: 37,
    carrierRadius: 1.4,
    localRadius: 0.55,
    angularSpeed: 0.7,
    phase: { x: -1, y: 2, z: 0 },
    animateAxes: { x: true, y: false, z: true },
    colorGroups: 7,
  });
  assert.equal(Object.isFrozen(model.config), true);
  assert.equal(Object.isFrozen(model.paths), true);
  assert.equal(model.config.visualization.pointSize, 10);
  assert.deepEqual(model.config.phase, { x: -1, y: 2, z: 0 });
  assert.equal(model.paths[0].type, "circle");
  assert.equal(model.paths.slice(1).every((path) =>
    path.type === "curve" && path.closed && path.points.length === 128), true);
  const time = 1.3;
  const points = model.sample(time);
  assert.equal(points.length, 37);
  points.forEach((point, index) => {
    const theta = (TAU * index) / 37;
    const carrierCenter = [
      0.2 + 1.4 * Math.cos(theta),
      -0.3 + 1.4 * Math.sin(theta),
      0.4,
    ];
    const localDistance = Math.hypot(
      ...point.position.map((coordinate, axis) => coordinate - carrierCenter[axis]),
    );
    assert.ok(Math.abs(localDistance - 0.55) < 1e-12);
    assert.equal(point.position.every(Number.isFinite), true);
    assert.ok(Math.abs(point.motionPhase - 0.7 * time) < 1e-12);
  });
});

test("V4 uses integer axis windings and circular single-axis trajectories", () => {
  assert.throws(
    () => createV4CarrierRingModel({ phase: { x: 0.5, y: 0, z: 0 } }),
    /phase\.x must be an integer/,
  );
  const model = createV4CarrierRingModel({
    pointCount: 9,
    localRadius: 0.6,
    phase: { x: -2, y: 1, z: 3 },
    animateAxes: { x: true, y: false, z: false },
  });
  const path = model.paths[1];
  assert.equal(path.type, "curve");
  assert.equal(path.closed, true);
  path.points.forEach((point) => {
    assert.ok(Math.abs(Math.hypot(...point.map((value, axis) =>
      value - path.center[axis])) - 0.6) < 1e-12);
    assert.ok(Math.abs((point[0] - path.center[0]) - 0.6 * model.config.seed[0]) < 1e-12);
  });
  assert.equal(createV4CarrierRingModel({ pointCount: 1 }).sample(2).flatMap((point) => point.position).every(Number.isFinite), true);
});

test("V4 hemisphere seed changes direction without changing carrier or local radii", () => {
  const common = {
    pointCount: 12,
    carrierRadius: 1.7,
    localRadius: 0.45,
    phase: { x: 1, y: 2, z: -1 },
  };
  const a = createV4CarrierRingModel({ ...common, seed: [0, 0, 1] });
  const b = createV4CarrierRingModel({ ...common, seed: [1, 0, 0] });
  assert.equal(a.config.carrierRadius, b.config.carrierRadius);
  assert.equal(a.config.localRadius, b.config.localRadius);
  assert.deepEqual(a.paths[0], b.paths[0]);
  for (const model of [a, b]) {
    model.sample(0.7).forEach((point, index) => {
      const theta = (TAU * index) / common.pointCount;
      const carrierCenter = [
        common.carrierRadius * Math.cos(theta),
        common.carrierRadius * Math.sin(theta),
        0,
      ];
      assert.ok(Math.abs(Math.hypot(...point.position.map((value, axis) =>
        value - carrierCenter[axis])) - common.localRadius) < 1e-12);
    });
  }
});

test("V4 remains finite at N = 200 and bounds its motion-path guides", () => {
  const model = createV4CarrierRingModel({
    pointCount: 200,
    phase: { x: -100, y: 100, z: 0 },
  });
  const points = model.sample(1.25);
  assert.equal(points.length, 200);
  assert.equal(points.every((point) => point.position.every(Number.isFinite)), true);
  assert.equal(model.paths.length, 97);
  const pathIndices = model.paths.slice(1).map((path) => path.index);
  assert.equal(new Set(pathIndices).size, 96);
  assert.ok(Math.max(...pathIndices.slice(1).map((value, index) =>
    value - pathIndices[index])) <= 3);
});
