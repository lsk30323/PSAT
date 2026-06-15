// Collects the repository's Markdown study material into the web app bundle.
// - Copies every tracked .md file (outside /app) into www/content/
// - Emits www/content/index.json describing the navigation tree
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appDir, "..");
const outDir = path.join(appDir, "www", "content");

// Top-level entries (relative to repo root) that hold the study material.
const SOURCES = [
  "PSAT합격-패키지.md",
  "시간배분표.md",
  "판정표.md",
  "판정표-엄격.md",
  "판정표-엄격-2차.md",
  "sections",
  "문제집",
  "모의고사",
];

async function walk(rel) {
  const abs = path.join(repoRoot, rel);
  const stat = await fs.stat(abs);
  if (stat.isFile()) {
    return abs.endsWith(".md") ? [rel] : [];
  }
  const entries = await fs.readdir(abs);
  const files = [];
  for (const name of entries.sort()) {
    files.push(...(await walk(path.join(rel, name))));
  }
  return files;
}

function titleFromPath(rel) {
  const base = path.basename(rel, ".md");
  return base.replace(/^\d+-/, "").replace(/-/g, " ");
}

async function main() {
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });

  const allFiles = [];
  for (const src of SOURCES) {
    allFiles.push(...(await walk(src)));
  }

  // Group files by their top-level folder (or "" for root-level docs).
  const groups = new Map();
  for (const rel of allFiles) {
    const parts = rel.split(path.sep);
    const group = parts.length > 1 ? parts[0] : "";
    if (!groups.has(group)) groups.set(group, []);

    const dest = path.join(outDir, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(path.join(repoRoot, rel), dest);

    groups.get(group).push({
      title: titleFromPath(rel),
      path: rel.split(path.sep).join("/"),
    });
  }

  const GROUP_LABELS = {
    "": "핵심 자료",
    sections: "유형별 섹션",
    문제집: "문제집",
    모의고사: "모의고사",
  };

  const index = [...groups.entries()].map(([group, files]) => ({
    group,
    label: GROUP_LABELS[group] || group,
    files,
  }));

  await fs.writeFile(
    path.join(outDir, "index.json"),
    JSON.stringify(index, null, 2),
    "utf8"
  );

  const total = allFiles.length;
  console.log(`Bundled ${total} markdown files into ${path.relative(repoRoot, outDir)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
