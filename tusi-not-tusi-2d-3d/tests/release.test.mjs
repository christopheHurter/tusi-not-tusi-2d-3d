import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  EXPERIENCE_IDS,
  EXPERIENCE_ROUTES,
  PUBLICATION_SOURCE_FILES,
} from "../scripts/build-publication.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("the six publication experiment ids and routes are fixed in public order", () => {
  assert.deepEqual(EXPERIENCE_IDS, ["v0", "tusi2", "v0bis", "v3", "tusi3d", "v4"]);
  assert.deepEqual(EXPERIENCE_ROUTES, [
    "examples/pedagogy/v0/",
    "examples/pedagogy/tusi2/",
    "examples/pedagogy/v0bis/",
    "examples/pedagogy/v3/",
    "examples/pedagogy/tusi3d/",
    "examples/pedagogy/v4/",
  ]);
});

test("every allowlisted publication source exists", async () => {
  for (const relativePath of PUBLICATION_SOURCE_FILES) {
    const info = await stat(resolve(root, relativePath));
    assert.equal(info.isFile(), true, `${relativePath} must be a file`);
  }
});

test("the source launcher presents only the six interactive experiments", async () => {
  const launcher = await readFile(resolve(root, "index.html"), "utf8");
  const cardRoutes = [...launcher.matchAll(/<a\s+class="demo-card"\s+href="([^"]+)"/g)]
    .map((match) => match[1]);
  assert.deepEqual(cardRoutes, EXPERIENCE_ROUTES);
  assert.match(launcher, /id="experiments"/);
  assert.match(launcher, /<h1 id="page-title">Tusi and Not-Tusi<\/h1>/);
  assert.match(launcher, /<h2 id="experiments-title">Experiments<\/h2>/);
  assert.match(launcher, /temporal phase\s+relationships/i);
  assert.doesNotMatch(launcher, />\s*Abstract\s*</i);
  assert.doesNotMatch(launcher, /teach(?:ing)?|lesson/i);
  assert.doesNotMatch(launcher, /docs-viewer|src\/app\/launcher\.js|WebXR|immersive VR/i);
  assert.doesNotMatch(
    launcher,
    /examples\/(?:tusi-2d|not-tusi-2d|tusi-3d|not-tusi-3d|interpolation)\//,
  );
});

test("the six experience shells link only to the launcher and local runtime files", async () => {
  for (const id of EXPERIENCE_IDS) {
    const html = await readFile(
      resolve(root, `examples/pedagogy/${id}/index.html`),
      "utf8",
    );
    assert.match(html, new RegExp(`data-step="${id}"`));
    assert.match(html, /href="\.\.\/\.\.\/\.\.\/index\.html"/);
    assert.match(html, /href="\.\.\/\.\.\/\.\.\/assets\/styles\.css"/);
    assert.match(html, /src="\.\/main\.js"/);
    assert.match(html, />Skip to experiment</);
    assert.match(html, /interactive experiment requires JavaScript/i);
    assert.doesNotMatch(html, /Skip to lesson|interactive lesson/i);
    assert.doesNotMatch(html, /docs-viewer|WebXR|\bVR\b/i);
  }
});

test("the generated lesson navigation contains the six routes in publication order", async () => {
  const page = await readFile(resolve(root, "examples/pedagogy/pedagogy-page.js"), "utf8");
  const lessonBlock = /const LESSONS = Object\.freeze\(\{([\s\S]*?)\n\}\);/.exec(page)?.[1] ?? "";
  const ids = [...lessonBlock.matchAll(/^\s{2}([a-z0-9]+):\s*\{/gm)]
    .map((match) => match[1]);
  assert.deepEqual(ids, EXPERIENCE_IDS);
  assert.match(page, /aria-label="Experiment sequence"/);
  assert.doesNotMatch(page, /aria-label="Teaching sequence"/);
  assert.match(page, /href="\.\.\/\$\{id\}\/"/);
});

test("the selected 3-D experience uses desktop Three.js without the WebXR adapter", async () => {
  const page = await readFile(resolve(root, "examples/pedagogy/pedagogy-page.js"), "utf8");
  const renderer = await readFile(resolve(root, "src/renderers/three-renderer.js"), "utf8");
  assert.match(page, /import\("\.\.\/\.\.\/src\/renderers\/three-renderer\.js"\)/);
  assert.doesNotMatch(page, /webxr\.js|installWebXR|VRButton/);
  assert.match(renderer, /from "\.\.\/\.\.\/vendor\/three\/three\.module\.js"/);
  assert.match(renderer, /from "\.\.\/\.\.\/vendor\/three\/OrbitControls\.js"/);
  assert.doesNotMatch(renderer, /webxr\.js|installWebXR|VRButton/);
});

test("the publication metadata and scripts are scope-aligned", async () => {
  const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  const citation = await readFile(resolve(root, "CITATION.cff"), "utf8");
  const notices = await readFile(resolve(root, "THIRD_PARTY_NOTICES.md"), "utf8");

  assert.equal(packageJson.version, "1.1.0");
  assert.equal(packageJson.license, "MIT");
  assert.match(packageJson.description, /experiments for understanding/i);
  assert.doesNotMatch(packageJson.description, /teach(?:ing)?|lesson/i);
  assert.equal(packageJson.scripts["build:publication"], "node scripts/build-publication.mjs");
  assert.equal(packageJson.scripts["test:browser"], "node tests/browser-smoke.mjs");
  assert.equal(packageJson.scripts["test:release"], "npm test && npm run test:browser");
  assert.doesNotMatch(JSON.stringify(packageJson), /WebXR|\bVR\b/i);

  assert.match(citation, /^version: 1\.1\.0$/m);
  assert.match(citation, /^date-released: \d{4}-\d{2}-\d{2}$/m);
  assert.match(citation, /Six offline, no-build interactive experiments/);
  assert.match(citation, /Tusi and Not-Tusi Interactive Experiments/);
  assert.match(citation, /^preferred-citation:$/m);
  assert.doesNotMatch(citation, /WebXR|\bVR\b/i);
  assert.match(notices, /optional adapter is not used by the six public experiments/i);
});

test("the authoring project remains separate from historical prototypes", async () => {
  const normalized = root.replaceAll("\\", "/");
  // Repository checkouts may be renamed without changing the software.
  assert.equal((await stat(resolve(root, "package.json"))).isFile(), true);
  assert.doesNotMatch(normalized, /looping lines V[0-4]/);
});
