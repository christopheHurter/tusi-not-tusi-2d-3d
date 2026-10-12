# Browser, WebGL, and WebXR requirements

## Desktop baseline

The release targets current desktop Chrome, Edge, Firefox, and Safari for the non-immersive demonstrations.

| Feature | 2-D pages | 3-D pages |
| --- | --- | --- |
| JavaScript | Native ES modules | Native ES modules |
| Graphics | Canvas 2D | WebGL through local Three.js r171 |
| Network at runtime | None | None |
| Build step | None | None |
| Input | Standard HTML controls | HTML controls plus pointer OrbitControls |

This is a compatibility target, not a claim that every browser/OS/GPU combination has been certified. If WebGL is unavailable, the launcher reports that state and the 2-D pages remain usable.

## Serve over HTTP

Do not open the HTML with a `file:` URL. Browser module security rules can block local module imports even though every dependency is present.

From the release directory:

```sh
npm run serve
```

or:

```sh
python -m http.server 8000
```

Then open `http://127.0.0.1:8000/`. The root `index.html` is the canonical launcher. Any static server that supplies ordinary JavaScript and JSON MIME types is sufficient.

## Offline behavior

All runtime assets are local:

- Core modules and examples are included in the release.
- Three.js r171, OrbitControls, and the VR entry helper are under `vendor/three/`.
- There are no CDN imports, web fonts, remote textures, analytics, or runtime package-manager requests.

After the release directory has been copied to a machine, the desktop pages need no internet connection. A local HTTP server is still required for modules.

## WebXR is optional

WebXR is a progressive enhancement of the 3-D pages. It is never required for desktop viewing and it is not used by the 2-D pages.

The entry button is mounted only if both checks pass:

1. The page is a secure context (`window.isSecureContext`), normally HTTPS or a trustworthy localhost origin.
2. `navigator.xr.isSessionSupported("immersive-vr")` resolves to true.

`queryWebXRSupport()` returns one of these non-throwing unsupported reasons:

- `insecure-context`
- `api-unavailable`
- `immersive-vr-unavailable`
- `permission-or-policy`

If unsupported, `installWebXR()` returns a safe result with `button: null`; the Three.js desktop renderer continues normally. Browser family alone is not used as a support test because WebXR availability also depends on the operating system, device, permissions, enterprise policy, and active XR runtime.

## WebXR session behavior

This release provides headset viewing, entry, and exit. It does not provide in-world parameter controls.

- The local Three.js VR button requests the `immersive-vr` session from a user gesture.
- `ThreeModelRenderer.start()` uses Three.js `setAnimationLoop`, so the same loop runs on desktop and in a headset.
- Desktop OrbitControls are disabled while the immersive session is active and restored to their previous state on exit.
- The button's accessible label changes between entering and exiting VR.
- `WebXRSessionController.endSession()` ends an active session.
- `dispose()` ends the session if necessary, removes listeners and the button, restores controls, and disables renderer XR state.

Applications embedding the renderer should call `dispose()` on page teardown.

## Manual headset check

Automated tests mock support detection and lifecycle events; they cannot certify an actual headset/runtime connection. Before a WebXR release:

1. Serve the directory from HTTPS or localhost on a machine connected to the headset runtime.
2. Open both 3-D example pages and confirm desktop rendering first.
3. Confirm the VR entry button is absent when immersive support is unavailable.
4. On a supported setup, enter VR from a user gesture and verify that the point form and fixed paths appear at a comfortable scale.
5. Confirm animation continues and no second desktop animation loop competes with the XR loop.
6. Confirm desktop orbit input is inactive during the session.
7. Exit VR from the browser/headset control, then confirm desktop orbit input is restored.
8. Re-enter and exit once more, checking the console for errors and duplicated buttons/listeners.

## Accessibility and reduced motion

Every example uses labelled native form controls, keyboard-operable buttons, status text, and a Canvas accessible label. Playback has the same URL precedence throughout the suite: `paused=1` always starts the page paused; otherwise `autoplay=1` is an explicit request to play even when the operating system requests reduced motion. Without either parameter, reduced-motion preference starts the page paused. The Play button remains available after loading, and users can always scrub time directly to reproduce a static manuscript state without animation.

## Troubleshooting

### The page is blank when opened from disk

Use an HTTP server instead of a `file:` URL and check the browser console for blocked ES-module imports.

### The 2-D page works but the 3-D page does not

Check WebGL availability and GPU/browser acceleration. WebXR is unrelated to ordinary desktop WebGL rendering.

### No VR button appears

This is expected unless the secure-context and `immersive-vr` feature checks both pass. Confirm the origin, XR runtime, headset connection, browser permissions, and policy settings.

### An imported configuration is rejected

Import a complete `schemaVersion: 1` configuration for the current page's model kind. Unknown fields, another kind, non-finite values, and incompatible sampling are rejected intentionally. See [`API.md`](API.md) and the JSON Schema.
