# Public API

> Scope of this technical document: it includes retained software models, historical identifiers, and exploratory extensions. The revised paper uses a carrier-ring spatial Not-Tusi construction and does not develop interpolation methods. See [Manuscript alignment](MANUSCRIPT_ALIGNMENT.md) for the current paper scope. Legacy equation numbers and D/G presets are not current manuscript references.

The mathematical API is exported from `src/core/index.js`. It has no DOM, Canvas, Three.js, or browser dependency and can be imported by a browser ES module or by Node.js.

```js
import {
  createTusi2D,
  createNotTusi2D,
  createTusi3D,
  createNotTusi3D,
} from "./src/core/index.js";
```

## Canonical configuration

A canonical configuration is a deeply frozen, JSON-compatible object. Unknown properties are errors; model-irrelevant properties are also errors. Factories accept partial overrides and fill these defaults:

| Kind | Centre | N | Sampling | Phase | Additional geometry |
| --- | --- | ---: | --- | --- | --- |
| `tusi-2d` | `[0, 0]` | 24 | `full-circle` | `{winding: 0}` | - |
| `not-tusi-2d` | `[0, 0]` | 24 | `full-circle` | `{winding: 0}` | ratio `0.5`, forward circulation |
| `tusi-3d` | `[0, 0, 0]` | 200 | `full-circle` | `{winding: 1}` | seed `[0.42, 0.61, 0.67]` (normalized by the factory); integer turns `{x: 1, y: 2, z: 3}` and bends `{x: 0, y: 0, z: 0}` |
| `not-tusi-3d` | `[0, 0, 0]` | 260 | `fibonacci-sphere` | `{twist: 0, pitch: 0, height: 0}` | ratio `0.5`, forward circulation, meridian plane |

All kinds also default to:

```js
{
  schemaVersion: 1,
  radius: 1,
  angularSpeed: 1,
  animation: { time: 0, speed: 1, playing: true },
  visualization: { showPaths: true, palette: "phase", pointSize: 5 },
}
```

### Fields

| Field | Type and rule |
| --- | --- |
| `schemaVersion` | Must be exactly `1`. |
| `kind` | `tusi-2d`, `not-tusi-2d`, `tusi-3d`, or `not-tusi-3d`. |
| `center` | Two finite numbers for 2-D or three finite numbers for 3-D. |
| `radius` | Finite number greater than zero. |
| `pointCount` | Positive integer. |
| `angularSpeed` | Finite number. Negative values reverse the base time direction. |
| `sampling` | `full-circle` or `half-circle` in 2-D; exactly `full-circle` for 3-D Tusi; exactly `fibonacci-sphere` for 3-D Not-Tusi. |
| `phase` | Exactly `{winding}` for 2-D and 3-D Tusi, or `{twist, pitch, height}` for 3-D Not-Tusi. The 3-D Tusi winding is an integer; all phase values are finite. |
| `seed` | 3-D Tusi only; a non-zero three-coordinate direction. `createConfig()` normalizes it. |
| `orientationWindings` | 3-D Tusi only; integer turns `{x, y, z}` about fixed global axes. |
| `orientationBends` | 3-D Tusi only; finite real amplitudes `{x, y, z}` in radians, default zero. Each axis angle is `turns*s + bend*sin(s)`, preserving smooth closure. |
| `orbitRatio` | Not-Tusi only; finite number from 0 through 1. `r2 = orbitRatio*radius`. |
| `circulation` | Not-Tusi only; `forward`, `reverse`, or `alternating`. |
| `circlePlane` | 3-D Not-Tusi only; `meridian` or `azimuthal`. |
| `animation.time` | Finite default sample time. |
| `animation.speed` | Finite number at least zero. It is a UI playback multiplier, not `angularSpeed`. |
| `animation.playing` | Boolean serializable playback state. |
| `visualization.showPaths` | Boolean renderer preference. |
| `visualization.palette` | `phase`, `radius`, `direction`, or `mono`. |
| `visualization.pointSize` | Finite number greater than zero. |

The machine-readable equivalent is [`../schema/config.schema.json`](../schema/config.schema.json).

## Configuration functions and constants

`SCHEMA_VERSION`, `MODEL_KINDS`, `SAMPLING_METHODS`, `CIRCULATION_MODES`, `CIRCLE_PLANES`, and `PALETTES` expose the supported version and enum values as frozen constants.

### `createConfig(kind, overrides = {})`

Merges partial overrides into the defaults for `kind`, validates them, returns properties in canonical order, and deeply freezes the result. `phase`, `animation`, and `visualization` are shallow-merged with their corresponding nested defaults. It throws `ConfigValidationError` for unsupported fields, missing canonical values, or invalid values.

```js
const config = createConfig("not-tusi-2d", {
  pointCount: 22,
  phase: { winding: 2 },
  orbitRatio: 0.25,
  circulation: "alternating",
  visualization: { palette: "direction" },
});
```

### `getDefaultConfig(kind)`

Returns a fresh, deeply frozen canonical default configuration.

### `validateConfig(config)`

Validates a complete canonical configuration without modifying or throwing for ordinary validation failures. It returns:

```text
{ valid: boolean, errors: readonly string[] }
```

Use `createConfig()` when accepting partial overrides; use `validateConfig()` when reporting every problem in an already-complete document.

### `serializeConfig(config, space = 2)`

Validates and canonicalizes the configuration, then returns JSON with deterministic property order. `space` must be an integer from 0 through 10.

### `deserializeConfig(text)`

Parses JSON, validates all fields, canonicalizes it, and returns a deeply frozen configuration. Malformed JSON, unsupported schema versions, and unknown fields throw `ConfigValidationError` with an immutable `errors` array.

## Models

### Factories

- `createTusi2D(overrides = {})`
- `createNotTusi2D(overrides = {})`
- `createTusi3D(overrides = {})`
- `createNotTusi3D(overrides = {})`
- `createModel(config)` dispatches by `config.kind`.

Each returns a frozen object with the same interface:

```text
model.kind       string
model.dimension  2 or 3
model.config     canonical frozen configuration
model.paths      frozen fixed-path descriptors
model.sample(time = model.config.animation.time) -> point[]
```

`sample()` requires a finite time and returns fresh plain records:

```js
{
  index,          // stable sample index
  pathIndex,      // index of the fixed path
  position,       // [x, y] or [x, y, z]
  phase,          // assigned winding value or 3-D Not-Tusi field value
  motionPhase,    // always angularSpeed * time - phase
  traversalPhase, // actual path angle after optional circulation reversal
  signedRadius,   // signed centre-distance metadata
  radius,         // non-negative distance from display centre
  circulation,    // 0 for Tusi, +1 or -1 for Not-Tusi
}
```

Tusi path descriptors have `type: "diameter"`, a direction, and fixed start/end points. A 3-D Tusi descriptor also carries its full-circle curve `parameter`. Not-Tusi descriptors have `type: "circle"`, a centre, radius, plane basis, and circulation direction. The 3-D Not-Tusi paths additionally carry the Fibonacci sample's longitude, colatitude, and z value.

## Geometry helpers

- `TAU` is `2*pi`.
- `GOLDEN_ANGLE` is `pi*(3 - sqrt(5))`.
- `fibonacciSphere(pointCount)` returns immutable half-offset samples `{index, direction, longitude, colatitude, z}`.
- `sphereTangentBasis(sampleOrDirection, plane = "meridian")` returns `{plane, radial, tangent, normal, longitude, colatitude}` for a deterministic right-handed circle plane.

See [`MATH.md`](MATH.md) for the exact formulae.

## Interpolation

Both functions accept either a model or a canonical/partial configuration and clamp finite `alpha` to `[0, 1]`. Invalid inputs throw `InterpolationError`.

### `interpolateParameters(a, b, alpha)`

Returns one canonical configuration. The endpoint kinds must match. Sampling, visualization palette, circulation, and circle plane must also match where applicable. For 3-D Tusi, the normalized seed, all three integer turns and bend amplitudes, and the motion winding must match because this helper does not interpolate between different fixed-path families. Mismatches are explicit errors.

Continuous numeric values are linearly interpolated, including centre, radius, angular speed, 2-D and 3-D Not-Tusi phase values, animation values, point size, and Not-Tusi orbit ratio. `pointCount` is linearly interpolated and rounded. Boolean values choose endpoint A below `0.5` and endpoint B at or above `0.5`.

```js
const midway = interpolateParameters(configA, configB, 0.5);
const model = createModel(midway);
```

### `interpolatePoints(a, b, time, alpha)`

Samples both endpoints at the same finite time and linearly blends corresponding point records. It returns a point array, not a model or configuration.

Kinds may differ, but dimensions, `pointCount`, sampling method, path count, and indexed sampling order must match. The function never pads, drops, reorders, or implicitly resamples points.

## Presets

`PRESET_CATALOG` maps stable semantic IDs to immutable entries:

```text
{ id, label, kind, paperCallout, description, config }
```

- `listPresets({kind, paperCallout} = {})` returns entries in stable publication order.
- `getPreset(id)` returns one entry and throws `RangeError` for an unknown ID.

The complete list and paper/movie mapping are in [`PRESETS.md`](PRESETS.md).

## Renderers

Renderers consume the common model interface and are deliberately outside the mathematical barrel.

### Canvas 2-D

```js
import { Canvas2DRenderer } from "./src/renderers/canvas-renderer.js";

const renderer = new Canvas2DRenderer(canvas, options).setModel(model);
renderer.render(time);
```

Useful methods are `setModel()`, `setOptions()`, `render()`, `resize()`, and `dispose()`. Canvas is the only layer that changes mathematical positive-y-up coordinates to screen positive-y-down coordinates.

### Three.js

```js
import {
  ThreeModelRenderer,
  createThreeRenderer,
  THREE_PALETTES,
  DEFAULT_THREE_PALETTE,
} from "./src/renderers/three-renderer.js";
```

`createThreeRenderer(container, options)` is the convenience factory. The renderer creates path geometry only when `setModel()` changes the model; `update(time)` changes point buffers in place. Its main lifecycle and control methods are `setModel()`, `update()`, `render()`, `start()`, `stop()`, `setPathsVisible()`, `setControlsEnabled()`, `setPointSize()`, `setPalette()`, `resize()`, `fitView()`, and `dispose()`. `sceneObjectCount` supports stability checks.

### Optional WebXR

```js
import {
  queryWebXRSupport,
  installWebXR,
  enableWebXR,
  WebXRSessionController,
} from "./src/renderers/webxr.js";
```

`queryWebXRSupport()` returns `{supported, reason}` without creating UI. `installWebXR(renderer, options)` and its alias `enableWebXR()` create the entry button only after secure-context and `immersive-vr` support checks pass. Unsupported results have `button: null` and safe no-op `endSession()`/`dispose()` methods. See [`BROWSERS.md`](BROWSERS.md) for the session lifecycle.
