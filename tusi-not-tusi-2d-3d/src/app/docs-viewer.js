const DOCUMENTS = Object.freeze([
  ["README.md", "Quick start"],
  ["docs/PEDAGOGY.md", "Experiment controls"],
  ["docs/MATH.md", "Mathematics"],
  ["docs/PRESETS.md", "Software preset catalog"],
  ["docs/API.md", "Public API"],
  ["docs/EXTENDING.md", "Extension guide"],
  ["docs/BROWSERS.md", "Browser and WebXR requirements"],
  ["docs/MANUSCRIPT_ALIGNMENT.md", "Manuscript alignment"],
  ["THIRD_PARTY_NOTICES.md", "Third-party notices"],
]);

const allowedDocuments = new Set(DOCUMENTS.map(([path]) => path));
const selector = document.querySelector("#doc-select");
const status = document.querySelector("#document-status");
const article = document.querySelector("#rendered-document");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function repositoryUrl(path) {
  return new URL(path, new URL(".", window.location.href));
}

function viewerUrl(path, hash = "") {
  const url = repositoryUrl("docs-viewer.html");
  url.searchParams.set("doc", path);
  url.hash = hash;
  return url.href;
}

function linkTarget(href, currentPath) {
  const decodedHref = href.replaceAll("&amp;", "&");
  if (/^(?:javascript|data):/i.test(decodedHref)) return "#";
  if (decodedHref.startsWith("#")) return decodedHref;

  const target = new URL(decodedHref, repositoryUrl(currentPath));
  if (target.origin !== window.location.origin) return target.href;
  if (!target.pathname.toLowerCase().endsWith(".md")) return target.href;

  const rootPath = repositoryUrl(".").pathname;
  if (!target.pathname.startsWith(rootPath)) return target.href;
  const markdownPath = decodeURIComponent(target.pathname.slice(rootPath.length));
  return viewerUrl(markdownPath, target.hash);
}

function inlineMarkdown(source, currentPath) {
  const codeTokens = [];
  let output = escapeHtml(source).replace(/`([^`]+)`/g, (_match, code) => {
    const token = `\u0000CODE${codeTokens.length}\u0000`;
    codeTokens.push(`<code>${code}</code>`);
    return token;
  });

  output = output.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g,
    (_match, alt, href) => `<img src="${escapeHtml(linkTarget(href, currentPath))}" alt="${alt}">`);
  output = output.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g,
    (_match, label, href) => `<a href="${escapeHtml(linkTarget(href, currentPath))}">${label}</a>`);
  output = output
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(/(?<!_)_([^_]+)_(?!_)/g, "<em>$1</em>");

  return output.replace(/\u0000CODE(\d+)\u0000/g,
    (_match, index) => codeTokens[Number(index)]);
}

function splitTableRow(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function slug(value, usedSlugs) {
  const base = value
    .replace(/[`*_\[\]()]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "section";
  const count = usedSlugs.get(base) ?? 0;
  usedSlugs.set(base, count + 1);
  return count === 0 ? base : `${base}-${count + 1}`;
}

function isTableDivider(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function beginsBlock(lines, index) {
  const line = lines[index] ?? "";
  return line.trim() === ""
    || /^```/.test(line)
    || /^#{1,6}\s+/.test(line)
    || /^\s*(?:[-+*]|\d+\.)\s+/.test(line)
    || /^>\s?/.test(line)
    || /^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)
    || (line.includes("|") && isTableDivider(lines[index + 1] ?? ""));
}

function renderMarkdown(markdown, currentPath) {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const rendered = [];
  const usedSlugs = new Map();
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (line.trim() === "") {
      index += 1;
      continue;
    }

    const fence = /^```\s*([\w-]*)\s*$/.exec(line);
    if (fence) {
      const code = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      const language = fence[1] ? ` class="language-${escapeHtml(fence[1])}"` : "";
      rendered.push(`<pre><code${language}>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const id = slug(heading[2], usedSlugs);
      rendered.push(`<h${level} id="${id}">${inlineMarkdown(heading[2], currentPath)}</h${level}>`);
      index += 1;
      continue;
    }

    if (line.includes("|") && isTableDivider(lines[index + 1] ?? "")) {
      const header = splitTableRow(line);
      index += 2;
      const rows = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim() !== "") {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }
      rendered.push(`<div class="document-table-wrap"><table><thead><tr>${header.map((cell) => `<th>${inlineMarkdown(cell, currentPath)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inlineMarkdown(cell, currentPath)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }

    const list = /^\s*((?:[-+*])|(?:\d+\.))\s+(.+)$/.exec(line);
    if (list) {
      const ordered = /\d+\./.test(list[1]);
      const items = [];
      while (index < lines.length) {
        const item = /^\s*((?:[-+*])|(?:\d+\.))\s+(.+)$/.exec(lines[index]);
        if (!item || /\d+\./.test(item[1]) !== ordered) break;
        items.push(item[2]);
        index += 1;
      }
      const tag = ordered ? "ol" : "ul";
      rendered.push(`<${tag}>${items.map((item) => `<li>${inlineMarkdown(item, currentPath)}</li>`).join("")}</${tag}>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      rendered.push(`<blockquote><p>${inlineMarkdown(quote.join(" "), currentPath)}</p></blockquote>`);
      continue;
    }

    if (/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)) {
      rendered.push("<hr>");
      index += 1;
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && !beginsBlock(lines, index)) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    rendered.push(`<p>${inlineMarkdown(paragraph.join(" "), currentPath)}</p>`);
  }

  return rendered.join("\n");
}

for (const [path, label] of DOCUMENTS) {
  const option = document.createElement("option");
  option.value = path;
  option.textContent = label;
  selector.appendChild(option);
}

const params = new URLSearchParams(window.location.search);
const requestedPath = params.get("doc") ?? "README.md";
const currentPath = allowedDocuments.has(requestedPath) ? requestedPath : "README.md";
selector.value = currentPath;

selector.addEventListener("change", () => {
  window.location.assign(viewerUrl(selector.value));
});

try {
  const response = await fetch(repositoryUrl(currentPath));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const markdown = await response.text();
  article.innerHTML = renderMarkdown(markdown, currentPath);
  const heading = article.querySelector("h1")?.textContent ?? "Documentation";
  document.title = `${heading} — Tusi and Not-Tusi`;
  status.textContent = "Documentation ready";
  if (window.location.hash) {
    requestAnimationFrame(() => document.querySelector(window.location.hash)?.scrollIntoView());
  }
} catch (error) {
  status.textContent = "Documentation unavailable";
  article.innerHTML = `<div class="document-error"><h1>Could not load the document</h1><p>${escapeHtml(error.message)}</p><p>Serve this directory over local HTTP with <code>npm run serve</code>.</p></div>`;
}
