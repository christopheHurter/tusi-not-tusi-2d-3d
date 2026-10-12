# From 2-D Tusi to 3-D: exploration record

> Scope of this technical document: it includes retained software models, historical identifiers, and exploratory extensions. The revised paper uses a carrier-ring spatial Not-Tusi construction and does not develop interpolation methods. See [Manuscript alignment](MANUSCRIPT_ALIGNMENT.md) for the current paper scope. Legacy equation numbers and D/G presets are not current manuscript references.

Date: 2026-09-03

This internal working note summarizes the attempts made in our design discussion and provides a comparison framework for future parameter-set exploration. It is not part of the public publication package. The application and release archive are unchanged by this note.

The current implementations were checked against `examples/pedagogy/pedagogy-models.js`, `examples/pedagogy/pedagogy-page.js`, `src/core/models.js`, and the mathematical notes. Earlier, replaced versions are reconstructed from the conversation; they are not all retained as runnable snapshots. In particular, the brief planar intermediate is described conceptually rather than assigned an unverified historical formula.

## 1. What must remain Tusi?

The common harmonic motion is:

```text
p_i(t) = c + R*cos(omega*t - delta_i)*u_i
```

- `u_i` is a fixed unit direction. It must not depend on playback time.
- Each ball stays on the diameter joining the antipodal endpoints `c - R*u_i` and `c + R*u_i`.
- Geometry determines the directions; phase `delta_i` determines the relative timing.
- In the ordered-curve constructions, `theta_i = 2*pi*i/N` indexes the diameters, and `delta_i = W*theta_i`. This construction parameter is not time.
- The Linear option keeps the fixed diameters but replaces cosine by a triangular wave. It is a useful comparison, not the harmonic Tusi law itself.

Most rejected attempts respected this motion. Their shortcomings concerned the desired construction, closure, expressive range, or understandable controls—not whether individual balls moved along lines.

## 2. Retrospective comparison

Main controls below exclude shared sample count, radius, speed, camera, and display settings. `W` means the separate motion winding. Parameter counts describe the exposed construction, not a proof of independent geometric degrees of freedom.

| Attempt | Construction and main controls | What it achieved | Limitation or reason for moving on | Status |
| --- | --- | --- | --- | --- |
| 1. Fibonacci sphere of diameters | Distribute fixed diameters over the sphere; use Twist, Pitch, and Height to arrange their timing. | Genuine spatial line motion and broad directional sampling, with a simple phase field. | The geometry was predetermined. It did not provide the ordered circle-to-sphere construction wanted for the 2-D metaphor. Covering the sphere is not the same as covering possible designs. | First implementation; superseded in public 3-D Tusi. |
| 2. Tusi inside a single tilted plane | Embed the 2-D diameter fan in one plane in 3-D; vary its orientation and motion winding. | Very direct relation to 2-D; an understandable reference case. | All diameters still shared a plane through the centre. Changing the view or plane orientation did not add intrinsic spatial complexity. | Intermediate trial; superseded. |
| 3. Integer XYZ endpoint rotations | Rotate a fixed seed with three integer turn counts as the sample index advances; animate balls separately with `W`. | Closed, generally non-planar endpoint arrangements with relatively few parameters. | Sequential rotations interact; axis controls do not correspond to globally independent shape features. | Retained as the zero-bend case of Advanced. |
| 4. Real-valued XYZ winding | Allow fractional rather than integer turn counts in the same endpoint construction. | Continuous adjustment of the turn values. | The last and first endpoint directions generally no longer match. A connected display can hide the gap with an artificial closing segment. Individual balls still have valid fixed-line motion. | Tried and replaced; closure was not guaranteed. |
| 5. Integer turns plus real periodic bends | Three integer turns and three continuous bend strengths, with angles `g*theta + B*sin(theta)`; separate `W`. | Combines guaranteed smooth closure with continuous deformation and a richer parameter set. | Six interacting geometry controls are harder to explain and search; neither global orthogonality nor universal coverage follows from their number. | **Current Advanced.** |
| 6. One depth wave | Lift a reference circle with one vertical wave; control depth and wave count/mix, plus `W`. Fractional mix blended neighboring integer waves. | A compact closed family and an easy flat limit. | One prescribed out-of-plane deformation offered too little design freedom. | Former Simple; replaced. |
| 7. XYZ bends with linked wave mixes | Rotate an equator using three bend strengths and wave mixes `q`, `q+1`, `q+2`; separate `W`. | More varied shapes while retaining closure and four geometry controls. | Frequency relationships were imposed; X and Y could both alter depth. Distinct slider names did not imply independent meanings. | Former Simple; replaced. |
| 8. Direct spherical-curve editing | Move control points on a closed endpoint curve and generate antipodal partners. | Potentially expandable freedom without a fixed small generator. | Wrong interaction model: the requirement was understandable numerical parameter sets for later AI search, not drawing or dragging a curve. | **Discussed and rejected; not implemented.** |
| 9. Longitude/elevation wave profiles | Independent sine/cosine profiles for longitude and an elevation ratio, plus turns and offset; `4K+2` geometry values at fixed `K`, plus `W`. | Explicit AI-friendly vectors, guaranteed closure, and locally perpendicular longitude/elevation changes. | The component interface lost the Tusi metaphor and grew in size. Profile-basis independence did not guarantee independent perceived effects; finite limits still restricted coverage. | Former Simple; implemented, then retired. |
| 10. Diameter inside a turning hoop | Diameter turns, Hoop turns, Hoop tilt, and separate Motion winding. | A mechanical extension of the 2-D construction with only three geometry controls. Integer turns close the curve; a clear setting recovers 2-D. | A restricted family. Controls become redundant at special settings, notably zero tilt. Its useful expressiveness still needs systematic comparison with Advanced. | **Current Simple.** |

The important progression was from “put line oscillators in 3-D” to “find a compact, understandable rule for arranging their fixed diameters.” We have not established that any one family is universally expressive or globally orthogonal.

## 3. Current comparison baseline

### Simple: turning hoop

```text
u(theta) = Rz(a*theta) Rx(tau) Rz(b*theta) [1, 0, 0]
a = Hoop turns
b = Diameter turns
tau = Hoop tilt in radians
```

The rightmost operation turns the diameter within its hoop. The middle operation tilts the hoop, and the outer operation turns it about the vertical axis while placing successive samples. None of these rotations occurs over playback time.

Current defaults are `b = -1`, `a = 2`, `tilt = 60 degrees`, and `W = 1`. Both turn counts and `W` range from `-100` to `100`; tilt ranges from `0` to `180` degrees.

- At zero tilt, only `a+b` matters. The defaults have `a+b=1`, giving the standard indexed full-circle 2-D directions exactly.
- At 180 degrees, the net planar turn count is `a-b`.
- With `a=0`, the diameter family stays in a fixed tilted plane.
- With `b=0`, tilt has no effect: the construction is equatorial.
- The default even `a=2` and odd `b=-1` give `u(theta+pi)=-u(theta)`. At even `N=200` and odd `W=1`, there are 100 coincident pairs of moving samples. This is valid full-circle redundancy and must not be counted as 200 distinct moving positions in an AI comparison.

### Advanced: XYZ turns and bends

```text
u(theta) = Rz(Z*theta + Bz*sin(theta))
           Ry(Y*theta + By*sin(theta))
           Rx(X*theta + Bx*sin(theta)) u0
```

There are three integer geometry turns, three real bends, a fixed seed, and the separate motion winding. The four G presets are retained. This is a useful alternative reference family, but it has not been proved to contain every Simple shape or to generate more perceptually distinct patterns under an equal search budget.

## 4. Candidate next options — not implemented

These are hypotheses to compare, not promises of improved expressiveness.

| Option | Parameter metaphor | What it would explore | Main question or risk |
| --- | --- | --- | --- |
| Search the current two families first | Existing Simple and Advanced parameter sets. | Establish actual pattern diversity before adding parameters. | Are the missing forms truly unavailable, or have we simply not found their settings? |
| Rocking hoop | Add a rocking angle and an integer number of rocks per construction loop, for example `tau(theta)=tau0+B*sin(k*theta)`. | Continuous variation in the hoop's inclination while retaining a mechanical metaphor and closed construction. | Does this add genuinely new forms beyond constant tilt, rather than mostly distorted duplicates? The hoop would still be frozen for each sample during playback. |
| Nested hoops | Add another explicitly described hoop, with its own turns and inclination. | A broader sequence of spatial construction rotations. | Does the gain in variety justify the extra controls and new redundant settings? |
| Richer phase on the same geometry | Add a periodic timing variation to `delta(theta)=W*theta`, with a strength and repeat count. | New collective motion without changing any fixed diameter. | Are perceived limitations due to geometry or to the current simple phase arrangement? |
| A small catalogue of parameterized constructions | AI chooses a family, then its compact parameter vector. | Broader coverage through several understandable mechanisms instead of one universal control panel. | Can families be compared and deduplicated fairly while retaining a shared Tusi interpretation? |

Adding a global camera rotation, a uniform time shift, or an overall scale is not evidence of new intrinsic geometry. Additional starting-angle controls should also be checked for equivalence to rotation and reindexing before being counted as extra expressive power.

## 5. Evaluation sheet for every future proposal

| Criterion | Test or question | Why it matters |
| --- | --- | --- |
| Tusi motion | Are all directions fixed in time, all paths diameters, and all harmonic trajectories collinear with those diameters? | Non-negotiable identity of the experiment. Rotating each path during playback would be a different model. |
| Closure | Do endpoint positions and tangents match at the construction seam? Does the phase field close consistently? | Prevents an artificial join from being mistaken for a smooth construction. |
| Genuine spatial geometry | Do the diameter directions span three dimensions rather than one plane through the centre? | A rotated planar Tusi is still intrinsically planar. Use the rank of the uncentred unit-direction matrix; an offset latitude circle alone is not proof of planar diameters. |
| Exact 2-D limit | Is there a documented setting that recovers the same indexed 2-D directions and timing? | Gives the intended metaphor a reproducible reference. Merely looking flat is weaker. |
| Understandable controls | Can each parameter be explained using a diameter, hoop, angle, or relative timing? | Preserves interpretability for both manual selection and interpretation of AI results. |
| Nonredundant effects | Can a change be reproduced by another parameter, a rotation, scaling, time shift, or reindexing? | Exposes degeneracies and prevents inflated claims of design-space size. |
| Useful diversity | How many meaningfully different animations are found with the same search budget and parameter bounds? | More sliders, higher frequencies, or more occupied sphere area do not establish better design coverage. |
| AI suitability | Are bounds and discrete choices explicit, evaluation deterministic, invalid states prevented, and duplicates detectable? | Makes parameter search reproducible and efficient. |
| Rendering cost | Does the candidate remain responsive at the same sample counts? | Ensures any diversity gain is practical to explore. |

For fair trials, hold sample count, radius, motion law, playback speed, palette, point size, camera, and capture times constant. Compare complete cycles and several views, not only one frame. Geometry comparisons should first hold timing fixed; timing comparisons should hold geometry fixed. Account for coincident samples and finite-sampling aliases. Do not silently switch to arc-length sampling, since that changes the phase-to-geometry correspondence.

Suggested result columns for an AI experiment log are: `family`, `parameter set`, `search seed/budget`, `Tusi validity`, `closure residual`, `spatial rank`, `unique sample count`, `duplicate-animation group`, `render cost`, and `human assessment of the emerging pattern`.

## Working conclusion

The current hoop model is our clearest compact construction metaphor; Advanced is the retained comparison family. The next useful step is to measure their distinct animation families under matched conditions. If a specific limitation is demonstrated, add the smallest interpretable construction or timing change that addresses it.

Related current references: [mathematical definitions](MATH.md), [preset values](PRESETS.md), and [manuscript alignment](MANUSCRIPT_ALIGNMENT.md).
