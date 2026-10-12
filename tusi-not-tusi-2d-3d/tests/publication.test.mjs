import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import test from "node:test";

import {
  EXPERIENCE_IDS,
  EXPERIENCE_ROUTES,
  PROJECT_ROOT,
  PUBLICATION_DIRECTORY,
  PUBLICATION_LOCK_DIRECTORY,
  PUBLICATION_LOCK_RELATIVE_DIRECTORY,
  PUBLICATION_MANIFEST,
  PUBLICATION_RELATIVE_DIRECTORY,
  buildPublication,
  retryTransientFileOperation,
} from "../scripts/build-publication.mjs";

const publication = await buildPublication();

function normalizedRelative(root, path) {
  return relative(root, path).replaceAll("\\", "/");
}

async function filesBelow(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesBelow(path, root));
    else files.push(normalizedRelative(root, path));
  }
  return files.sort();
}

async function fileHashes(directory) {
  const hashes = new Map();
  for (const relativePath of await filesBelow(directory)) {
    const contents = await readFile(resolve(directory, relativePath));
    hashes.set(relativePath, createHash("sha256").update(contents).digest("hex"));
  }
  return hashes;
}

function moduleSpecifiers(source) {
  const specifiers = [];
  const staticPattern = /\b(?:import|export)\s+(?:[^"'`;]*?\s+from\s+)?["']([^"']+)["']/g;
  const dynamicPattern = /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g;
  for (const pattern of [staticPattern, dynamicPattern]) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  return specifiers;
}

async function assertFile(path, message) {
  const info = await stat(path);
  assert.equal(info.isFile(), true, message);
}

async function startPublicationServer() {
  const child = spawn(
    process.execPath,
    [resolve(PUBLICATION_DIRECTORY, "scripts/serve.mjs")],
    {
      cwd: PUBLICATION_DIRECTORY,
      env: { ...process.env, PORT: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });

  const baseUrl = await new Promise((resolveUrl, rejectUrl) => {
    const timeout = setTimeout(() => {
      child.kill();
      rejectUrl(new Error(`Publication server did not start. ${stderr}`));
    }, 5000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      const match = /http:\/\/127\.0\.0\.1:(\d+)\//.exec(chunk);
      if (!match) return;
      clearTimeout(timeout);
      resolveUrl(`http://127.0.0.1:${match[1]}`);
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      rejectUrl(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      rejectUrl(new Error(`Publication server exited early with code ${code}. ${stderr}`));
    });
  });

  return { child, baseUrl };
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  const exited = new Promise((resolveExit) => child.once("exit", resolveExit));
  child.kill();
  await Promise.race([
    exited,
    new Promise((resolveTimeout) => setTimeout(resolveTimeout, 2000)),
  ]);
}

test("the builder targets the dedicated six-experience staging directory", () => {
  assert.equal(publication.directory, PUBLICATION_DIRECTORY);
  assert.equal(
    normalizedRelative(PROJECT_ROOT, PUBLICATION_DIRECTORY),
    PUBLICATION_RELATIVE_DIRECTORY,
  );
  assert.equal(
    normalizedRelative(PROJECT_ROOT, PUBLICATION_LOCK_DIRECTORY),
    PUBLICATION_LOCK_RELATIVE_DIRECTORY,
  );
  assert.deepEqual(publication.files, PUBLICATION_MANIFEST);
});

test("transient Windows file errors use bounded retry and backoff", async () => {
  let attempts = 0;
  const result = await retryTransientFileOperation(() => {
    attempts += 1;
    if (attempts < 3) throw Object.assign(new Error("temporarily locked"), { code: "EPERM" });
    return "ready";
  }, { maxRetries: 3, initialDelayMs: 1, maximumDelayMs: 1 });
  assert.equal(result, "ready");
  assert.equal(attempts, 3);

  let boundedAttempts = 0;
  await assert.rejects(
    retryTransientFileOperation(() => {
      boundedAttempts += 1;
      throw Object.assign(new Error("still locked"), { code: "EBUSY" });
    }, { maxRetries: 2, initialDelayMs: 1, maximumDelayMs: 1 }),
    { code: "EBUSY" },
  );
  assert.equal(boundedAttempts, 3);

  let permanentAttempts = 0;
  await assert.rejects(
    retryTransientFileOperation(() => {
      permanentAttempts += 1;
      throw Object.assign(new Error("invalid source"), { code: "ENOENT" });
    }, { maxRetries: 8, initialDelayMs: 1, maximumDelayMs: 1 }),
    { code: "ENOENT" },
  );
  assert.equal(permanentAttempts, 1);
});

test("the staged publication exactly matches the allowlist", async () => {
  assert.deepEqual(await filesBelow(PUBLICATION_DIRECTORY), PUBLICATION_MANIFEST);
  assert.equal(PUBLICATION_MANIFEST.length, 34);
});

test("the staged launcher exposes exactly the six selected experiences", async () => {
  const htmlEntries = PUBLICATION_MANIFEST
    .filter((path) => path.endsWith(".html"))
    .sort();
  assert.deepEqual(htmlEntries, [
    "examples/pedagogy/tusi2/index.html",
    "examples/pedagogy/tusi3d/index.html",
    "examples/pedagogy/v0/index.html",
    "examples/pedagogy/v0bis/index.html",
    "examples/pedagogy/v3/index.html",
    "examples/pedagogy/v4/index.html",
    "index.html",
  ]);

  const launcher = await readFile(resolve(PUBLICATION_DIRECTORY, "index.html"), "utf8");
  const cardRoutes = [...launcher.matchAll(/<a\s+class="demo-card"\s+href="([^"]+)"/g)]
    .map((match) => match[1]);
  assert.deepEqual(cardRoutes, EXPERIENCE_ROUTES);
  assert.match(launcher, /<h1 id="page-title">Tusi and Not-Tusi<\/h1>/);
  assert.match(launcher, /<h2 id="experiments-title">Experiments<\/h2>/);
  assert.match(launcher, /temporal phase\s+relationships/i);
  assert.doesNotMatch(launcher, />\s*Abstract\s*</i);
  assert.doesNotMatch(launcher, /teach(?:ing)?|lesson/i);
  assert.doesNotMatch(
    launcher,
    /docs-viewer|Paper and reusable model examples|examples\/(?:tusi-2d|not-tusi-2d|tusi-3d|not-tusi-3d|interpolation)\//i,
  );

  const teachingPage = await readFile(
    resolve(PUBLICATION_DIRECTORY, "examples/pedagogy/pedagogy-page.js"),
    "utf8",
  );
  const lessonBlock = /const LESSONS = Object\.freeze\(\{([\s\S]*?)\n\}\);/.exec(teachingPage)?.[1] ?? "";
  const declaredIds = [...lessonBlock.matchAll(/^\s{2}([a-z0-9]+):\s*\{/gm)]
    .map((match) => match[1]);
  assert.deepEqual(declaredIds, EXPERIENCE_IDS);
});

test("no author-only route or WebXR adapter is staged", () => {
  const forbiddenPaths = [
    "docs-viewer.html",
    "tusi-not-tusi-3d-demos.html",
    "README.md",
    "schema/",
    "docs/",
    "tests/",
    "src/app/",
    "src/renderers/canvas-renderer.js",
    "src/renderers/webxr.js",
    "vendor/three/VRButton.js",
    "examples/demo-page.js",
    "examples/interpolation-page.js",
    "examples/tusi-2d/",
    "examples/not-tusi-2d/",
    "examples/tusi-3d/",
    "examples/not-tusi-3d/",
    "examples/interpolation/",
  ];
  for (const forbiddenPath of forbiddenPaths) {
    assert.equal(
      PUBLICATION_MANIFEST.some((path) =>
        path === forbiddenPath || path.startsWith(forbiddenPath)),
      false,
      `${forbiddenPath} must not be staged`,
    );
  }
});

test("all staged browser resources are local", async () => {
  const runtimeFiles = PUBLICATION_MANIFEST.filter((path) => /\.(?:css|html|js)$/i.test(path));
  const remoteLoaderPatterns = [
    /\bimport\s+(?:[^"'`]*?\s+from\s+)?["'`]https?:\/\//i,
    /\bimport\s*\(\s*["'`]https?:\/\//i,
    /\bfetch\s*\(\s*["'`]https?:\/\//i,
    /(?:src|href)\s*=\s*["']https?:\/\//i,
    /@import\s+(?:url\()?\s*["']?https?:\/\//i,
    /url\(\s*["']?https?:\/\//i,
  ];

  for (const relativePath of runtimeFiles) {
    const source = await readFile(resolve(PUBLICATION_DIRECTORY, relativePath), "utf8");
    assert.equal(
      remoteLoaderPatterns.some((pattern) => pattern.test(source)),
      false,
      `${relativePath} contains a remote runtime loader`,
    );
  }
});

test("every staged module import resolves inside the publication", async () => {
  const moduleFiles = PUBLICATION_MANIFEST.filter((path) => /\.(?:js|mjs)$/i.test(path));
  for (const relativePath of moduleFiles) {
    const absolutePath = resolve(PUBLICATION_DIRECTORY, relativePath);
    const source = await readFile(absolutePath, "utf8");
    for (const specifier of moduleSpecifiers(source)) {
      if (specifier.startsWith("node:")) {
        assert.equal(relativePath, "scripts/serve.mjs");
        continue;
      }
      assert.match(specifier, /^\.\.?\//, `${relativePath} uses a non-local import: ${specifier}`);
      const dependency = resolve(dirname(absolutePath), specifier.split(/[?#]/, 1)[0]);
      const dependencyRelativePath = normalizedRelative(PUBLICATION_DIRECTORY, dependency);
      assert.doesNotMatch(
        dependencyRelativePath,
        /^\.\.(?:\/|$)/,
        `${relativePath} imports outside the publication: ${specifier}`,
      );
      await assertFile(
        dependency,
        `${relativePath} has a missing staged import: ${specifier}`,
      );
    }
  }
});

test("every local HTML resource and navigation target resolves", async () => {
  const htmlFiles = PUBLICATION_MANIFEST.filter((path) => path.endsWith(".html"));
  for (const relativePath of htmlFiles) {
    const source = await readFile(resolve(PUBLICATION_DIRECTORY, relativePath), "utf8");
    const base = new URL(relativePath, "https://publication.invalid/");
    const references = [...source.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)]
      .map((match) => match[1])
      .filter((reference) => !reference.startsWith("#"));
    for (const reference of references) {
      const url = new URL(reference, base);
      assert.equal(url.origin, base.origin, `${relativePath} links outside the publication: ${reference}`);
      let target = decodeURIComponent(url.pathname.replace(/^\//, ""));
      if (target.endsWith("/")) target += "index.html";
      await assertFile(
        resolve(PUBLICATION_DIRECTORY, target),
        `${relativePath} has a missing local target: ${reference}`,
      );
    }
  }
});

test("publication metadata describes the scoped non-VR package", async () => {
  const packageJson = JSON.parse(
    await readFile(resolve(PUBLICATION_DIRECTORY, "package.json"), "utf8"),
  );
  assert.equal(packageJson.name, "tusi-not-tusi-six-experiences");
  assert.equal(packageJson.version, "1.1.0");
  assert.deepEqual(packageJson.scripts, { serve: "node scripts/serve.mjs" });
  assert.match(packageJson.description, /experiments for understanding/i);
  assert.doesNotMatch(packageJson.description, /teach(?:ing)?|lesson/i);
  assert.equal("dependencies" in packageJson, false);
  assert.equal("devDependencies" in packageJson, false);

  const citation = await readFile(resolve(PUBLICATION_DIRECTORY, "CITATION.cff"), "utf8");
  const notices = await readFile(
    resolve(PUBLICATION_DIRECTORY, "THIRD_PARTY_NOTICES.md"),
    "utf8",
  );
  assert.match(citation, /Six offline, no-build interactive experiments/);
  assert.match(citation, /^version: 1\.1\.0$/m);
  assert.match(citation, /^date-released: \d{4}-\d{2}-\d{2}$/m);
  assert.doesNotMatch(citation, /WebXR|\bVR\b/i);
  assert.match(notices, /optional adapter is not used by the six public experiments/i);
});

test("the local publication server confines files and returns hardened responses", async () => {
  const { child, baseUrl } = await startPublicationServer();
  try {
    const index = await fetch(`${baseUrl}/index.html`);
    assert.equal(index.status, 200);
    assert.match(index.headers.get("content-type") ?? "", /^text\/html\b/);
    assert.equal(index.headers.get("x-content-type-options"), "nosniff");
    assert.match(index.headers.get("content-security-policy") ?? "", /connect-src 'none'/);

    const head = await fetch(`${baseUrl}/assets/styles.css`, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.match(head.headers.get("content-type") ?? "", /^text\/css\b/);
    assert.equal(await head.text(), "");

    const citation = await fetch(`${baseUrl}/CITATION.cff`);
    assert.equal(citation.status, 200);
    assert.match(citation.headers.get("content-type") ?? "", /^application\/yaml\b/);

    const method = await fetch(`${baseUrl}/index.html`, { method: "POST" });
    assert.equal(method.status, 405);
    assert.equal(method.headers.get("allow"), "GET, HEAD");

    const traversal = await fetch(`${baseUrl}/..%2f..%2fdocs-viewer.html`);
    assert.equal(traversal.status, 404);
    const malformed = await fetch(`${baseUrl}/bad%zz`);
    assert.equal(malformed.status, 404);
  } finally {
    await stopChild(child);
  }
});

test("rebuilding the publication is byte-for-byte reproducible", async () => {
  const firstHashes = await fileHashes(PUBLICATION_DIRECTORY);
  await buildPublication();
  const secondHashes = await fileHashes(PUBLICATION_DIRECTORY);
  assert.deepEqual(secondHashes, firstHashes);
});

test("concurrent build requests are serialized without corrupting the stage", async () => {
  await Promise.all([buildPublication(), buildPublication()]);
  assert.deepEqual(await filesBelow(PUBLICATION_DIRECTORY), PUBLICATION_MANIFEST);
});
