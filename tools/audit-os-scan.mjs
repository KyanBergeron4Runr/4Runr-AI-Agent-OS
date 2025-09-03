import { promises as fs } from "fs";
import path from "path";

const ROOT = process.cwd();
const GLOB_DIRS = [
  "packages", "apps", "services", "policies", "ARCHITECTURE", "tests", "sdk", "tools"
];
const KEYS = [
  "shield","sentinel","ml","trainer","feedback","registry",
  "guardrail","policy","prompt","injection","hallucination",
  "sse","idempot","zod","validation","redteam","contracts"
];

async function walk(dir, out=[]) {
  let entries = [];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (p.includes("node_modules") || p.includes(".git")) continue;
    if (e.isDirectory()) await walk(p, out);
    else out.push(p);
  }
  return out;
}

function hit(content, keys) {
  const lc = content.toLowerCase();
  return keys.filter(k => lc.includes(k.toLowerCase()));
}

(async () => {
  const files = await walk(ROOT, []);
  const subset = files.filter(f => /\.(ts|tsx|js|mjs|cjs|json|md|yaml|yml)$/.test(f));

  const matches = [];
  for (const f of subset) {
    const c = await fs.readFile(f, "utf8").catch(()=> "");
    const hits = hit(c, KEYS);
    if (hits.length) matches.push({ file: path.relative(ROOT, f), hits: [...new Set(hits)] });
  }

  let pkg = {};
  try {
    pkg = JSON.parse(await fs.readFile(path.join(ROOT, "package.json"), "utf8"));
  } catch {}

  const report = {
    timestamp: new Date().toISOString(),
    exists: {
      shield: matches.some(m => m.file.includes("shield")),
      sentinel: matches.some(m => m.file.includes("sentinel")),
      ml: matches.some(m => m.file.includes("/ml/") || m.hits?.includes("trainer")),
      redteamTests: matches.some(m => /tests\/(redteam|contracts)/.test(m.file) || m.hits?.includes("redteam")),
      contractsTests: matches.some(m => /tests\/contracts/.test(m.file) || m.hits?.includes("contracts")),
    },
    packageScripts: pkg.scripts || {},
    workspaces: pkg.workspaces || [],
    hits: matches.sort((a,b)=> a.file.localeCompare(b.file)),
  };

  await fs.mkdir("artifacts", { recursive: true });
  await fs.writeFile("artifacts/audit-os-scan.json", JSON.stringify(report, null, 2));
  console.log("Wrote artifacts/audit-os-scan.json");
})();
