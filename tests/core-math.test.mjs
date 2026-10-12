import test from "node:test";
import assert from "node:assert/strict";

import {
  TAU,
  createNotTusi2D,
  createNotTusi3D,
  createTusi2D,
  createTusi3D,
  createEulerDiameterTusi3D,
} from "../src/core/index.js";

const EPSILON = 1e-12;

function near(actual, expected, epsilon = EPSILON) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`,
  );
}

function nearVector(actual, expected, epsilon = EPSILON) {
  assert.equal(actual.length, expected.length);
  for (let axis = 0; axis < actual.length; axis += 1) {
    near(actual[axis], expected[axis], epsilon);
  }
}

function subtract(a, b) {
  return a.map((value, axis) => value - b[axis]);
}

function dot(a, b) {
  return a.reduce((sum, value, axis) => sum + value * b[axis], 0);
}

function cross2(a, b) {
  return a[0] * b[1] - a[1] * b[0];
}

function cross3(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function norm(vector) {
  return Math.hypot(...vector);
}

function rotateX3([x, y, z], angle) {
  return [
    x,
    Math.cos(angle) * y - Math.sin(angle) * z,
    Math.sin(angle) * y + Math.cos(angle) * z,
  ];
}

function rotateY3([x, y, z], angle) {
  return [
    Math.cos(angle) * x + Math.sin(angle) * z,
    y,
    -Math.sin(angle) * x + Math.cos(angle) * z,
  ];
}

function rotateZ3([x, y, z], angle) {
  return [
    Math.cos(angle) * x - Math.sin(angle) * y,
    Math.sin(angle) * x + Math.cos(angle) * y,
    z,
  ];
}

function expectedEulerDirection(seed, windings, parameter) {
  return rotateZ3(
    rotateY3(
      rotateX3(seed, windings.x * parameter),
      windings.y * parameter,
    ),
    windings.z * parameter,
  );
}

test("2-D full and half-circle sampling use i/N and exclude duplicate endpoints", () => {
  const full = createTusi2D({ pointCount: 8, sampling: "full-circle" });
  const half = createTusi2D({ pointCount: 8, sampling: "half-circle" });
  for (let index = 0; index < 8; index += 1) {
    near(full.paths[index].theta, (TAU * index) / 8);
    near(half.paths[index].theta, (Math.PI * index) / 8);
  }
  assert.ok(full.paths.at(-1).theta < TAU);
  assert.ok(half.paths.at(-1).theta < Math.PI);
});

test("all 2-D Tusi points remain collinear with their fixed diameters", () => {
  const model = createTusi2D({
    center: [2, -3],
    radius: 4,
    pointCount: 31,
    phase: { winding: 2.75 },
  });
  assert.equal(Object.isFrozen(model.config), true);
  assert.equal(Object.isFrozen(model.paths), true);
  assert.equal(Object.isFrozen(model.paths[0]), true);

  for (const time of [-2.1, 0, 0.37, 4.2]) {
    for (const point of model.sample(time)) {
      const path = model.paths[point.pathIndex];
      const relative = subtract(point.position, model.config.center);
      near(cross2(relative, path.direction), 0);
      near(point.radius, Math.abs(point.signedRadius));
      assert.ok(point.radius <= model.config.radius + EPSILON);
    }
  }
});

test("Tusi w = 0 breathes and w = 1 lies on a revolving R/2 circle", () => {
  const radius = 3;
  const time = 0.73;
  const synchronous = createTusi2D({
    radius,
    pointCount: 40,
    phase: { winding: 0 },
  });
  const expectedRadius = Math.abs(radius * Math.cos(time));
  for (const point of synchronous.sample(time)) near(point.radius, expectedRadius);

  const rolling = createTusi2D({
    radius,
    pointCount: 40,
    phase: { winding: 1 },
  });
  const circleCenter = [
    (radius / 2) * Math.cos(time),
    (radius / 2) * Math.sin(time),
  ];
  for (const point of rolling.sample(time)) {
    near(norm(subtract(point.position, circleCenter)), radius / 2);
  }
});

test("Tusi winding aliases are exact for finite full-circle sampling", () => {
  const settings = { pointCount: 5, sampling: "full-circle" };
  const w1 = createTusi2D({ ...settings, phase: { winding: 1 } });
  const w6 = createTusi2D({ ...settings, phase: { winding: 6 } });
  const wMinus1 = createTusi2D({ ...settings, phase: { winding: -1 } });
  const w4 = createTusi2D({ ...settings, phase: { winding: 4 } });
  for (const time of [0, 0.2, 1.7]) {
    const p1 = w1.sample(time);
    const p6 = w6.sample(time);
    const pm1 = wMinus1.sample(time);
    const p4 = w4.sample(time);
    for (let index = 0; index < settings.pointCount; index += 1) {
      nearVector(p1[index].position, p6[index].position);
      nearVector(pm1[index].position, p4[index].position);
    }
  }
});

test("2-D Tusi points cross the common centre twice per cycle", () => {
  const model = createTusi2D({
    center: [1, 2],
    radius: 3,
    phase: { winding: 0 },
  });
  for (const time of [Math.PI / 2, (3 * Math.PI) / 2]) {
    for (const point of model.sample(time)) {
      nearVector(point.position, model.config.center);
    }
  }
});

test("2-D Not-Tusi points stay on their fixed circles below 1e-12 residual", () => {
  const model = createNotTusi2D({
    center: [-2, 1],
    radius: 5,
    orbitRatio: 0.37,
    pointCount: 43,
    phase: { winding: 2.25 },
  });
  let maximumResidual = 0;
  for (const time of [-1.3, 0, 0.83, 7.2]) {
    for (const point of model.sample(time)) {
      const path = model.paths[point.pathIndex];
      maximumResidual = Math.max(
        maximumResidual,
        Math.abs(norm(subtract(point.position, path.center)) - path.radius),
      );
      const expectedSquaredRadius =
        (model.config.radius - path.radius) ** 2 +
        path.radius ** 2 +
        2 *
          (model.config.radius - path.radius) *
          path.radius *
          Math.cos(point.motionPhase - path.theta);
      near(point.radius ** 2, expectedSquaredRadius, 5e-12);
    }
  }
  assert.ok(maximumResidual < 1e-12, `maximum residual ${maximumResidual}`);
});

test("equal-radius 2-D Not-Tusi circles pass through the global centre once per cycle", () => {
  const model = createNotTusi2D({
    center: [4, -1],
    radius: 2,
    pointCount: 17,
    angularSpeed: 1.7,
    phase: { winding: 2 },
    orbitRatio: 0.5,
  });
  for (const path of model.paths) {
    const phase = model.config.phase.winding * path.theta;
    const crossingTime = (phase + path.theta + Math.PI) / model.config.angularSpeed;
    const point = model.sample(crossingTime)[path.index];
    nearVector(point.position, model.config.center, 2e-12);
  }
});

test("Not-Tusi w = 0 translates a ring and w = 1 degenerates to a sweeping line", () => {
  const radius = 4;
  const time = 1.13;
  const translating = createNotTusi2D({
    radius,
    pointCount: 48,
    phase: { winding: 0 },
  });
  const translatingCenter = [
    (radius / 2) * Math.cos(time),
    (radius / 2) * Math.sin(time),
  ];
  for (const point of translating.sample(time)) {
    near(norm(subtract(point.position, translatingCenter)), radius / 2);
  }

  const blade = createNotTusi2D({
    radius,
    pointCount: 48,
    phase: { winding: 1 },
  });
  const bladeDirection = [Math.cos(time / 2), Math.sin(time / 2)];
  for (const point of blade.sample(time)) {
    near(cross2(point.position, bladeDirection), 0);
  }
});

test("split-radius w = 1 Not-Tusi figure has the predicted ellipse axes", () => {
  const radius = 6;
  const orbitRatio = 0.25;
  const r1 = radius * (1 - orbitRatio);
  const r2 = radius * orbitRatio;
  const minor = Math.abs(r1 - r2);
  const time = 0.91;
  const model = createNotTusi2D({
    radius,
    orbitRatio,
    pointCount: 120,
    phase: { winding: 1 },
  });
  const majorAxis = [Math.cos(time / 2), Math.sin(time / 2)];
  const minorAxis = [-majorAxis[1], majorAxis[0]];
  let maxMajor = 0;
  let maxMinor = 0;
  for (const point of model.sample(time)) {
    const x = dot(point.position, majorAxis);
    const y = dot(point.position, minorAxis);
    near((x / radius) ** 2 + (y / minor) ** 2, 1, 2e-12);
    maxMajor = Math.max(maxMajor, Math.abs(x));
    maxMinor = Math.max(maxMinor, Math.abs(y));
  }
  near(maxMajor, radius, 0.01);
  near(maxMinor, minor, 0.01);
});

test("Not-Tusi orbit split supports its two documented degenerate endpoints", () => {
  const fixed = createNotTusi2D({
    orbitRatio: 0,
    phase: { winding: 3 },
  });
  assert.ok(fixed.paths.every((path) => path.radius === 0));
  for (const point of fixed.sample(4.7)) {
    nearVector(point.position, fixed.paths[point.pathIndex].center);
  }

  const concentric = createNotTusi2D({
    orbitRatio: 1,
    phase: { winding: 0 },
  });
  assert.ok(
    concentric.paths.every((path) =>
      path.center.every((coordinate) => Math.abs(coordinate) <= EPSILON)
    ),
  );
  const points = concentric.sample(0.37);
  for (const point of points.slice(1)) nearVector(point.position, points[0].position);
});

test("alternating circulation changes timing direction without changing circle geometry", () => {
  const forward = createNotTusi2D({
    pointCount: 10,
    orbitRatio: 0.25,
    phase: { winding: 2 },
    circulation: "forward",
  });
  const alternating = createNotTusi2D({
    pointCount: 10,
    orbitRatio: 0.25,
    phase: { winding: 2 },
    circulation: "alternating",
  });
  const stripCirculation = (path) => {
    const { circulation, ...geometry } = path;
    return geometry;
  };
  assert.deepEqual(
    forward.paths.map(stripCirculation),
    alternating.paths.map(stripCirculation),
  );
  assert.deepEqual(
    alternating.sample(0).map((point) => point.circulation),
    [1, -1, 1, -1, 1, -1, 1, -1, 1, -1],
  );
});

test("every model exposes normalized motionPhase and separate path traversal", () => {
  const time = 0.83;
  const models = [
    createTusi2D({ angularSpeed: 1.7, phase: { winding: 2 } }),
    createNotTusi2D({
      angularSpeed: 1.7,
      phase: { winding: 2 },
      circulation: "alternating",
    }),
    createTusi3D({
      angularSpeed: 1.7,
      orientationWindings: { x: 1, y: 2, z: 3 },
      phase: { winding: 3 },
    }),
    createNotTusi3D({
      angularSpeed: 1.7,
      phase: { twist: 1, pitch: 2, height: -0.5 },
      circulation: "alternating",
    }),
  ];
  for (const model of models) {
    for (const point of model.sample(time)) {
      near(point.motionPhase, model.config.angularSpeed * time - point.phase);
      const expectedTraversal = point.circulation === 0
        ? point.motionPhase
        : point.circulation * model.config.angularSpeed * time - point.phase;
      near(point.traversalPhase, expectedTraversal);
    }
  }
});

test("Euler-wound 3-D Tusi directions are evaluated absolutely and close", () => {
  const model = createTusi3D({
    center: [1, -2, 3],
    radius: 2.5,
    pointCount: 96,
    angularSpeed: 1.3,
    seed: [0.42, 0.61, 0.67],
    orientationWindings: { x: 1, y: 2, z: 3 },
    phase: { winding: 5 },
  });

  near(norm(model.config.seed), 1);
  nearVector(model.paths[0].direction, model.config.seed);
  for (const path of model.paths) {
    const expected = expectedEulerDirection(
      model.config.seed,
      model.config.orientationWindings,
      path.parameter,
    );
    nearVector(path.direction, expected, 2e-12);
    near(norm(path.direction), 1);
    nearVector(
      path.start.map((coordinate, axis) => coordinate + path.end[axis]),
      model.config.center.map((coordinate) => 2 * coordinate),
    );
    near(norm(subtract(path.start, model.config.center)), model.config.radius);
    near(norm(subtract(path.end, model.config.center)), model.config.radius);
  }
  nearVector(
    expectedEulerDirection(model.config.seed, model.config.orientationWindings, TAU),
    model.paths[0].direction,
    3e-12,
  );

  for (const time of [-0.2, 0, 1.4]) {
    for (const point of model.sample(time)) {
      const path = model.paths[point.pathIndex];
      const relative = subtract(point.position, model.config.center);
      near(norm(cross3(relative, path.direction)), 0, 2e-12);
      const expectedPhase = model.config.phase.winding * path.parameter;
      near(point.phase, expectedPhase);
      near(
        point.signedRadius,
        model.config.radius *
          Math.cos(model.config.angularSpeed * time - expectedPhase),
      );
      near(point.radius, Math.abs(point.signedRadius));
    }
  }
});

test("3-D Tusi radius scales bent paths and motion about the center without changing direction or phase", () => {
  const center = [1.25, -2, 3.5];
  const options = {
    pointCount: 200,
    center,
    angularSpeed: 1.3,
    seed: [0.42, 0.61, 0.67],
    orientationWindings: { x: -2, y: 3, z: 5 },
    orientationBends: { x: 0.35, y: -0.65, z: 1.15 },
    phase: { winding: -7 },
  };
  const unitModel = createEulerDiameterTusi3D({ ...options, radius: 1 });
  const times = [-2.25, 0, 0.5, 2.25];
  const unitSamples = times.map((time) => unitModel.sample(time));

  for (const radius of [0.1, 1, 2.5]) {
    const model = createEulerDiameterTusi3D({ ...options, radius });
    for (const path of model.paths) {
      const unitPath = unitModel.paths[path.index];
      assert.deepEqual(path.direction, unitPath.direction);
      assert.equal(path.parameter, unitPath.parameter);
      for (const endpoint of ["start", "end"]) {
        nearVector(
          subtract(path[endpoint], center),
          subtract(unitPath[endpoint], center).map((value) => radius * value),
        );
        near(norm(subtract(path[endpoint], center)), radius);
      }
    }

    for (const [timeIndex, time] of times.entries()) {
      for (const point of model.sample(time)) {
        const unitPoint = unitSamples[timeIndex][point.index];
        nearVector(
          subtract(point.position, center),
          subtract(unitPoint.position, center).map((value) => radius * value),
        );
        near(point.signedRadius, radius * unitPoint.signedRadius);
        near(point.radius, radius * unitPoint.radius);
        assert.equal(point.phase, unitPoint.phase);
        assert.equal(point.motionPhase, unitPoint.motionPhase);
        assert.equal(point.traversalPhase, unitPoint.traversalPhase);
      }
    }
  }
});

test("integer Euler windings can generate a closed non-planar endpoint curve", () => {
  const options = {
    pointCount: 24,
    seed: [0, 0, 1],
    orientationWindings: { x: 3, y: 2, z: 1 },
    phase: { winding: 1 },
  };
  const model = createTusi3D(options);
  const explicit = createEulerDiameterTusi3D(options);
  assert.deepEqual(explicit.config, model.config);
  assert.deepEqual(explicit.paths, model.paths);

  const [p0, p1, p2, p3] = [0, 2, 3, 4].map(
    (index) => model.paths[index].direction,
  );
  const affineDeterminant = dot(
    subtract(p1, p0),
    cross3(subtract(p2, p0), subtract(p3, p0)),
  );
  assert.ok(
    Math.abs(affineDeterminant) > 0.05,
    `expected non-coplanar endpoint samples; determinant ${affineDeterminant}`,
  );
});

test("real periodic bends change each axis while keeping endpoint position and tangent closed", () => {
  const unbent = createTusi3D({ pointCount: 200 });
  for (const orientationBends of [
    { x: 0.35, y: 0, z: 0 },
    { x: 0, y: -0.65, z: 0 },
    { x: 0, y: 0, z: 1.15 },
    { x: -3, y: 3, z: -3 },
  ]) {
    const model = createTusi3D({ pointCount: 200, orientationBends });
    const expectedDirection = (s) => expectedEulerDirection(model.config.seed, {
      x: model.config.orientationWindings.x * s + orientationBends.x * Math.sin(s),
      y: model.config.orientationWindings.y * s + orientationBends.y * Math.sin(s),
      z: model.config.orientationWindings.z * s + orientationBends.z * Math.sin(s),
    }, 1);
    assert.notDeepEqual(model.paths, unbent.paths);
    for (const path of model.paths) {
      nearVector(path.direction, expectedDirection(path.parameter));
      near(norm(path.direction), 1);
      nearVector(path.start.map((v, axis) => v + path.end[axis]), [0, 0, 0]);
    }
    nearVector(expectedDirection(TAU), model.paths[0].direction, 1e-11);
    const h = 1e-5;
    const tangent = (s) => subtract(expectedDirection(s + h), expectedDirection(s - h)).map((v) => v / (2 * h));
    nearVector(tangent(0), tangent(TAU), 1e-8);
    assert.deepEqual(createTusi3D({ ...model.config, phase: { winding: -7 } }).paths, model.paths);
    nearVector(model.sample(0.7).map((p) => p.phase), unbent.sample(0.7).map((p) => p.phase));
  }
  assert.deepEqual(createTusi3D({ orientationBends: { x: 0, y: 0, z: 0 } }).paths, unbent.paths);
});

test("Euler-wound 3-D Tusi remains finite, diameter-collinear, and bounded at N = 200", () => {
  const orientationFields = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 2, z: 0 },
    { x: 0, y: 0, z: 3 },
    { x: 1, y: 2, z: 3 },
    { x: -3, y: 2, z: -1 },
    { x: -100, y: 100, z: -100 },
  ];
  const models = orientationFields.flatMap((orientationWindings) => [
    { x: 0, y: 0, z: 0 }, { x: 0.35, y: -1.25, z: 2.75 }, { x: -3, y: 3, z: -3 },
  ].map((orientationBends) => createTusi3D({
    pointCount: 200,
    radius: 1,
    orientationWindings,
    orientationBends,
    phase: { winding: 3 },
  })));
  for (const model of models) {
    assert.equal(model.paths.length, 200);
    for (const time of [-2.25, 0, 0.5, 2.25]) {
      const points = model.sample(time);
      assert.equal(points.length, 200);
      for (const point of points) {
        const path = model.paths[point.pathIndex];
        const relative = subtract(point.position, model.config.center);
        assert.equal(point.position.every(Number.isFinite), true);
        assert.equal(Number.isFinite(point.signedRadius), true);
        near(norm(cross3(relative, path.direction)), 0, 2e-12);
        assert.ok(point.radius <= model.config.radius + 1e-12);
      }
    }
  }
});

test("Euler-wound 3-D paths depend on orientation, but not motion phase", () => {
  const common = { pointCount: 55, radius: 2, center: [1, 2, 3] };
  const tusiA = createTusi3D({
    ...common,
    orientationWindings: { x: 1, y: 2, z: 3 },
    phase: { winding: 1 },
  });
  const tusiB = createTusi3D({
    ...common,
    orientationWindings: { x: 1, y: 2, z: 3 },
    phase: { winding: 7 },
  });
  assert.deepEqual(tusiA.paths, tusiB.paths);

  for (const [axis, windings] of [
    ["x", { x: 2, y: 2, z: 3 }],
    ["y", { x: 1, y: 3, z: 3 }],
    ["z", { x: 1, y: 2, z: 4 }],
  ]) {
    const changed = createTusi3D({ ...common, orientationWindings: windings });
    assert.notDeepEqual(changed.paths, tusiA.paths, `${axis} winding must affect geometry`);
  }

  const notA = createNotTusi3D({
    ...common,
    phase: { twist: 0, pitch: 0, height: 0 },
  });
  const notB = createNotTusi3D({
    ...common,
    phase: { twist: 3, pitch: -2, height: 4 },
  });
  assert.deepEqual(notA.paths, notB.paths);
});

test("3-D Not-Tusi paths use orthonormal meridian or azimuthal planes", () => {
  for (const circlePlane of ["meridian", "azimuthal"]) {
    const model = createNotTusi3D({ pointCount: 73, circlePlane });
    for (const path of model.paths) {
      near(norm(path.basisU), 1);
      near(norm(path.basisV), 1);
      near(norm(path.normal), 1);
      near(dot(path.basisU, path.basisV), 0);
      near(dot(path.basisU, path.normal), 0);
      near(dot(path.basisV, path.normal), 0);
      nearVector(cross3(path.basisU, path.basisV), path.normal);
      assert.equal(path.plane, circlePlane);
    }
  }
});

test("3-D Not-Tusi on-circle residual stays below 1e-12", () => {
  for (const circlePlane of ["meridian", "azimuthal"]) {
    const model = createNotTusi3D({
      center: [1, -1, 2],
      radius: 3.5,
      orbitRatio: 0.31,
      pointCount: 127,
      circlePlane,
      phase: { twist: 1.25, pitch: -0.75, height: 2.5 },
    });
    let maximumResidual = 0;
    for (const time of [-2, 0, 0.44, 5.1]) {
      for (const point of model.sample(time)) {
        const path = model.paths[point.pathIndex];
        maximumResidual = Math.max(
          maximumResidual,
          Math.abs(norm(subtract(point.position, path.center)) - path.radius),
        );
        const r2 = path.radius;
        const r1 = model.config.radius - r2;
        near(
          point.radius ** 2,
          r1 ** 2 + r2 ** 2 + 2 * r1 * r2 * Math.cos(point.motionPhase),
          2e-11,
        );
      }
    }
    assert.ok(maximumResidual < 1e-12, `maximum residual ${maximumResidual}`);
  }
});

test("equal-radius 3-D Not-Tusi obeys R|cos(tau/2)| and crosses the centre once", () => {
  const model = createNotTusi3D({
    center: [2, 3, -1],
    radius: 4,
    pointCount: 41,
    angularSpeed: 1.7,
    orbitRatio: 0.5,
    phase: { twist: 1, pitch: 2, height: -0.5 },
  });
  for (const time of [-0.5, 0.2, 3.1]) {
    for (const point of model.sample(time)) {
      near(
        point.radius,
        model.config.radius * Math.abs(Math.cos(point.motionPhase / 2)),
        2e-12,
      );
    }
  }
  for (const path of model.paths) {
    const phase =
      model.config.phase.twist * path.longitude +
      model.config.phase.pitch * path.colatitude +
      model.config.phase.height * path.z;
    const crossingTime = (phase + Math.PI) / model.config.angularSpeed;
    nearVector(
      model.sample(crossingTime)[path.index].position,
      model.config.center,
      3e-12,
    );
  }
});
