#!/usr/bin/env bun
/**
 * Documentation checker.
 *
 * Verifies that required documents exist and that every relative Markdown link
 * points at a file (and, where practical, a heading) that exists in the repo.
 * It deliberately does not judge prose quality.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");

const REQUIRED = [
  "README.md",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "CHANGELOG.md",
  "apps/server/AGENTS.md",
  "apps/web/AGENTS.md",
  "docs/ARCHITECTURE.md",
  "docs/GAME_DESIGN.md",
  "docs/DOMAIN_GLOSSARY.md",
  "docs/DATA_MODEL.md",
  "docs/LLM_PIPELINE.md",
  "docs/TESTING.md",
  "docs/OPERATIONS.md",
  "docs/decisions/README.md",
  "docs/decisions/ADR-0001-modular-monolith.md",
  "docs/decisions/ADR-0002-llm-as-content-proposer.md",
  "docs/decisions/ADR-0003-action-based-world-turns.md",
  "docs/decisions/ADR-0004-seeded-combat.md",
  "docs/decisions/ADR-0005-idempotent-commands.md",
  "docs/decisions/ADR-0006-sqlite-migrations.md",
  "docs/prompts/event-director.md",
  "docs/prompts/event-generator.md",
  "docs/prompts/narrative-generator.md",
];

const MARKDOWN_ROOTS = [
  "README.md",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "CHANGELOG.md",
  "docs",
  "apps/server/AGENTS.md",
  "apps/web/AGENTS.md",
];

const errors: string[] = [];

function fail(message: string): void {
  errors.push(message);
}

function walkMarkdown(path: string): string[] {
  const absolute = join(ROOT, path);
  if (!existsSync(absolute)) return [];
  if (statSync(absolute).isFile()) return extname(path) === ".md" ? [absolute] : [];
  const found: string[] = [];
  for (const entry of new Bun.Glob("**/*.md").scanSync({ cwd: absolute })) {
    found.push(join(absolute, entry));
  }
  return found;
}

function stripCode(markdown: string): string {
  return markdown
    .replace(/^```[\s\S]*?^```/gm, "")
    .replace(/^~~~[\s\S]*?^~~~/gm, "")
    .replace(/`[^`\n]*`/g, "");
}

function slugify(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

function headingsOf(markdown: string): Set<string> {
  const slugs = new Set<string>();
  const counts = new Map<string, number>();
  for (const line of stripCode(markdown).split("\n")) {
    const match = /^(#{1,6})\s+(.*)$/.exec(line);
    if (!match) continue;
    const base = slugify(match[2] ?? "");
    if (!base) continue;
    const seen = counts.get(base) ?? 0;
    counts.set(base, seen + 1);
    slugs.add(seen === 0 ? base : `${base}-${seen}`);
  }
  return slugs;
}

function checkLinks(file: string): void {
  const markdown = readFileSync(file, "utf8");
  const body = stripCode(markdown);
  const linkPattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  const relativePath = relative(ROOT, file);

  for (const match of body.matchAll(linkPattern)) {
    const target = match[1];
    if (!target) continue;
    if (/^(https?:|mailto:|tel:|data:)/i.test(target)) continue;
    if (target.startsWith("#")) {
      checkAnchor(file, target.slice(1), relativePath, true);
      continue;
    }

    const [rawPath, rawAnchor] = target.split("#");
    const cleanPath = decodeURIComponent(rawPath ?? "");
    if (!cleanPath) {
      checkAnchor(file, rawAnchor ?? "", relativePath, true);
      continue;
    }

    const resolved = resolve(dirname(file), cleanPath);
    if (!existsSync(resolved)) {
      fail(`${relativePath}: broken link "${target}"`);
      continue;
    }
    if (rawAnchor && resolved.endsWith(".md")) {
      checkAnchor(resolved, rawAnchor, relativePath, false);
    }
  }
}

function checkAnchor(file: string, anchor: string, from: string, sameFile: boolean): void {
  if (!anchor) return;
  if (!file.endsWith(".md")) return;
  const headings = headingsOf(readFileSync(file, "utf8"));
  if (!headings.has(anchor.toLowerCase())) {
    const where = sameFile ? from : `${from} → ${relative(ROOT, file)}`;
    fail(`${where}: missing heading anchor "#${anchor}"`);
  }
}

for (const path of REQUIRED) {
  if (!existsSync(join(ROOT, path))) fail(`missing required document: ${path}`);
}

const files = new Set<string>();
for (const root of MARKDOWN_ROOTS) {
  for (const file of walkMarkdown(root)) files.add(file);
}

for (const file of files) checkLinks(file);

if (errors.length > 0) {
  console.error(`docs:check failed with ${errors.length} problem(s):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(
  `docs:check passed: ${REQUIRED.length} required documents, ${files.size} files scanned.`,
);
