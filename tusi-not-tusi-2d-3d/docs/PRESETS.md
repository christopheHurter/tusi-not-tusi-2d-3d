# Software preset catalog

> Scope of this technical document: it includes retained software models, historical identifiers, and exploratory extensions. The revised paper uses a carrier-ring spatial Not-Tusi construction and does not develop interpolation methods. See [Manuscript alignment](MANUSCRIPT_ALIGNMENT.md) for the current paper scope. Legacy equation numbers and D/G presets are not current manuscript references.

Preset IDs are stable public identifiers. Labels may be improved for presentation, but IDs should not be renamed after publication because saved links use them.

All values not shown below use the model defaults documented in [`API.md`](API.md). In particular, 2-D presets use `radius = 1`, `pointCount = 24`, and full-circle sampling unless a row says otherwise. The corrected 3-D Tusi experiment uses `pointCount = 200` and a full-circle parameter. Its public default is the Simple turning-hoop construction; Complex retains the integer-turn/periodic-bend G1-G4 presets; Lissajous adds a stereographic lift of a planar curve; and Epicycle transports a local circle around an equatorial carrier. All four families have smoothly closed endpoint paths and use antipodal diameter pairing by default; Epicycle can optionally shift destination pairing to produce fixed off-centre chords. 3-D Not-Tusi uses `pointCount = 260` and Fibonacci-sphere sampling. Paper Not-Tusi presets use `orbitRatio = 0.5` except for the split-radius N4/N5 demonstrations.

There is intentionally no T3. The 3-D Not-Tusi catalog retains manuscript demonstrations D7 through D12. The corrected direct 2-D-to-3-D Tusi translation uses geometry studies G1 through G4 instead of the draft's Fibonacci-phase D1 through D6 family.

## Deterministic URLs

Each model page accepts these query parameters:

- `preset=<semantic-id>` loads one catalog entry.
- `time=<finite-number>` selects the exact sample time.
- `config=<serialized-json>` loads a complete custom configuration instead of a preset.
- `paused=1` always starts a page paused. Otherwise, `autoplay=1` allows playback when the operating system requests reduced motion; it does not override `animation.playing: false` in an imported configuration.

Examples:

```text
examples/tusi-2d/?preset=tusi-2d-rotating-circle&time=1.5708
examples/not-tusi-3d/?preset=not-tusi-3d-double-lobe&time=0.75
```

The Copy link control creates the same form and keeps four decimal places for time. Import/export JSON is preferred when reproducing a custom state with several edited parameters.

The public `examples/pedagogy/tusi3d/` page additionally accepts
`geometry=simple|advanced|lissajous|epicycle`, independently of its `motion` selection.
The `advanced` value retains its stable internal ID and displays as Complex.
With no geometry parameter, the page opens in Simple. To inspect G1-G4, choose
Complex; those presets do not replace the retained Simple, Lissajous, or
Epicycle controls.

## Tusi 2-D: T1, T2, and T4

| Callout | Preset ID | Stored values | Reproduction |
| --- | --- | --- | --- |
| T1 | `tusi-2d-in-out` | `w = 0` | Play with fixed diameters visible; all samples reach centre and rim together. |
| T1 | `tusi-2d-rotating-circle` | `w = 1` | Play with fixed diameters visible; the samples form a revolving circle of radius `R/2`. |
| T2 | `tusi-2d-winding-sweep` | `N = 24`, `w = 3` endpoint | Start at `w = 0`, play, and drag Winding continuously to `3`. The fixed diameters do not move. |
| T4 | `tusi-2d-alias-w3-n24` | `N = 24`, `w = 3` | Dense three-leaf reference. |
| T4 | `tusi-2d-alias-w3-n12` | `N = 12`, `w = 3` | Coarse three-leaf sample. |
| T4 | `tusi-2d-alias-w3-n5` | `N = 5`, `w = 3` | Sparse, collapsed sample. |
| T4 | `tusi-2d-wagon-reverse-w4-n5` | `N = 5`, `w = 4` | The `w = N - 1` samples are identical to `w = -1` and revolve backwards. |
| T4 | `tusi-2d-wagon-alias-w6-n5` | `N = 5`, `w = 6` | The `w = N + 1` samples reproduce `w = 1` point for point. |

To reproduce Figure 3's sampling sequence, keep `w = 3` and select the N24, N12, and N5 presets in order. To reproduce the wagon-wheel comparison, set identical time values in the W4 and W6 links.

## Not-Tusi 2-D: N1 through N5

| Callout | Preset ID | Stored values | Reproduction |
| --- | --- | --- | --- |
| N1 | `not-tusi-2d-translating-ring` | `w = 0`, `r2/R = 0.5` | Play with fixed circles visible; the ring translates without rotating. |
| N2 | `not-tusi-2d-sweeping-blade` | `w = 1`, `r2/R = 0.5` | The points form a line sweeping at half the temporal rate. |
| N3 | `not-tusi-2d-clover-w2` | `N = 24`, `w = 2` | First equal-radius petal example. |
| N3 | `not-tusi-2d-clover-w3` | `N = 24`, `w = 3` | Second equal-radius petal example. |
| N3 | `not-tusi-2d-alias-few-dots` | `N = 7`, `w = 3` | Sparse sample exposing the failure of the continuous prediction. |
| N4 | `not-tusi-2d-rotating-ellipse` | `w = 1`, `r2/R = 0.25` | The equal-radius blade opens into a rotating ellipse. |
| N4 | `not-tusi-2d-rounded-triangle` | `w = 2`, `r2/R = 0.25` | Rounded triangle. |
| N4 | `not-tusi-2d-rounded-pentagon` | `w = 4`, `r2/R = 0.25` | Rounded pentagon. |
| N4 | `not-tusi-2d-spirograph` | `w = 3`, `r2/R = 0.75` | Four-lobed spirograph-like rosette. |
| N5 | `not-tusi-2d-counter-triangles` | `N = 22`, `w = 2`, `r2/R = 0.25`, alternating | Two rounded triangles counter-rotate; the direction palette separates them. |
| N5 | `not-tusi-2d-scissors` | `w = 1`, `r2/R = 0.25`, alternating | Two counter-rotating ellipses cross as scissors. |
| N5 | `not-tusi-2d-counter-squares` | `w = 3`, `r2/R = 0.25`, alternating | Two rounded squares counter-rotate. |

The draft's N4a-N4d movie sequence is reproduced by loading, in order:

1. N4a: `not-tusi-2d-counter-triangles`.
2. N4b: `not-tusi-2d-scissors`.
3. N4c: `not-tusi-2d-counter-squares`.
4. N4d: `not-tusi-2d-rounded-pentagon`.

Use the same playback speed and capture interval for all four. The first three are catalogued under paper callout N5 because they use alternating circulation; the movie labels are retained here exactly as written in the working draft.

## 3-D Tusi Simple geometry

The public page starts with Diameter turns `-1`, Hoop turns `2`, Hoop tilt
`60` degrees, and Motion winding `1`. `HOOP_SHAPE_DEFAULTS` exposes the exact
Simple geometry values stored in the bridge as:

```js
hoopShape: {
  diameterTurns: -1,
  hoopTurns: 2,
  tiltDegrees: 60,
}
```

For construction parameter `theta = 2*pi*i/N`, `hoopDiameterDirection()`
evaluates `Rz(hoopTurns*theta) Rx(tiltDegrees*pi/180)
Rz(diameterTurns*theta) [1, 0, 0]`. A diameter turns within its hoop; that
hoop is tilted, then turned around the vertical axis as samples are placed.
These operations create the fixed paths once. They do not rotate the paths
during animation; only the balls' positions depend on time.

Both turn counts range from `-100` to `100` in integer steps. Hoop tilt ranges
from `0` to `180` degrees in one-degree UI steps; the helper accepts real-valued
tilt in that range. At zero tilt, the net planar turn count is
`hoopTurns + diameterTurns`, which equals `1` for the defaults and therefore
recovers full-circle 2-D Tusi. At 180 degrees it is
`hoopTurns - diameterTurns`. Zero Hoop turns leaves a fixed tilted plane;
zero Diameter turns leaves an equator unaffected by tilt.

Simple is a three-parameter geometry family without G presets. Its controls
have mechanical meanings but are not globally orthogonal and do not cover
every spherical curve. Switching between Simple, Complex, Lissajous, and Epicycle retains all
sets of geometry controls plus motion, display, sample count, radius, time,
and camera. The shared integer Motion winding ranges from `-100` to `100` and
changes timing without changing any family's fixed paths. The former
`spectralShape` and `harmonicShape` inputs are rejected; the core
`createTusi3D()` configuration and schema remain unchanged.

## 3-D Tusi Complex geometry studies G1-G4

All four configurations share the normalized seed, full-circle order, radius,
and motion winding `W = 1`. Their integer `{X, Y, Z}` values change the closed
path of antipodal endpoints on the reference sphere and therefore the family
of fixed diameters. All presets have zero bends. The separate X/Y/Z bend controls
accept real amplitudes from `-3` to `3` radians in steps of `0.05`, adding one
`sin(s)` deformation per axis without opening the path. Selecting a preset
restores its integer turns and zero bends; Simple, Lissajous, and Epicycle geometry settings,
other controls, and the camera are preserved. Preset radios are available only
in Complex mode.

| Study | Preset ID | Orientation `{x, y, z}` | Fixed-path organization |
| --- | --- | --- | --- |
| G1 | `tusi-3d-planar-ring` | `{0, 0, 1}` | Planar reference ring of endpoint directions. |
| G2 | `tusi-3d-two-axis-loop` | `{1, 0, 2}` | Two-axis loop lifted off one plane. |
| G3 | `tusi-3d-three-axis-weave` | `{1, 2, 3}` | Initially retained Complex closed non-planar endpoint weave. |
| G4 | `tusi-3d-dense-weave` | `{2, 3, 5}` | Denser closed weave from higher coprime windings. |

Enable **Show fixed diameters** to see that every sphere endpoint is paired
with its antipode by a line through the centre. After choosing one geometry,
change **Motion winding W** separately: the moving balls change relative
timing while the endpoint curve and all diameters remain fixed.

## 3-D Tusi Lissajous geometry

Choose Lissajous, or open `examples/pedagogy/tusi3d/?geometry=lissajous`.
The initial state is Horizontal cycles `1`, Vertical cycles `2`, and Curve
alignment `0` degrees. It has no G preset selection. The bridge stores:

```js
lissajousShape: {
  horizontalCycles: 1,
  verticalCycles: 2,
  alignmentDegrees: 0,
}
```

`LISSAJOUS_SHAPE_DEFAULTS` exposes these defaults and
`lissajousDiameterDirection()` evaluates the shape. For `s = 2*pi*i/N`, form
`X = cos(m*s)`, `Y = sin(n*s + phi)` with fixed unit amplitudes, then map to
`u = [2*X, 2*Y, 1-X^2-Y^2] / (1+X^2+Y^2)`. The endpoint pair is `c +/- R*u`.
Both cycle counts are integers from `1` to `100`; alignment ranges from `-180`
to `180` degrees in one-degree UI steps and may be real-valued through the helper.

For an exact full-circle 2-D reference, use `m = n = 1` and alignment `0`.
Compare it with the spatial `1:2` default or `2:3` while retaining the same
Motion winding, sample count, radius, time, and camera. Curve alignment changes
the endpoint arrangement, not the balls' timing. Mode switches remember all
four sets of geometry controls and their shared state. Integer cycles keep
the endpoint path smoothly closed, but higher counts can alias at finite N;
this family does not cover every spherical curve.

## 3-D Tusi Epicycle geometry

Choose Epicycle, or open `examples/pedagogy/tusi3d/?geometry=epicycle`. The
initial state is Carrier turns `1`, Epicycle turns `2`, and Angular radius `35`
degrees. Its E preset is separate from the G1–G4 Complex studies. The bridge
stores:

```js
epicycleShape: {
  carrierTurns: 1,
  epicycleTurns: 2,
  angularRadiusDegrees: 35,
  destinationPhaseDegrees: 0,
}
```

`EPICYCLE_SHAPE_DEFAULTS` exposes these defaults and
`epicycleDiameterDirection()` evaluates the shape. Carrier turns and Epicycle
turns are integers from `-100` to `100`; Angular radius ranges from `0` to `90`
degrees. Destination phase ranges from `-180` to `180` degrees. Both angle
controls use one-degree UI steps and may be real-valued through the helper.

Carrier turns move the local construction around the equator, Epicycle turns
rotate an endpoint around that local carrier direction, and Angular radius sets
their constant separation on the sphere. Negative Epicycle turns reverse the
local handedness. Common factors in the two turn counts can retrace geometry.
For an exact full-circle 2-D reference, use Carrier turns `1` and Angular radius
`0`; Epicycle turns then have no geometric effect. Motion winding remains a
separate timing control. Mode changes retain Epicycle values, all other geometry
settings, shared controls, time, and camera. This is a carrier-and-local-circle
metaphor, not a strict no-slip planar epicycloid.

Destination phase `delta` selects the second endpoint at a shifted construction
parameter: `start = c - R*u(s)` and `end = c + R*u(s + delta)`. Its default zero
keeps antipodal endpoints and a strict Tusi diameter through the sphere centre.
Nonzero values form fixed off-centre chords instead, so this setting is an
intentional non-Tusi comparison. Both endpoints remain on the sphere and every
point between them stays inside it. Chord lengths may differ because a uniform
parameter shift need not be a uniform spherical displacement. Destination
phase changes geometric pairing; it is not Motion winding and does not change
ball timing.

### Epicycle designs E1–E6

The Epicycle panel includes six visually distinct, recallable configurations.
`C` is the number of repeated color groups.

| Callout | Preset ID | Geometry and motion | Visual organization |
| --- | --- | --- | --- |
| E1 Four-corner frame | `epicycle-four-corner-frame` | `N = 567`, `R = 1.15`, `a = 19`, `b = 76`, `eta = 27°`, `delta = -30°`, `W = 0`, Tusi, size `10`, `C = 1` | Dense red four-corner frame; its common turn factor retraces the underlying `1:4` endpoint curve. |
| E2 Near-cusp heart | `epicycle-near-cusp-heart` | `N = 480`, `R = 1`, `a = 1`, `b = 4`, `eta = 14°`, `delta = 0°`, `W = 0`, Tusi, size `7`, `C = 1` | Strict centred diameters near the `eta = atan(1/4)` cusp condition, producing a sparse heart-like outline. |
| E3 Twin orbit | `epicycle-twin-orbit` | `N = 360`, `R = 1`, `a = 1`, `b = 2`, `eta = 62°`, `delta = 85°`, `W = 0`, Tusi, size `9`, `C = 2` | Low-order off-centre pairing forms two clean orbit-like strands. |
| E4 Double ribbon | `epicycle-double-ribbon` | `N = 480`, `R = 1`, `a = 5`, `b = 2`, `eta = 55°`, `delta = 0°`, `W = 1`, Tusi, size `8`, `C = 2` | Strict centred diameters organize into two interlaced spatial ribbons. |
| E5 Five-blade turbine | `epicycle-five-blade-turbine` | `N = 520`, `R = 1`, `a = 4`, `b = 5`, `eta = 75°`, `delta = 130°`, `W = 1`, Tusi, size `8`, `C = 5` | Five color groups expose a dense off-centre turbine symmetry. |
| E6 Linear four-cross | `epicycle-linear-four-cross` | `N = 520`, `R = 1`, `a = 7`, `b = 4`, `eta = 60°`, `delta = 80°`, `W = 2`, Linear, size `8`, `C = 4` | Constant-speed back-and-forth motion produces a crisp four-cross cage and contrasts directly with the smooth Tusi presets. |

All six presets hide the reference sphere, endpoint paths, fixed chords, and
selected-dot highlight for an uncluttered initial view. Selecting one switches
to Epicycle and restores every value in its row, but it does not restart or
pause the animation or reset the user's camera: current time, play state, and
viewpoint are preserved. Manual edits clear the selected preset without
discarding the edited state.

## 3-D Not-Tusi movies D7-D12

All six configurations use `orbitRatio = 0.5`, forward circulation, and meridian circle planes by default. Only the phase field changes.

| Movie | Preset ID | Phase `{twist, pitch, height}` | Global organization |
| --- | --- | --- | --- |
| D7 | `not-tusi-3d-collapse-bloom` | `{0, 0, 0}` | Synchronous collapse to the centre and bloom. |
| D8 | `not-tusi-3d-revolving-lobe` | `{1, 0, 0}` | Single revolving lobe. |
| D9 | `not-tusi-3d-double-lobe` | `{2, 0, 0}` | Double lobe. |
| D10 | `not-tusi-3d-twin-shells` | `{0, 2, 0}` | Twin shells passing through one another. |
| D11 | `not-tusi-3d-height-wave` | `{0, 0, 3}` | Travelling vertical bands. |
| D12 | `not-tusi-3d-vortex` | `{1, 3, 0}` | Spiral pinch/vortex. |

Enable Show fixed paths while changing presets: every circle must remain stationary. Changing Circle plane from Meridian to Azimuthal is a separate geometry experiment, not a phase-law change.

## Catalog access from code

```js
import { getPreset, listPresets } from "../src/core/index.js";

const geometryStudy = getPreset("tusi-3d-three-axis-weave");
const notTusiMovies = listPresets({ kind: "not-tusi-3d" });
const figureT4 = listPresets({ paperCallout: "T4" });
```

`listPresets()` preserves publication order. `getPreset()` throws for an unknown ID so stale or mistyped links fail clearly instead of silently selecting a different demonstration.
