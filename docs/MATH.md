# Mathematics and code conventions

> Scope of this technical document: it includes retained software models, historical identifiers, and exploratory extensions. The revised paper uses a carrier-ring spatial Not-Tusi construction and does not develop interpolation methods. See [Manuscript alignment](MANUSCRIPT_ALIGNMENT.md) for the current paper scope. Legacy equation numbers and D/G presets are not current manuscript references.

This document records the mathematics of the software API, including retained legacy formulations. Its equation numbers are historical software documentation. The public carrier-ring spatial Not-Tusi construction and the scope of the revised paper are described in MANUSCRIPT_ALIGNMENT.md; the Fibonacci-sphere model below is a separate software extension.

## One phase convention

Angles are in radians unless a field explicitly specifies degrees, such as the experiment's `hoopShape.tiltDegrees`, `lissajousShape.alignmentDegrees`, `epicycleShape.angularRadiusDegrees`, or `epicycleShape.destinationPhaseDegrees`. `time` and `angularSpeed` may use any compatible units. For point `i`, the implementation starts from:

```text
motionPhase_i = angularSpeed * time - phase_i
```

This normalized value is exposed as `motionPhase` by every point record. For
Not-Tusi circulation modes, a separate path angle preserves the same phase
assignment while changing only the time direction:

```text
traversalPhase_i = circulation_i * angularSpeed * time - phase_i
```

Here `circulation_i` is `+1` or `-1`; Tusi points expose
`traversalPhase = motionPhase`. The path and phase field remain fixed.

The manuscript's 2-D equations already use `time - phase_i`. Equation 3 in the current 3-D draft is printed with `cos(omega * time + delta_k)`. Wherever that draft formula is compared with the release, it must instead be read with the normalized sign:

```text
p_k(time) = R * cos(omega * time - delta_k) * u_k
```

The corrected 3-D Tusi implementation substitutes `phase_i = W*s_i` in that same minus-sign form. The Tusi part of the manuscript's Equation 6 should likewise use the minus sign. Equation 5 and the Not-Tusi radius law already use it.

## Coordinates and samples

Mathematical 2-D coordinates are Cartesian with positive y upward. `Canvas2DRenderer` performs the only y inversion, when it maps a point to screen pixels.

For `N = pointCount` and indices `i = 0, ..., N - 1`:

```text
full-circle: theta_i = 2 * pi * i / N
half-circle: theta_i =     pi * i / N
```

The half-circle form excludes the duplicate endpoint at `pi`. It therefore describes each undirected diameter once.

3-D Tusi uses the same full-circle parameter order as its 2-D source:

```text
s_i = 2 * pi * i / N
```

The 3-D Not-Tusi model separately uses a deterministic, half-offset Fibonacci
sphere. With `g = pi * (3 - sqrt(5))`:

```text
z_k         = 1 - 2 * (k + 0.5) / N
longitude_k = g * k
colatitude_k = acos(z_k)
r_k         = sqrt(1 - z_k * z_k)
u_k         = [r_k*cos(longitude_k), r_k*sin(longitude_k), z_k]
```

`longitude_k` is deliberately left unwrapped. Wrapping would not change `u_k`, but the unwrapped value keeps the phase field continuous in sample order. Coordinates are right-handed and z-up.

## 2-D Tusi: fixed diameters

Let `c` be the centre, `R` the radius, and:

```text
u_i = [cos(theta_i), sin(theta_i)]
phase_i = winding * theta_i
q_i = angularSpeed * time - phase_i
```

Then:

```text
signedRadius_i = R * cos(q_i)
p_i = c + signedRadius_i * u_i
```

Each path descriptor is the diameter through `c` in direction `u_i`. Changing winding changes only the temporal phase. It never rotates or rebuilds the diameter.

Important special cases are:

- `winding = 0`: every point moves in and out synchronously.
- `winding = 1`: the samples lie on a circle of radius `R/2` whose centre revolves at radius `R/2`.
- Integer winding `w`: the continuous polar form is `r = R*cos(angularSpeed*time - w*theta)`.
- With full-circle sampling, `w` and `w + N` are identical sample by sample. This is the winding alias used in T4.

## 2-D Not-Tusi: fixed riding circles

`orbitRatio` splits the outer radius into placement and riding-circle radii:

```text
r2 = orbitRatio * R
r1 = R - r2
```

The fixed path for point `i` is a circle of radius `r2` centred at `c + r1*u_i`. With forward circulation:

```text
phase_i = winding * theta_i
q_i = angularSpeed * time - phase_i
p_i = c + r1*u_i + r2*[cos(q_i), sin(q_i)]
```

At the paper value `orbitRatio = 0.5`, `r1 = r2 = R/2`; every riding circle passes through the display centre and the outer rim. At `winding = 1`, changing the split opens the sweeping line into an ellipse with semi-axes:

```text
r1 + r2 = R
abs(r1 - r2)
```

`circulation: "reverse"` traverses every circle in the opposite sense. `circulation: "alternating"` gives even and odd samples opposite senses, producing the counter-rotating demonstrations while leaving every circle unchanged.

## 3-D Not-Tusi phase field

For every 3-D Not-Tusi Fibonacci sample, the scalar phase is:

```text
delta_k = twist * longitude_k
        + pitch * colatitude_k
        + height * z_k
```

This is stored as:

```js
phase: { twist, pitch, height }
```

The code uses the word `height` for the manuscript coefficient `h`. Varying any of these three values changes Not-Tusi timing only. The Fibonacci directions and their fixed circular paths do not move.

## Deterministic circle planes in 3-D

A 3-D Not-Tusi circle needs a second unit vector perpendicular to `u_k`. Write longitude as `lambda` and colatitude as `vartheta`. The exported `sphereTangentBasis()` uses:

```text
meridian tangent  = [ cos(vartheta)*cos(lambda),
                      cos(vartheta)*sin(lambda),
                     -sin(vartheta) ]

azimuthal tangent = [-sin(lambda), cos(lambda), 0]

normal            = normalize(radial x tangent)
```

The meridian tangent points toward increasing colatitude; the azimuthal tangent points toward increasing longitude. The half-offset Fibonacci samples never land exactly on a pole. For an arbitrary axial input, `atan2(0, 0)` supplies the deterministic longitude zero used by the helper.

## 3-D Tusi: endpoint path and fixed straight lines

The public experiment supplies three closed direction families through
`createLineOscillator3D()`. The page defaults to **Simple**; the bridge defaults
to `geometryMode: "advanced"` for compatibility with existing callers. The core
`createTusi3D()` factory and canonical schema retain the Euler family labelled
**Complex** in the public interface. All four geometries use the full-circle
parameter `s_i = 2*pi*i/N`, followed by the
same independent motion law.

### Simple: a diameter inside a turning hoop

In 2-D, successive diameters turn within one fixed circle. The Simple 3-D
construction also turns the tilted hoop that holds the diameter. Let `a` be
Hoop turns, `b` Diameter turns, and `tau` Hoop tilt in radians:

```text
tau = tiltDegrees*pi/180
u(s) = Rz(a*s) Rx(tau) Rz(b*s) [1, 0, 0]
```

Apply the rightmost rotation first: turn the diameter inside its hoop, tilt
the hoop about X, then turn the hoop about the fixed vertical Z axis. The
parameter `s = 2*pi*i/N` indexes the construction, not elapsed animation time.
The generated diameters are frozen after construction. During playback only
the balls move along them; neither the hoop nor the diameters rotate in time.

The bridge exports `HOOP_SHAPE_DEFAULTS` and `hoopDiameterDirection()` and
stores its Simple geometry as:

```js
hoopShape: {
  diameterTurns: -1,
  hoopTurns: 2,
  tiltDegrees: 60,
}
```

Both turn counts are integers from `-100` to `100`. Tilt ranges from `0` to
`180` degrees in one-degree UI steps; the helper accepts real-valued tilt
within the same range. This field uses degrees; rotations convert it to
radians internally. The former `spectralShape` and `harmonicShape` inputs are
rejected rather than silently reinterpreted. The core configuration and schema
are unaffected.

All rotations preserve unit length. Integer turn counts make the direction
and all its derivatives repeat at `s = 0` and `2*pi`, so the endpoint curve
closes smoothly for any allowed real tilt. Each diameter pairs `+R*u(s)` with
`-R*u(s)` relative to the common centre. Useful limiting cases are:

- At zero tilt, `u(s) = [cos((a+b)*s), sin((a+b)*s), 0]`. The default turns
  satisfy `a+b = 1`, recovering the full-circle 2-D Tusi directions exactly.
- At 180-degree tilt, the net planar turn count is `a-b`.
- With zero Hoop turns, the diameters stay in one fixed tilted plane.
- With zero Diameter turns, the direction is `[cos(a*s), sin(a*s), 0]`, so
  tilt has no effect.

Nonzero turn counts and intermediate tilt generally produce a non-planar
endpoint curve, but special settings may coincide or repeat. The controls
describe distinct mechanical operations, not globally orthogonal geometric
effects: at zero tilt the two counts combine into their sum. This three-value
geometry family is suitable for parameter-set exploration, not a universal
parameterization of spherical curves or a guarantee of emergent patterns.
Motion winding remains a fourth, separate timing parameter. No extra temporal
phase, direct manipulation, or moving-path mechanism is introduced.

### Complex: integer Euler turns and periodic bends

Let `u_0` be a normalized non-zero seed, `g_x, g_y, g_z` integer turns, and
`b_x, b_y, b_z` finite real bend amplitudes in radians. For every full-circle
parameter `s_i`, evaluate the orientation absolutely about the fixed global axes:

```text
alpha_i = g_x*s_i + b_x*sin(s_i)
beta_i  = g_y*s_i + b_y*sin(s_i)
gamma_i = g_z*s_i + b_z*sin(s_i)
u_i = Rz(gamma_i) Ry(beta_i) Rx(alpha_i) u_0
```

The implementation applies X, then Y, then Z; it does not repeatedly multiply
one composite rotation from the preceding sample. Each rotation is orthogonal,
so `u_i` remains a unit vector. Over `s = 0` to `2*pi`, each angle changes by an
integer number of turns, while `sin(s)` and all its derivatives repeat. Thus
the endpoint path closes smoothly for any finite real bends. Zero bends
recover the original integer-turn construction exactly. Multiple axes allow
non-planar paths, although closure does not exclude self-intersections or
stationary points. Discrete endpoint guides remain polygonal approximations;
N still controls how finely the endpoint curve is sampled.

For each angle `g*s + b*sin(s)`, `g` fixes the total angle advance `2*pi*g`,
whereas `b` changes its local rate `g + b*cos(s)`. They are independent controls,
not an integer and fractional part of one winding. These Euler turn counts
guarantee closure but are not intrinsic topological winding numbers of a curve
on a sphere.

### Lissajous: a stereographic lift of a planar curve

Two planar oscillations define one ordered endpoint curve. For integer
Horizontal cycles `m`, integer Vertical cycles `n`, and Curve alignment `phi`:

```text
phi = alignmentDegrees*pi/180
X(s) = cos(m*s)
Y(s) = sin(n*s + phi)
d(s) = 1 + X(s)^2 + Y(s)^2
u(s) = [2*X(s), 2*Y(s), 1-X(s)^2-Y(s)^2] / d(s)
```

This is a stereographic lift of a planar Lissajous curve, not the distinct
construction that directly oscillates longitude and latitude. Both planar
amplitudes are fixed at `1`. The denominator is at least `1`, so no singular
normalization is required. The identity
`4*X^2 + 4*Y^2 + (1-X^2-Y^2)^2 = (1+X^2+Y^2)^2` ensures unit directions.
Integer cycles make the curve and all its derivatives periodic over `2*pi`,
including for real-valued alignment.

The bridge exports `LISSAJOUS_SHAPE_DEFAULTS` and
`lissajousDiameterDirection()` and selects this construction with
`geometryMode: "lissajous"`. Its shape metadata and defaults are:

```js
lissajousShape: {
  horizontalCycles: 1,
  verticalCycles: 2,
  alignmentDegrees: 0,
}
```

Both cycle counts range from `1` to `100` in integer steps. Alignment ranges
from `-180` to `180` degrees in one-degree UI steps; the helper accepts finite
real values within that range. The default `1:2` shape is spatial. Setting
`m = n = 1` and `phi = 0` gives `X = cos(s)`, `Y = sin(s)`, and hence the
equator `u(s) = [cos(s), sin(s), 0]`, recovering full-circle 2-D Tusi.

Curve alignment changes fixed directions, whereas Motion winding changes only
ball timing. These are separate phases. The three geometry controls define a
restricted family, not all spherical curves or globally independent perceptual
effects. Common factors, crossings, repeated diameters, and finite-sample aliases
can produce redundancy; no automatic coprime reduction or arc-length resampling
changes the requested parameterization.

### Epicycle: a local circle transported around the equator

Epicycle starts from a carrier direction on the equator and a perpendicular
tangent frame. Let `a` be Carrier turns, `b` Epicycle turns, and `eta` the
constant Angular radius in radians:

```text
eta = angularRadiusDegrees*pi/180
q(s) = Rz(a*s) [1, 0, 0]
t(s) = Rz(a*s) [0, 1, 0]
u(s) = cos(eta)*q(s)
     + sin(eta)*(cos(b*s)*[0, 0, 1] + sin(b*s)*t(s))
```

The orthonormal frame `q(s)`, `t(s)`, `[0, 0, 1]` makes `u(s)` a unit vector.
Carrier turns transport the centre of the local construction around the
equator; Epicycle turns rotate within its local tangent circle; Angular radius
sets the constant spherical distance from the carrier and therefore its spatial
depth. The result supplies endpoint directions for fixed diameters. Nothing in
this construction rotates during playback.

The bridge exports `EPICYCLE_SHAPE_DEFAULTS` and
`epicycleDiameterDirection()` and selects the construction with
`geometryMode: "epicycle"`. Its shape metadata and defaults are:

```js
epicycleShape: {
  carrierTurns: 1,
  epicycleTurns: 2,
  angularRadiusDegrees: 35,
  destinationPhaseDegrees: 0,
}
```

Both turn counts are integers from `-100` to `100`. Angular radius ranges from
`0` to `90` degrees in one-degree UI steps; the helper accepts finite real
values within that range. Integer turns close the direction curve smoothly.
The sign of `b` changes the local handedness, while common factors of `a` and
`b` can retrace the same geometry. At zero angular radius, the local term
vanishes; with `a = 1` this is exactly the full-circle 2-D equator.

Destination phase `delta` optionally changes how two samples of that same
closed endpoint curve are paired:

```text
delta = destinationPhaseDegrees*pi/180
start(s) = c - R*u(s)
end(s)   = c + R*u(s + delta)
midpoint(s) = c + (R/2)*(u(s + delta) - u(s))
length(s) = R*length(u(s + delta) + u(s))
```

It accepts finite real values from `-180` to `180` degrees and defaults to
zero; the UI advances it in one-degree steps. At `delta = 0`, the endpoints
are antipodal, the path is a diameter through `c`, and this is strict Tusi.
At nonzero `delta`, the destination advances along the same endpoint curve
while the origin does not. The result is a fixed off-centre spherical chord,
not a diameter and therefore not strict Tusi. Its endpoints remain on the
sphere, and the complete straight segment remains inside the sphere by
convexity. Because equal parameter shifts need not have equal spherical arc
length, different samples may produce chords of different lengths. The midpoint
and length formulas above make both changes explicit. Destination
phase is a geometry-pairing control; it is unrelated to Motion winding `w` and
does not animate either endpoint curve.

“Epicycle” describes the carrier-plus-local-circle parameter metaphor. It is
not a strict planar, no-slip epicycloid construction. As with the other modes,
these three values define a restricted spherical curve family rather than a
universal parameterization.

### Shared fixed paths and motion

Normally each `u_i` defines the two antipodal extrema of one stationary diameter:

```text
endpointMinus_i = c - R*u_i
endpointPlus_i  = c + R*u_i
```

Epicycle with nonzero Destination phase generalizes this to one stationary
straight chord. Let `a_i` and `b_i` denote its fixed start and end:

```text
a_i = c - R*u(s_i)
b_i = c + R*u(s_i + delta)
```

Motion has a separate integer winding `w`. With
`q_i = angularSpeed*time - w*s_i`:

```text
h_i = cos(q_i)
p_i = ((1-h_i)/2)*a_i + ((1+h_i)/2)*b_i
```

For a centred diameter this reduces exactly to
`p_i = c + R*cos(q_i)*u_i`. Every velocity is collinear with its own fixed
straight path, and every moving point reverses harmonically at its two fixed
endpoints. For the strict centred case, the distance from the centre is:

```text
length(p_i - c) = R * abs(cos(q_i))
```

The public **Linear** comparison replaces `cos(q_i)` with the triangular wave
`L(q_i) = 1 - (2/pi)*acos(cos(q_i))`. It preserves the fixed line, extrema, period,
and phase, but travels at constant speed and reverses abruptly. The core Tusi
model remains harmonic. Changing geometry mode preserves all four geometry-control
sets; changing motion law or `w` never changes the current fixed directions.

### Pattern organization and sampling

In harmonic mode, write each fixed line as midpoint `m_i = (a_i+b_i)/2` and
half-vector `d_i = (b_i-a_i)/2`, and stack the point coordinates into `P(t)`.
Then:

```text
P(t) = M + cos(angularSpeed*t)*A + sin(angularSpeed*t)*B
M_i = m_i
A_i = cos(w*s_i)*d_i
B_i = sin(w*s_i)*d_i
```

For centred diameters `M = c`, relative coordinates recover the former
two-state form with `d_i = R*u_i`. Thus endpoint complexity does not introduce independent temporal frequencies:
the whole configuration combines two quadrature states. In a Fourier expansion
of `u(s)`, multiplication by `cos(angularSpeed*t - w*s)` mixes each spatial
frequency `j` into `j-w` and `j+w`. Low-order geometry and motion relationships
are useful search directions, not a guarantee of a perceptually coherent form.
The Simple hoop coordinates combine spatial frequencies `a+b`, `a-b`, and
`b`; the Complex rotation composition with periodic bends, the Lissajous
stereographic denominator, and the transported Epicycle frame can introduce
further spatial harmonics. The triangular comparison has additional temporal harmonics
and does not obey the two-state identity above.

With Destination phase zero, antipodal endpoints are paired explicitly as
`+u_i` and `-u_i`; this does not mean every sampled diameter is unique. If a geometry satisfies
`u(s + pi) = -u(s)`, then even `N` and odd `w` make the paired samples occupy
identical moving positions. The Simple zero-tilt equator with odd `a+b` has
this symmetry. So do the default even `a = 2` and odd `b = -1` at every tilt:
with `N = 200` and `w = 1`, opposing sample pairs coincide. General hoop
settings need not have that symmetry. Other symmetric settings can also
duplicate diameters, and dense families can alias at finite `N`. Repeated colors depend on index and can
emphasize different subsets of samples, but never change geometry or motion.
Sampling is uniform in `s`, not in spherical arc length; resampling and
assigning phase by arc length would define a different experiment.

## 3-D Not-Tusi: sphere of circles

Use the same radius split as in 2-D and let `v_k` be the configured meridian or azimuthal tangent:

```text
r2 = orbitRatio * R
r1 = R - r2
q_k = angularSpeed*time - delta_k
p_k = c + (r1 + r2*cos(q_k))*u_k + r2*sin(q_k)*v_k
```

The fixed circle has centre `c + r1*u_k`, radius `r2`, and plane spanned by `u_k` and `v_k`. Its numerical residual is checked as:

```text
abs(length(p_k - (c + r1*u_k)) - r2)
```

The test tolerance is below `1e-12`. For the paper split `r1 = r2 = R/2`, each circle passes through `c` and `c + R*u_k`, and:

```text
length(p_k - c) = R * abs(cos(q_k / 2))
```

For a general split, the corresponding radius law is:

```text
sqrt(r1*r1 + r2*r2 + 2*r1*r2*cos(q_k))
```

## What phase is allowed to change

The implementation separates geometry from timing:

- 3-D Tusi paths are created once from centre, radius, full-circle parameter order, and the selected geometry: diameter turns, hoop turns, and hoop tilt in Simple; seed, three integer turns, and real bend amplitudes in Complex/core; two integer cycle counts and real curve alignment in Lissajous; or carrier turns, epicycle turns, angular radius, and optional destination pairing phase in Epicycle.
- Other paths are created once from centre, radius, sampling, orbit ratio, and circle plane as applicable.
- `phase` assigns a scalar delay to each already-created path. For 3-D Tusi this is the independent motion winding, not an orientation control. Epicycle Destination phase is instead part of fixed-path geometry: it pairs the origin at `s` with the destination at `s+delta`.
- `sample(time)` evaluates positions on those paths without rebuilding them.
- Animation and visualization settings do not enter the equations.

This separation is the central reproducibility invariant: configurations with the same geometry and different phase parameters have identical path descriptors.
