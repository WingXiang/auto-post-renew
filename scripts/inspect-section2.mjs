import { readFileSync } from "node:fs";
const j = JSON.parse(readFileSync("./n8n-workflows/00-all-in-one.json", "utf8"));
const sec2 = j.nodes.filter((n) => n.name.startsWith("2·") || n.name === "區段 2：主題探索");
console.log("=== 區段 2 節點 ===");
for (const n of sec2) {
  console.log(`\n--- ${n.name} [${n.type.replace("n8n-nodes-base.", "").replace("@n8n/n8n-nodes-langchain.", "lc.")}] tv=${n.typeVersion} ---`);
  if (n.type.includes("stickyNote")) { console.log("(sticky)"); continue; }
  // print params compactly
  const p = n.parameters || {};
  if (p.jsCode) console.log("jsCode:\n" + p.jsCode);
  else console.log(JSON.stringify(p, null, 1).slice(0, 1500));
  if (n.credentials) console.log("credentials:", JSON.stringify(n.credentials));
}
console.log("\n=== 區段 2 connections ===");
for (const [src, conn] of Object.entries(j.connections)) {
  if (src.startsWith("2·")) console.log(src, "->", JSON.stringify(conn.main?.map(arr=>arr?.map(t=>t.node))));
}
