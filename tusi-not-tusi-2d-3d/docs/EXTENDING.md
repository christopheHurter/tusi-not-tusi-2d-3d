# Extending the reference implementation

> Scope of this technical document: it includes retained software models, historical identifiers, and exploratory extensions. The revised paper uses a carrier-ring spatial Not-Tusi construction and does not develop interpolation methods. See [Manuscript alignment](MANUSCRIPT_ALIGNMENT.md) for the current paper scope. Legacy equation numbers and D/G presets are not current manuscript references.

The suite is designed around one boundary: model code owns mathematics and fixed paths; renderers own pixels and interaction. Keep that boundary intact when building future versions.

## Start from the core, not an example page

For a new application, import `src/core/index.js` and choose a model factory. Example pages are intentionally thin UI clients and are not required by the mathematics.

```js
import { createNotTusi3D } from "./src/core/index.js";

const model = createNotTusi3D({
  pointCount: 500,
  phase: { twist: 1.5, pitch: 2, height: 0 },
  circlePlane: "azimuthal",
});

const points = model.sample(0.75);
```

Any custom renderer needs only `model.dimension`, `model.paths`, and `model.sample(time)`. Do not read private implementation details from a factory closure.

## Add a publication preset

Add a semantic entry in `src/core/presets.js` using the existing `preset()` helper. A preset must contain:

- A lowercase, hyphenated ID describing the model and form, not its position in a menu.
- A concise reader-facing label.
- An editable `paperCallout` such as `T4`, `N5`, or `D12`.
- A description of the observable result.
- A valid model kind and the smallest override object that reproduces it.

Keep existing IDs unchanged. URLs and downstream analyses may already refer to them. Insert a new entry where it belongs in publication order, then add it to `docs/PRESETS.md` and test both `getPreset(id)` and the appropriate example page.

## Add a phase law

The v1 laws deliberately use small, explicit parameter sets:

```text
2-D Tusi and Not-Tusi: phase_i = winding * theta_i
3-D Tusi motion:        phase_i = winding * s_i
3-D Not-Tusi:           phase_k = twist*longitude_k + pitch*colatitude_k + height*z_k
```

For 3-D Tusi, `seed`, integer `orientationWindings: {x, y, z}`, and real
`orientationBends: {x, y, z}` are geometry, not phase. Each Euler angle is
`turns*s + bend*sin(s)` (bend in radians), keeping the endpoint path and its
tangent closed after the full parameter sweep.

A new law should still compute one scalar `phase` for each fixed path, followed by the common `motionPhase = angularSpeed*time - phase` convention. Never rotate or reconstruct paths as a shortcut for changing phase.

If the law needs a new serialized parameter:

1. Decide whether it is model geometry or phase. Put timing-only values under `phase`.
2. Add a default and strict finite-value validation in `src/core/config.js`.
3. Update `schema/config.schema.json`; do not allow an unvalidated catch-all object.
4. Apply the law in the relevant factory without changing the common model or point-record shape.
5. Define interpolation behavior explicitly in `src/core/interpolation.js`.
6. Add equation, endpoint, invariant, serialization, and browser-control tests.
7. Document the mathematical meaning and units in `docs/MATH.md`.

If an existing schemaVersion 1 document would change meaning, introduce a new schema version and a named migration rather than silently reinterpreting the old field.

## Add a new fixed-path geometry

Geometry changes are different from phase changes. A new path family should be represented by immutable descriptors created with the model, then sampled without per-frame allocation of renderer geometry.

Follow the existing descriptor conventions:

- A line-like path supplies `type`, dimension, direction, and fixed endpoints.
- A circle-like path supplies `type`, centre, radius, an orthonormal in-plane basis, and any fixed normal/plane metadata.
- Every descriptor has a stable integer `index` matching sampled `pathIndex`.

Add numerical residual tests that prove every sampled point stays on its declared path. For a new 3-D circle orientation, make the tangent construction deterministic everywhere, including axes and degeneracies, and record the handedness.

## Add or replace a renderer

Renderers must not contain a second copy of the equations. Their data flow should be:

```text
configuration -> model factory -> model.sample(time) -> renderer
                         `-> model.paths -----------^
```

For a dynamic renderer:

- Build path lines/circles and point buffers when the model changes.
- Update existing point-buffer values each frame.
- Keep mathematical coordinates unchanged until the final screen transform.
- Expose a disposal method and release event listeners, GPU buffers, and animation loops.
- Keep animation state and palette/path visibility outside the core equations.

Use `Canvas2DRenderer` as the smallest reference and `ThreeModelRenderer` for WebGL buffer, camera, control, and disposal patterns.

## Add an example page

An example should be a short adapter, not a fork of the core. It should:

- Load only local ES modules.
- Work through any static HTTP server without a build step.
- Provide a visible error message for invalid imported JSON or stale preset IDs.
- Label form controls and expose status changes through an appropriate live region.
- Respect `prefers-reduced-motion`, while allowing an explicit user choice to play.
- Serialize the current time and all model settings needed for exact reproduction.
- Feature-detect optional WebGL/WebXR capabilities and preserve a desktop fallback.

## Interpolation compatibility

Parameter interpolation is appropriate when each intermediate state must remain a valid configuration of one model kind. A new continuous field should normally be linearly interpolated; a new enum must either match at both endpoints or have a clearly documented transition rule.

Point interpolation is intentionally stricter about correspondence than about model kind. It requires equal dimensions, point counts, sampling methods, and indexed path order. Do not add implicit padding, nearest-neighbour matching, or resampling to the core function. If a research application needs such a correspondence method, implement and name it separately so the assumption is visible.

## Compatibility and release checklist

Before publishing an extension:

1. Run numerical and browser tests with zero console errors.
2. Confirm exported JSON validates against the versioned schema and round-trips exactly.
3. Verify path objects are unchanged when only phase values change.
4. Verify all sampled coordinates are finite and path residuals remain within tolerance.
5. Repeatedly change presets/counts and confirm the 3-D scene-object count stabilizes.
6. Test Canvas/WebGL in the supported desktop targets and perform the manual headset checklist when WebXR code changed.
7. Check that the distribution makes no runtime network request and includes all required local licenses.
8. Package `tusi-not-tusi-paper/` only; do not mix historical V0-V4 prototypes into the release archive.
