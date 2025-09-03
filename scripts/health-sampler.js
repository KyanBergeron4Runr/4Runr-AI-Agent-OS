import fs from "fs";

const BASE = process.env.GATEWAY_URL || "http://localhost:3000";
const OUT = "reports/quick-health.csv";

(async () => {
  fs.mkdirSync("reports", { recursive: true });
  fs.writeFileSync(OUT, "ts,ok\n");

  for (let i = 0; i < 20; i++) { // ~5 min
    const ts = new Date().toISOString();
    let ok = 0;
    try {
      ok = (await fetch(`${BASE}/health`)).ok ? 1 : 0;
    } catch {}
    fs.appendFileSync(OUT, `${ts},${ok}\n`);
    await new Promise((r) => setTimeout(r, 15000));
  }
})();
