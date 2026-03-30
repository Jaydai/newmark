const fs = require("fs");
const path = require("path");

const promptsDir = path.resolve(__dirname, "..", "..", "..", "prompts");
const outDir = path.resolve(__dirname, "..", "public", "data");
const outFile = path.join(outDir, "prompts.json");

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;

  const meta = {};
  match[1].split("\n").forEach((line) => {
    const idx = line.indexOf(":");
    if (idx > 0) {
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      meta[key] = val;
    }
  });

  return { ...meta, content: match[2].trim() };
}

fs.mkdirSync(outDir, { recursive: true });

if (!fs.existsSync(promptsDir)) {
  console.log(`⚠ Prompts directory not found: ${promptsDir}`);
  fs.writeFileSync(outFile, "[]");
  process.exit(0);
}

const files = fs.readdirSync(promptsDir).filter((f) => f.endsWith(".md"));
const prompts = files
  .map((f) => {
    const raw = fs.readFileSync(path.join(promptsDir, f), "utf-8");
    return parseFrontmatter(raw);
  })
  .filter(Boolean);

fs.writeFileSync(outFile, JSON.stringify(prompts, null, 2));
console.log(`Built ${prompts.length} prompts → ${outFile}`);
