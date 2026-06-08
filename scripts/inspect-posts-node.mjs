import { readFileSync } from "node:fs";
const j = JSON.parse(readFileSync("./n8n-workflows/00-all-in-one.json", "utf8"));
// 找一個讀取 posts 的 Google Sheets 節點來複製設定
const cand = j.nodes.filter(n => n.type === "n8n-nodes-base.googleSheets" && /讀取貼文|讀取已發佈貼文/.test(n.name));
for (const n of cand) {
  console.log("=== " + n.name + " ===");
  console.log(JSON.stringify({ parameters: n.parameters, credentials: n.credentials, typeVersion: n.typeVersion }, null, 2));
}
// 也看 webhook 節點的 typeVersion + 一個 httpRequest 範例
const wh = j.nodes.find(n => n.type === "n8n-nodes-base.webhook");
console.log("\n=== webhook typeVersion ===", wh?.typeVersion);
const http = j.nodes.find(n => n.type === "n8n-nodes-base.httpRequest");
console.log("=== httpRequest sample (" + (http?.name) + ") typeVersion ===", http?.typeVersion);
console.log(JSON.stringify(http?.parameters, null, 2).slice(0, 1200));
