# Public experiments

> Scope of this technical document: it includes retained software models, historical identifiers, and exploratory extensions. The revised paper uses a carrier-ring spatial Not-Tusi construction and does not develop interpolation methods. See [Manuscript alignment](MANUSCRIPT_ALIGNMENT.md) for the current paper scope. Legacy equation numbers and D/G presets are not current manuscript references.

The public sequence intentionally contains six experiments: **Tusi, Motion Control**, **Tusi, Phase Control**, **Not Tusi**, **Parameter Sets**, **3D - Tusi**, and **3D - Not Tusi**. They preserve the progression developed in the manuscript and selected historical V0–V4 prototypes while using the publication core, conventions, renderers, and validation throughout. The first two are separate because Motion Control compares motion laws, whereas Phase Control studies full-circle phase arrangement while retaining that comparison. All six experiments are clean reimplementations rather than repaired copies. Phase Control also incorporates V1's additive displacement shift and V2's useful amplitude/position-mapping ideas; Not Tusi is the paired circle-motion explanation. 3D - Tusi is the corrected direct lift of the 2-D construction: a smoothly closed path on the sphere supplies antipodal endpoints for fixed diameters, and balls oscillate along those lines. Its default Simple geometry places diameters using a diameter inside a turning, tilted hoop; Complex retains its independent integer X/Y/Z turns and real periodic bends; Lissajous maps a planar two-oscillation curve onto the sphere; Epicycle transports a local circle around an equatorial carrier. All four are construction rules, not paths that move during playback. Epicycle also includes an optional destination-pairing offset: zero retains the strict diameter, while nonzero values expose fixed off-centre chords as a boundary comparison. 3D - Not Tusi then presents the historical V4 carrier ring. The original prototype folders remain sibling directories outside this release, are not modified, and are not included in the publication archive.

Start at the main [`index.html`](../index.html) launcher. Its **Experiments** section links directly to the six experiments in the order listed above. The five reusable model demonstrations and other author-facing routes remain in the source repository but are excluded from the publication package.

Every page shares one compact template. Its first row places the title and lesson navigation beside a fixed-height equation-and-terms panel; its second row places a compact control panel beside the animation. Overflowing panels support wheel, touch, keyboard, and background-drag scrolling, with a slim scrollbar making that additional content discoverable.

## Source-to-experiment map

| Experiment | Source | Historical source folder | Clean route | Purpose |
| --- | --- | --- | --- | --- |
| **Tusi, Motion Control** | V0 | `looping lines V0` | [`examples/pedagogy/v0/`](../examples/pedagogy/v0/) | Place oscillators on fixed diameters, allow `N = 1`, and compare the Tusi cosine's smooth endpoint reversal with constant-speed linear ping-pong motion. |
| **Tusi, Phase Control** | Full-circle phase controls | `looping lines V0`, V1 shift, and V2 position view | [`examples/pedagogy/tusi2/`](../examples/pedagogy/tusi2/) | Retain the motion/speed comparison and vary amplitude, additive signed displacement shift, and winding over the historical full-circle direction order. |
| **Not Tusi** | New paired explanation | — | [`examples/pedagogy/v0bis/`](../examples/pedagogy/v0bis/) | Use equal-radius fixed circles and contrast uniform circulation with line motion and its endpoints. |
| **Parameter Sets** | V3 extended | `looping lines V3 circles interpolation` | [`examples/pedagogy/v3/`](../examples/pedagogy/v3/) | Compare separate Tusi line and historical Not Tusi circle preset families, then distinguish parameter-space interpolation from point-space interpolation. |
| **3D - Tusi** | Direct 2-D-to-3-D translation; Simple, Complex (G1–G4), Lissajous, and Epicycle | — | [`examples/pedagogy/tusi3d/`](../examples/pedagogy/tusi3d/) | Construct fixed diameters with a turning hoop, Complex XYZ turns and bends, a stereographic Lissajous lift, or a transported local circle; Epicycle can optionally replace antipodal pairing with off-centre chords, while ball timing remains independent. |
| **3D - Not Tusi** | V4 | `looping lines V4 3D points` | [`examples/pedagogy/v4/`](../examples/pedagogy/v4/) | Lift one selected offset into 3-D, distribute rotated copies around a carrier ring, and separate shared from axis-specific Euler phase. |

The Tusi and Not Tusi title panels retain compact origin references. Tusi credits Nasir al-Din al-Tusi's 13th-century Tusi couple and identifies the modern illusion by Arthur G. Shapiro and Alex Rose-Henig. Not Tusi cites their *Tusi or Not Tusi* entry, which received second prize in the 2013 Best Illusion of the Year Contest.

These example labels describe the historical development of the interactive explanation. They are deliberately separate from the paper callouts T1, T2, T4; N1–N5; and D1–D12.

Not Tusi is not historical V1: its internal route is `v0bis`, and its purpose is the new, direct line-versus-circle comparison requested for this supplement. Historical V1 is intentionally not a separate clean lesson. Its core comparison—the same oscillation displayed on parallel bars and radial spokes—is already covered by the paired views in Phase Control. The untouched V1 source remains available outside the release as a historical record.

## Common formulation used by every clean lesson

All lessons share the core's time and phase convention:

```text
motionPhase = angularSpeed * time - phase
```

For a 2-D Tusi point on the diameter direction
`u_i = (cos(theta_i), sin(theta_i))`, the introductory Tusi page samples the
unoriented lines over a half-circle so every displayed diameter is unique:

```text
theta_i = pi*i/N
phase_i = winding*theta_i
p_i(t) = center + radius*cos(angularSpeed*t - phase_i)*u_i
```

Thus `N = 1` gives one horizontal line, while `N = 2` gives one horizontal
and one vertical line. The general paper API continues to expose both
`half-circle` and `full-circle` sampling explicitly through configuration.

Tusi Phase Control retains the Linear/Tusi selector and synchronized signed-speed
graph from Motion Control, then restores the amplitude and V1-style signed-shift
controls on the historical full-circle direction sequence. In Tusi mode:

```text
p_i(t) = center + radius*[A*cos(angularSpeed*t - w*theta_i) + Delta]*u_i
```

`A` scales the oscillating part of the excursion along every fixed diameter.
The signed shift `Delta` is added afterward, following historical V1: positive
values bias the displacement toward the positive end of each oriented axis and
negative values bias it toward the negative end. It changes position but not
velocity or relative phase. Winding `w` remains the spatial phase gradient
between indexed points. Phase Control now uses only:

```text
theta_i = 2*pi*i/N
```

This samples opposite orientations separately, as historical V0 did. A
parallel-bar view adapted from historical V2 shows the same
indexed points before their signed displacements are rotated onto the sampled
diameters. Matching colors, plus the optional selected red point, make the
correspondence explicit.

For the introductory half-circle Tusi page, the connected continuous limit at
the omitted endpoint satisfies

```text
p(pi) = (-1)^(w + 1) p(0)
```

Consequently, odd integer winding closes the displayed pattern continuously,
whereas even winding joins antipodal points with a closing chord. The Tusi
page therefore exposes the wider odd-only range `-99, -97, ..., 97, 99`.

Tusi also provides a deliberately non-harmonic comparison on exactly the
same diameters. Let `q_i = angularSpeed*t - phase_i` and

```text
L(q) = 1 - (2/pi)*acos(cos(q))
p_i_linear(t) = center + radius*L(q_i)*u_i
```

`L` is a triangular wave with the same period and endpoints as `cos`. It moves
at constant speed between the endpoints and reverses abruptly there. It is a
comparison law, not a replacement for the canonical Tusi cosine.

The Not-Tusi lesson keeps each path circle fixed. Let `u(alpha) = (cos(alpha), sin(alpha))`. With orbit radius `r2`, carrier radius `r1 = R - r2`, sample direction `theta_i`, and global traversal phase `q_i(t)`, the implementation has the geometric form

```text
pathCenter_i = center + r1*u(theta_i)
p_i(t) = pathCenter_i + r2*u(q_i(t))
```

Equivalently, in the local radial/tangential basis
`u_i = u(theta_i)`, `v_i = (-sin(theta_i), cos(theta_i))`, the orbit angle is
`q_i(t) - theta_i`, not `q_i(t)`.

Not Tusi uses the equal split `r1 = r2 = R/2`. Each riding circle therefore
passes through the common center and outer rim, and each point travels around
its fixed circle with uniform angular speed.

**3D - Not Tusi** deliberately preserves the historical V4 carrier-ring construction as a
separate pedagogical model. For sample angle `theta_i = 2*pi*i/N`, carrier
center `c_i`, upper-hemisphere seed `u`, and local radius `s`, it uses

```text
c_i = center + B*(cos(theta_i), sin(theta_i), 0)
p_i = c_i + Rz(gamma_i)*Ry(beta_i)*Rx(alpha_i)*(s*u)
```

The selector always normalizes `u`, so `|u| = 1`. It changes only the local
direction. `B` alone fixes the carrier-ring radius, while `s` fixes every
point's distance from its carrier center. The camera therefore remains fixed
when `u` changes, making those two radii visually comparable.

Each Euler angle has its own integer winding. Integer values make the phase
field close continuously around the sampled carrier ring. The clean
implementation follows the same right-handed, z-up convention as the paper
core and uses elapsed seconds.
This experiment is a historical bridge, not a fifth schema model kind. The
preceding **3D - Tusi** experiment instead evaluates a full-circle parameter
through a diameter-in-a-turning-hoop construction in Simple mode, three absolute
Euler angles with integer turns and real periodic bends in Complex mode, a
stereographic lift of a planar Lissajous curve, or an Epicycle local circle
transported around an equatorial carrier. All four build a smoothly
closed spherical endpoint path. The independent motion winding
controls only when each ball moves along its already-fixed diameter.

The historical prototypes mixed phase signs, degrees and radians, control labels such as *shift* and *frequency*, and frame-driven increments. A legacy display may therefore appear to rotate in the opposite handedness. The clean lessons do not preserve those incidental sign and timing differences: configuration always stores a phase, sampling always subtracts that phase, and animation time is expressed in seconds.

## What each lesson retains

### Tusi, Motion Control (historical V0)

Tusi, Motion Control retains the simplest visual argument: identical cosine oscillators move along fixed diameters, and connecting their current locations reveals a global form. `N` ranges down to `1`, making it possible to inspect a single point before adding phase-related samples. Half-circle sampling prevents duplicate unoriented paths: `N = 2` is horizontal plus vertical, not two overlapping copies of one diameter. The page exposes only the variables needed to see this happen—motion law, time, point count, and winding—and identifies the fixed paths separately from the moving samples.

The Linear/Tusi motion choice is grouped directly with the selected red point's signed-velocity plot. The equation panel keeps only the active position equation visible and places its phase, sampling, and reversal explanation directly below it. A separate Display group contains the selected point index, point size, diameter axes, and moving-point connection. The selected index controls both the highlighted red sample and the phase shown in the velocity plot. The construction controls treat both Samples `N` and integer Winding `w` as matched minus-slider-plus steppers.

The historical script initialized per-point offsets and then evaluated `cos(offset + frameTime)`. The clean lesson represents the same idea with the canonical subtraction convention above; reversing the winding reproduces the opposite legacy traversal direction. For harmonic displacement `rho = R*cos(q)`, the signed velocity along the fixed line is `d rho/dt = -R*angularSpeed*sin(q)`. It crosses zero smoothly whenever the point reaches either endpoint. A synchronized plot beside the equation follows this signed line velocity for the highlighted red point over one period: time is horizontal, zero velocity is centered, and negative and positive values indicate the two travel directions. Plotting the magnitude `|d rho/dt|` would fold the negative half-cycle upward and introduce a misleading cusp, so the lesson deliberately does not do that. The selectable `L(q)` comparison preserves the period, range, fixed paths, and average travel speed, but its signed velocity jumps between two constant levels at each endpoint. Open reversal points mark the instants where that velocity is undefined, making the cosine's genuinely smooth reversal directly observable.

### Not Tusi (new paired explanation)

Not Tusi applies the same center, outer radius, phase/time convention, and `N >= 1` range while sampling its directed circle centers over the full circle. Its teaching control restricts winding `w` to integers so the phase field completes whole turns around that sampling circle. Every sample owns one fixed circle centered at `c + (R/2)u(theta_i)` with radius `R/2`; it travels around that circle at uniform angular speed. A circle has no endpoints, so the point neither reverses direction nor slows in and out. Showing the fixed circles beside the moving samples makes the path distinction explicit: Tusi uses diameters and harmonic reversal, whereas Not Tusi uses riding circles and continuous circulation.

This lesson is intentionally identified as `v0bis`. It is a new conceptual counterpart to V0 and does not alter the historical V0, V2, V3, or V4 source labels.

### Parameter Sets (Tusi and historical V3)

Parameter Sets now has a Geometry selector. **Not Tusi** preserves the historical V3 fixed-circle presets, editable carrier/orbit radii and legacy shift. **Tusi** pairs each historical anchor with a close line-geometry counterpart. P1 is hand-tuned to `N=120`, `w=-31`, `R=241`, `A=0.97`, `Δ=-0.01`, and four repeated colors. P2–P4 keep `N`, color grouping, outer extent `R = B + S`, radial extrema, and the indexed radial phase `w ≡ 1 − s (mod N)`. All presets satisfy `A + |Δ| ≤ 1`, so every point remains inside its circle. The results are deliberately close rather than identical: a Tusi point stays on a fixed diameter, whereas a Not Tusi point travels around a local circle. Switching geometry does not overwrite the other family's presets.

Both geometries retain color grouping, the draggable Preset Map, and the comparison between parameter-space and point-space changes. The interpolation cursor moves among four preset anchors. For cursor position `q`, anchor position `a_j`, and inverse-square power `2`, the normalized weight is

```text
d_j = ||q - a_j||
lambda_j = d_j^(-2) / sum_k d_k^(-2)
```

If `q` is exactly on an anchor, that anchor receives weight `1` and every other anchor receives `0`; the clean implementation handles this case explicitly rather than dividing by zero.

The four historical anchors are reproduced at the quarter points of the 600 by 600 selector. Coordinates below are Canvas screen coordinates, with the origin at the top left. `C` is the number of repeating colors.

| Preset | Selector position | `N` | `shift` | `C` | `Rsmall` | `Rbig` |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| P1, top left | `(150, 150)` | 120 | 20 | 6 | 200 | 100 |
| P2, top right | `(450, 150)` | 120 | -5 | 1 | 20 | 200 |
| P3, bottom right | `(450, 450)` | 120 | 169 | 5 | 200 | 100 |
| P4, bottom left | `(150, 450)` | 120 | 179 | 2 | 200 | 100 |

The interpolation cursor starts at `(300, 300)`. The historical source stored `{N: 120, shift: 20, C: 6, Rsmall: 100, Rbig: 200}` with that marker, but did not consistently synchronize those stored values with its initial sliders or animation state. The clean lesson instead evaluates the four anchors immediately. At the center all weights are `0.25`, giving `N = 120`, `shift = 90.75`, `C = 3.5`, `Rsmall = 155`, and `Rbig = 125`. The prototype rounded every blended slider value; at this center position that changes `shift` to `91` and `C` to `4`, while the other three values are already integers.

The historical geometry uses `Rbig` as the distance from the global center to each local circle center and `Rsmall` as the local circle radius:

```text
theta_i = 2*pi*i/N
p_i(t) = center + Rbig*u(theta_i)
                  + Rsmall*u(angularSpeed*t + shift*theta_i)
```

The publication core represents the same geometry with `r1`, `r2`, total outer radius `R`, `orbitRatio`, and the normalized subtraction sign:

```text
r1 = Rbig
r2 = Rsmall
R = Rbig + Rsmall
orbitRatio = Rsmall / (Rbig + Rsmall)
winding = -shift
```

`Rbig` and `Rsmall` are interpolated independently before this conversion. Interpolating `R` and `orbitRatio` separately would produce a different intermediate geometry.

The mode control selects one of two workflows:

1. **Parameter interpolation:** blend `N`, `shift`, `C`, `Rsmall`, and `Rbig` using the map weights, apply the historical slider-value rounding at the configuration boundary, then generate one Not-Tusi model from the blended parameters.
2. **Point interpolation:** sample every anchor at the same animation time, then blend corresponding point positions—and their display colors—with the same map weights. The intermediate point set need not be the sample of one parameter configuration.

All four supplied presets have `N = 120`, so their point order corresponds exactly. If a reader edits or adds a preset with a different `N`, parameter interpolation remains available, but point interpolation reports a clear unequal-count error. The clean core never pads a shorter array with transparent points at the center and never silently resamples it.

### 3D - Tusi (Simple, Complex, Lissajous, and Epicycle geometry)

3D - Tusi uses the `createLineOscillator3D()` experiment bridge and opens in
**Simple** mode. Its metaphor starts with 2-D Tusi: successive diameters turn
inside a fixed circle. In 3-D, the tilted hoop holding that diameter also
turns as the diameters are placed. Three numerical geometry parameters describe
the construction, without direct manipulation:

- **Diameter turns:** turns of the diameter within its hoop.
- **Hoop turns:** turns of the hoop around the sphere's vertical axis.
- **Hoop tilt:** inclination of the hoop, in degrees.

The turns count construction progress across the sample index, not motion
over time. With `theta_i = 2*pi*i/N`, `a = hoopTurns`, `b = diameterTurns`, and
`tau = tiltDegrees*pi/180`:

```text
u_i = Rz(a*theta_i) Rx(tau) Rz(b*theta_i) [1, 0, 0]
```

Every generated diameter is fixed for the animation. Only its ball moves
during playback. The independent **Motion winding W** controls ball timing,
not either construction rotation.

Simple starts with Diameter turns `-1`, Hoop turns `2`, and Hoop tilt `60`
degrees. Both turn counts are integers from `-100` to `100`; tilt ranges from
`0` to `180` degrees in one-degree UI steps. Real-valued tilt is accepted by
the mathematical helper. Integer turns guarantee smooth closure, and the
rotations keep endpoints on the sphere.

At zero tilt, the two turn counts add. With the defaults their sum is `1`,
recovering the full-circle 2-D Tusi arrangement exactly. At 180-degree tilt the
net turn count is `hoopTurns - diameterTurns`. Zero Hoop turns leaves one
fixed tilted plane; zero Diameter turns leaves an equatorial construction
unaffected by tilt. Nonzero counts and intermediate tilt generally create a
non-planar endpoint curve, though special settings may overlap or repeat.
These controls have clear mechanical roles but are not globally orthogonal,
and the bounded three-parameter geometry family does not cover every spherical
curve or guarantee an emergent pattern.

**Complex** preserves the existing `createTusi3D()` geometry. It rotates one
normalized seed about the fixed global X, Y, and Z axes by
`X*theta_i + Bx*sin(theta_i)` and the corresponding Y/Z angles. **Path structure**
holds integer X/Y/Z turns from `-100` to `100`. **Path shape** holds real X/Y/Z
bend amplitudes from `-3` to `3` radians in increments of `0.05`. Each bend adds
one smooth periodic cycle, so changing shape preserves closure of both endpoint
position and tangent. Its geometry controls remain independent of the stored
Simple, Lissajous, and Epicycle settings.

**Lissajous** constructs a planar curve with `X(s) = cos(m*s)` and
`Y(s) = sin(n*s + phi)`, then applies the stereographic lift
`u(s) = [2*X, 2*Y, 1-X^2-Y^2] / (1+X^2+Y^2)`. Both planar amplitudes are fixed
at `1`. Its controls are **Horizontal cycles**, **Vertical cycles**, and
**Curve alignment**. The two cycle counts are integers from `1` to `100`;
alignment ranges from `-180` to `180` degrees in one-degree UI steps, with
real-valued alignment accepted by the mathematical helper. Defaults are `1`,
`2`, and `0` degrees. This `1:2` default gives a spatial curve; `1:1` with zero
alignment recovers the full-circle 2-D Tusi equator exactly.

The denominator is always positive, endpoints remain on the sphere, and integer
cycle counts preserve smooth closure for every allowed alignment. The endpoint
curve is indexed by construction parameter, not time. Curve alignment changes
geometry; Motion winding changes the relative timing of the balls. These two
phase controls must not be conflated. The family is a stereographic lift of
planar Lissajous curves, not the longitude/latitude oscillator construction.
**Epicycle** builds an orthonormal moving frame around an equatorial carrier.
For Carrier turns `a`, Epicycle turns `b`, and Angular radius `eta`:

```text
q(s) = Rz(a*s) [1, 0, 0]
t(s) = Rz(a*s) [0, 1, 0]
u(s) = cos(eta)*q(s)
     + sin(eta)*(cos(b*s)*[0, 0, 1] + sin(b*s)*t(s))
```

Carrier turns transport the local construction around the equator. Epicycle
turns rotate within its local tangent circle, with signed values reversing its
handedness. Angular radius is their constant spherical separation and controls
spatial depth. Defaults are `a = 1`, `b = 2`, and `eta = 35` degrees. The two
turn counts are integers from `-100` to `100`; radius ranges from `0` to `90`
degrees in one-degree UI steps, with real values accepted by the helper. Integer
turns close the curve; common factors may retrace it. With `eta = 0`, `a = 1`
recovers the full-circle 2-D equator. This is a carrier-plus-local-circle
metaphor, not a strict no-slip planar epicycloid.

Epicycle alone also exposes **Destination phase δ**, a real angle from `-180`
to `180` degrees with default `0` and one-degree UI steps. It keeps the origin
at `c - R*u(s)` but selects the destination at `c + R*u(s + δ)`. Zero therefore
pairs antipodes and gives the strict Tusi diameter through the centre. A nonzero
value deliberately relaxes that defining constraint: each ball still follows
one fixed straight line with both extrema on the sphere, but the line is now an
off-centre chord and the result is a comparison rather than strict Tusi. The
whole chord stays inside the sphere. Since the same parameter increment can
span different spherical distances along a non-uniform curve, chord lengths
may vary. This control shifts endpoint pairing along the construction curve;
it does not delay the moving balls and must not be confused with Motion winding
`W`.

None of the four geometry families guarantees a particular emergent pattern,
globally orthogonal controls, or coverage of every spherical curve.

In every geometry mode at its default pairing, `u_i` and its antipode define
the extrema of one stationary diameter through the sphere centre. Epicycle's
optional nonzero Destination phase changes only that mode into stationary
off-centre chords. The separate integer **Motion winding W**, from `-100` to
`100` and initially `1`, controls only relative timing.
Switching Simple/Complex/Lissajous/Epicycle preserves all four sets of geometry controls and all shared
motion, display, count, radius, time, and camera settings. The URL accepts
`geometry=simple|advanced|lissajous|epicycle`; `advanced` is the retained ID for Complex.
For compatibility, the bridge's programmatic
`geometryMode` default remains `advanced`; the public page explicitly selects
`simple`. Simple shape metadata is
`hoopShape: { diameterTurns, hoopTurns, tiltDegrees }`.
`HOOP_SHAPE_DEFAULTS` exposes the defaults, and `hoopDiameterDirection()`
evaluates the shape. Lissajous stores
`lissajousShape: { horizontalCycles, verticalCycles, alignmentDegrees }` and
exports `LISSAJOUS_SHAPE_DEFAULTS` and `lissajousDiameterDirection()`.
Epicycle stores
`epicycleShape: { carrierTurns, epicycleTurns, angularRadiusDegrees, destinationPhaseDegrees }` and
exports `EPICYCLE_SHAPE_DEFAULTS` and `epicycleDiameterDirection()`.
The former `spectralShape` and `harmonicShape` inputs are
rejected, and the core configuration and schema are unchanged. Samples retain
their original uniform parameter order; no arc-length resampling is added. The
Epicycle destination offset is a local geometry-pairing control, not a global
motion-phase control.

**Samples N** ranges from `3` to `1000` balls in integer steps and still starts
at `200`. Every ball has its own fixed straight path; the selected-point index spans
`0` through `N - 1`.

**Movement along line** offers the same radio choices as the 2-D Tusi views:
**Tusi** (default) uses smooth cosine motion, while **Linear** uses the shared
triangular wave `L(psi) = 1 - (2/pi) acos(cos(psi))`. Linear motion has constant
speed between endpoints and reverses instantaneously; it is a comparison law,
not the harmonic Tusi law. Both modes preserve the fixed paths, extrema,
period, and phase offsets. Switching modes updates the single equation without
resetting time, camera, radius, colors, or the geometry preset. The `motion`
URL parameter retains the chosen profile. The mathematical core remains harmonic.

In Complex mode only, four radio presets expose geometry in increasing complexity: G1 **Planar ring**
`(0, 0, 1)`, G2 **Two-axis loop** `(1, 0, 2)`, G3 **Three-axis weave**
`(1, 2, 3)`, and G4 **Dense weave** `(2, 3, 5)`. They restore the three
integer turns and zero bends. Manual turns or bend edits clear the preset. Simple
hoop, Lissajous, and Epicycle settings are preserved. Samples `N`, radius, time,
camera, point size, repeated colors, path visibility, motion profile, and motion winding are
preserved when a preset is selected. **Repeated colors**, under Display, uses
the same 1–20 indexed color cycle as 3D - Not Tusi, starting with two colors
(red and green). Sample `i` keeps palette entry `i % C` throughout its motion;
the selected-dot highlight temporarily overrides that color. Optional
reference-sphere and cyan/pink endpoint curves make the endpoint pairing
explicit. Coloring is a presentation choice and does not alter the core model.

Changing **Radius R** scales the sphere, endpoint paths, fixed lines, and
ball displacement together without moving or zooming the camera. The initial
view is fitted once; later radius edits remain visibly comparable at that scale.

### 3D - Not Tusi (historical V4)

3D - Not Tusi retains the historical V4 prototype's distinctive geometry: `N` centers lie on a carrier
ring, a compact selector beside the equation chooses an upper-hemisphere seed,
and rotated copies of that seed are placed around the ring. Controls expose independent integer X,
Y, and Z winding from `-100` to `100`, and each Euler axis can be animated independently.
Point size defaults to `10` and ranges up to `30`. Repeated color groups make sample order visible. The view draws complete motion paths
for up to 96 evenly distributed samples while retaining all animated points;
this keeps dense sets up to `N = 200` readable and responsive. One animated
Euler axis produces a true 3-D circle (seen as an ellipse under perspective),
while multiple animated axes generally produce a closed non-planar curve.

The 3D - Not Tusi control panel exposes the five selected historical configurations as
radio choices named **Crossed loops**, **Coiled braid**, **Red rosette**,
**Interlaced ribbons**, and **Twin rings**. Selecting one updates radii, sample
count, angular speed, animated axes, color grouping, and the supplied RGB
palette. Because the shared winding control was removed,
each legacy `phaseXYZ + phaseAxis` is converted to the sign-correct equivalent
independent winding modulo `N`. This preserves every sampled position within the
current `-100…100` controls. Seed position, point size, and path visibility remain
the reader's current display choices because they were not encoded by the list.
On initial page load only, Red rosette starts with its motion paths hidden to
keep the single-color shape legible. Changing presets afterward preserves the
reader's path-visibility choice, which can be changed at any time under Display.
All five presets restore their historical front composition: the camera looks
from positive Z toward the carrier center with positive Y pointing upward.
The experiment opens with **Red rosette** selected and its motion paths hidden.

The lesson uses a small DOM-independent `createV4CarrierRingModel()` factory
with the same `{ kind, dimension, config, paths, sample(time) }` interface as the
paper models. Desktop WebGL and orbit controls are the baseline. Optional WebXR remains available on the main
3-D paper pages; **3D - Not Tusi** omits the prototype's unfinished controller and headset
parameter plumbing.

## Prototype defects intentionally not copied

The historical folders remain useful records of exploration, but the following implementation details are intentionally absent from the clean lessons:

- Implicit globals, duplicated state, debug logging, frame-rate overlays, mouse decorations, and control labels that are not synchronized with startup values.
- V1's malformed `rgba(...)` strings, mismatched page title, and undocumented conversion that treated polar values as screen Cartesian coordinates.
- V2's Tusi/Not-Tusi naming contradiction and its disabled third canvas.
- V3's unused files containing duplicate class constructors, undeclared interpolation variables, mutation of source presets during drawing, inverse-distance singularities, and silent padding of incompatible point arrays. Its preset map, four supplied anchors, editable preset controls, and two interpolation workflows are retained without those defects.
- V4's monolithic mutable scene state, legacy or duplicate Three.js builds, custom font/text assets, always-present XR entry, controller-specific parameter manipulation, and per-change replacement of point meshes.

The cleaned sequence omits prototype-only statistics and debugging widgets that do not explain the mathematical construction. The V3 preset-exploration controls are not omitted: they are part of Parameter Sets' explanation of multi-anchor interpolation. Readers who need incidental historical bugs can run the untouched source folders separately; publication results should use the clean routes and versioned configurations.

## Where to continue

After **3D - Not Tusi**, return to the main launcher to revisit any of the six public experiments. The five author-facing model examples and named manuscript presets remain available only in the source repository. See [`MATH.md`](MATH.md) for the full equation-to-code map, [`API.md`](API.md) for the public functions, and [`PRESETS.md`](PRESETS.md) for the reproducible paper states.

The standalone [`examples/interpolation/`](../examples/interpolation/) page in that section is intentionally simpler than Parameter Sets. It demonstrates the reusable pairwise API with endpoints A and B and a scalar `alpha`; Parameter Sets demonstrates the historical four-anchor inverse-distance map. Both pages show parameter-space and point-space interpolation, but they answer different reuse and teaching needs.
