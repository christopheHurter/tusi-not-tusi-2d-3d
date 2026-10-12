# Third-party notices

This release contains only one vendored runtime dependency.

## Three.js r171

The following files are derived from Three.js release r171:

- `vendor/three/three.core.js`
- `vendor/three/three.module.js`
- `vendor/three/OrbitControls.js`
- `vendor/three/LICENSE`

Project: <https://threejs.org/>

Source release: <https://github.com/mrdoob/three.js/tree/r171>

License source: <https://github.com/mrdoob/three.js/blob/r171/LICENSE>

Copyright (c) 2010-2024 three.js authors

Three.js is distributed under the MIT License:

> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.

No Three.js files are fetched from a CDN at runtime. Development-only test tools, when installed by a maintainer, are not bundled in the publication release.

The source repository additionally includes `vendor/three/VRButton.js` from the same Three.js release under its MIT license. This optional adapter is not used by the six public experiments or included in the smaller publication build.
