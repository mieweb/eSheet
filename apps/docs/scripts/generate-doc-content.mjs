/**
 * Generates apps/docs/static/doc-content.json — a flat map of
 * { "<url-path>": "<plain-text content>" } used by the Ozwell search_docs tool.
 *
 * Run manually:  node apps/docs/scripts/generate-doc-content.mjs
 * Or via nx:     nx run app-docs:generate-doc-content
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const docsRoot = join(__dirname, '..', 'docs');
const outFile = join(__dirname, '..', 'static', 'doc-content.json');

function walk(dir) {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (['.md', '.mdx'].includes(extname(entry))) {
      files.push(full);
    }
  }
  return files;
}

function fileToUrlPath(absPath) {
  // e.g. docs/getting-started/installation.md → /docs/getting-started/installation
  const rel = relative(docsRoot, absPath).replace(/\\/g, '/');
  const withoutExt = rel.replace(/\.(md|mdx)$/, '');
  // intro.md is the root /docs page in Docusaurus
  if (basename(withoutExt) === 'intro') {
    const dir = withoutExt.replace(/\/intro$/, '');
    return '/docs' + (dir ? '/' + dir : '');
  }
  return '/docs/' + withoutExt;
}

function stripFrontmatter(content) {
  return content.replace(/^---[\s\S]*?---\n?/, '');
}

function stripMarkdown(content) {
  return (
    content
      // Remove MDX/JSX tags
      .replace(/<[^>]+>/g, ' ')
      // Remove code fences
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]+`/g, ' ')
      // Remove links, images
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Remove headings markers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold/italic
      .replace(/(\*{1,2}|_{1,2})([^*_]+)\1/g, '$2')
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function generate() {
  const files = walk(docsRoot);
  const content = {};
  for (const file of files) {
    const raw = readFileSync(file, 'utf8');
    const text = stripMarkdown(stripFrontmatter(raw));
    const urlPath = fileToUrlPath(file);
    content[urlPath] = text;
  }
  writeFileSync(outFile, JSON.stringify(content, null, 2), 'utf8');
  console.log(
    `[generate-doc-content] Wrote ${Object.keys(content).length} pages to ${outFile}`,
  );
}

generate();

if (process.argv.includes('--watch')) {
  const { watch } = await import('fs');
  console.log(`[generate-doc-content] Watching ${docsRoot} for changes…`);
  let debounce = null;
  watch(docsRoot, { recursive: true }, (_, filename) => {
    if (!filename || !['.md', '.mdx'].some((ext) => filename.endsWith(ext))) return;
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      console.log(`[generate-doc-content] ${filename} changed — regenerating…`);
      generate();
    }, 300);
  });
}
