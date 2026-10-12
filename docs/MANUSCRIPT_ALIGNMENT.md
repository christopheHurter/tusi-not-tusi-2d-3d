# Alignment with the revised paper

Updated 12 October 2026 against the revised manuscript *The Tusi and Not-Tusi Illusions: A Tool for Studying Emergence in Two and Three Dimensions* by Arthur G. Shapiro and Christophe Hurter. This supersedes references to earlier working PDFs and proposed manuscript corrections in the previous version of this document.

## Contribution and scope

The paper specifies a mathematical stimulus-generation framework and an interactive research platform. It distinguishes geometric results from perceptual hypotheses. It reports no perceptual measurements, human–machine comparison experiment, or evaluated visualization, artistic, or immersive application.

## Paper and software constructions

| Revised paper | Software correspondence and limits |
| --- | --- |
| Planar Tusi: straight local paths, phase winding, finite sampling, harmonic or constant-speed motion | Public Motion Control and Phase Control demonstrations; reusable `createTusi2D()` model. Additional UI shifts and display controls are software features. |
| Planar Not-Tusi: circular paths, carrier/riding-radius split, phase and travel direction | Public Not Tusi demonstration and reusable `createNotTusi2D()` model. |
| Spatial Tusi: harmonic displacement along a fixed unit direction, with timing distinguished from path geometry | Public 3D Tusi and reusable `createTusi3D()` preserve straight local motion. Simple, Complex, Lissajous and Epicycle geometry modes offer additional ways to arrange fixed paths; they should not all be described as equations or results from the paper. Nonzero destination pairing in Epicycle creates off-centre chords, a comparison beyond strict centred Tusi. |
| Spatial Not-Tusi: carrier centres on a planar ring, local displacement rotated about X, Y and Z; seed direction and animated axes determine paths | Public 3D Not Tusi at `examples/pedagogy/v4/`. One animated axis produces circles or stationary points, depending on the seed; several animated axes can produce nonplanar closed paths. Static rotations can change path geometry. |
| Spatial timing versus geometry | A phase control should not automatically be described as preserving local paths: indexed static rotations and seed changes can alter them. |

The standalone `createNotTusi3D()` API uses a Fibonacci-sphere arrangement of circles. That retained model and its D7–D12 preset catalog are software extensions from earlier development, not the carrier-ring construction described in the revised manuscript. The public V4 page uses the carrier ring.

## Interpolation is an additional software capability

The revised paper does not develop or compare parameter-space and point-space interpolation or establish perceptual continuity between configurations. The Parameter Sets page and standalone interpolation example retain both methods for exploration:

- Parameter interpolation blends supported controls before model creation, with explicit constraints on geometry and discrete values.
- Point interpolation blends corresponding samples and requires compatible dimension, count, and indexing. Intermediate samples need not belong to a single generative configuration or preserve original local paths.

These operations and their numerical tests do not demonstrate perceptual continuity, grouping, discrimination, or a perceptual advantage. Abrupt switches under finite sampling remain possible. Future perceptual comparisons require specified endpoints, local-path constraints and observer measurements.

## Reproducibility and identifiers

Configuration JSON, fixed sampling conventions and independent time/phase controls support reproducible stimulus construction. The main core phase convention is `angularSpeed * time - phase`; adapters may translate signs to match their own control definitions. The revised paper already uses the minus-sign convention for its spatial Tusi law.

Preset identifiers in `PRESETS.md`, old equation numbers in `MATH.md`, and D/G demonstration names describe the software catalog and earlier formulations. They are not a verified mapping to the revised paper's equation numbers, figure numbers, or movie identifiers. A stable figure-to-preset and supplementary-video mapping still needs to be provided separately before claiming exact figure reproduction. No supplementary movie files or perceptual data are supplied by this repository.

The source documentation explains implementation details; the manuscript and private editorial files are not distributed here.
