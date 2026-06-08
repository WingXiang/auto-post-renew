import { readFileSync } from "node:fs";

const j = JSON.parse(readFileSync("./n8n-workflows/00-all-in-one.json", "utf8"));
const names = j.nodes.map((n) => n.name);
const ids = j.nodes.map((n) => n.id);
const nameSet = new Set(names);
const idSet = new Set(ids);

let problems = 0;

// 1. 唯一性
const dupNames = names.filter((n, i) => names.indexOf(n) !== i);
const dupIds = ids.filter((n, i) => ids.indexOf(n) !== i);
if (dupNames.length) { console.log("✗ 重複節點名:", [...new Set(dupNames)]); problems++; }
else console.log("✓ 節點名稱全部唯一 (" + names.length + ")");
if (dupIds.length) { console.log("✗ 重複節點 ID:", [...new Set(dupIds)]); problems++; }
else console.log("✓ 節點 ID 全部唯一");

// 2. connections 目標都存在
for (const [src, conn] of Object.entries(j.connections)) {
  if (!nameSet.has(src)) { console.log("✗ connection 來源不存在:", src); problems++; }
  for (const outputs of Object.values(conn)) {
    for (const targets of outputs) {
      for (const t of targets || []) {
        if (!nameSet.has(t.node)) { console.log("✗ connection 目標不存在:", t.node, "(from", src + ")"); problems++; }
      }
    }
  }
}
if (problems === 0) console.log("✓ 所有 connection 來源 / 目標皆有對應節點");

// 3. 表達式參照的節點名都存在
const s = JSON.stringify(j);
const reFns = [/\$\('([^']+)'\)/g, /\$\("([^"]+)"\)/g, /\$node\[['"]([^'"]+)['"]\]/g, /\$items\('([^']+)'/g];
const refSet = new Set();
for (const re of reFns) { let m; while ((m = re.exec(s))) refSet.add(m[1]); }
let badRefs = 0;
for (const r of refSet) {
  if (!nameSet.has(r)) { console.log("✗ 表達式參照不存在的節點:", JSON.stringify(r)); badRefs++; }
}
if (badRefs === 0) console.log("✓ 所有表達式節點參照 (" + refSet.size + ") 皆有對應節點");
else problems += badRefs;

// 4. webhook 路徑檢查
const webhookPaths = j.nodes.filter((n) => n.type.includes("webhook")).map((n) => n.parameters.path);
console.log("✓ webhook 路徑:", JSON.stringify(webhookPaths));

// 5. 固定圖片檢查
const imgNode = j.nodes.find((n) => n.name === "3·合併圖片 URL");
console.log(imgNode && imgNode.parameters.jsCode.includes("WWVf0Zm9")
  ? "✓ 文案產生已套用固定圖片連結 (WWVf0Zm9)"
  : "✗ 固定圖片連結未套用");

console.log(problems === 0 ? "\n==> 驗證通過 ✅" : `\n==> 發現 ${problems} 個問題 ❌`);
