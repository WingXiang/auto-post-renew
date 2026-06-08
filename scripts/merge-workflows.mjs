// 把 8 個 n8n workflow 合併成單一 workflow，
// - 每個區段用 sticky note 標題 + 編號分類
// - 節點改名加上區段編號前綴，並同步改寫所有 $('節點名') 表達式參照
// - 文案產生的「合併圖片 URL」節點改成固定圖片連結
import { readFileSync, writeFileSync } from "node:fs";

const FIXED_IMG = "https://i.ibb.co/WWVf0Zm9/content.jpg";

// 區段定義（依執行 / 邏輯順序）
const SECTIONS = [
  { file: "01-brand-setup", num: 1, label: "品牌初始化", path: "brand-setup", desc: "建立 / 更新品牌資料（名稱、主題、語氣、FB/IG 帳號）", color: 5 },
  { file: "02-topic-discovery", num: 2, label: "主題探索", path: "topic-discovery", desc: "Serper 搜尋趨勢 + 主題 → AI 評估相關性 → 寫入 topics", color: 4 },
  { file: "03-content-generation", num: 3, label: "文案產生", path: "content-generation", desc: "依主題用 AI 產生 FB / IG 文案，並套用固定配圖", color: 3 },
  { file: "04-post-scheduler", num: 4, label: "單篇發文", path: "post-scheduler", desc: "把指定貼文實際發佈到 Facebook + Instagram", color: 6 },
  { file: "05-analytics-collection", num: 5, label: "數據收集", path: "analytics-collection", desc: "抓取已發佈貼文的按讚 / 留言 / 觸及等成效", color: 2 },
  { file: "06-weekly-optimization", num: 6, label: "每週優化", path: "weekly-optimization", desc: "分析成效數據，產生下週文案 / 配圖優化建議", color: 7 },
  { file: "07-customer-identification", num: 7, label: "潛在客戶辨識", path: "customer-identification", desc: "從互動留言中辨識潛在客戶與後續行動建議", color: 1 },
  { file: "08-update-schedule", num: 8, label: "排程更新", path: "update-schedule", desc: "更新品牌的自動發文排程設定（星期 / 時段）", color: 5 },
];

const BAND = 1000; // 每區段垂直高度
const BAND_TOP0 = 80; // 第一區段起始 y
const STICKY_HEADER = 170; // sticky 標題區高度（節點往下讓開）
const X_SHIFT = 360; // 節點水平起始

// 固定圖片版本的「合併圖片 URL」程式碼
const fixedImageJsCode = `// 套用固定配圖（依使用者指定）
const FIXED_IMG = '${FIXED_IMG}';
const topicTitle = (($('驗證請求').first() || {}).json || {}).topic_title || '';
const results = [];
for (const item of $input.all()) {
  const post = item.json;
  results.push({ json: { ...post, image_url: FIXED_IMG, topic_title: topicTitle || post.topic_title || '' } });
}
return results;`;

// 深層字串取代（用於改寫表達式中的節點參照）
function deepReplace(value, replacers) {
  if (typeof value === "string") {
    let s = value;
    for (const [find, rep] of replacers) {
      if (s.includes(find)) s = s.split(find).join(rep);
    }
    return s;
  }
  if (Array.isArray(value)) return value.map((v) => deepReplace(v, replacers));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = deepReplace(v, replacers);
    return out;
  }
  return value;
}

const mergedNodes = [];
const mergedConnections = {};

SECTIONS.forEach((sec, i) => {
  const wf = JSON.parse(readFileSync(`./n8n-workflows/${sec.file}.json`, "utf8"));

  // 任務 3：文案產生改固定圖片
  if (sec.file === "03-content-generation") {
    const img = wf.nodes.find((n) => n.name === "合併圖片 URL");
    if (img) img.parameters = { ...img.parameters, jsCode: fixedImageJsCode };
  }

  // 計算原始邊界以正規化座標
  const minX = Math.min(...wf.nodes.map((n) => n.position[0]));
  const minY = Math.min(...wf.nodes.map((n) => n.position[1]));
  const maxX = Math.max(...wf.nodes.map((n) => n.position[0]));
  const bandTop = BAND_TOP0 + i * BAND;
  const contentTop = bandTop + STICKY_HEADER;

  // 建立改名對照表（全節點都加前綴）
  const renameMap = new Map();
  for (const n of wf.nodes) renameMap.set(n.name, `${sec.num}·${n.name}`);

  // 建立取代規則（涵蓋各種表達式參照寫法）
  const replacers = [];
  for (const [oldN, newN] of renameMap) {
    replacers.push([`$('${oldN}')`, `$('${newN}')`]);
    replacers.push([`$("${oldN}")`, `$("${newN}")`]);
    replacers.push([`$node['${oldN}']`, `$node['${newN}']`]);
    replacers.push([`$node["${oldN}"]`, `$node["${newN}"]`]);
    replacers.push([`$items('${oldN}'`, `$items('${newN}'`]);
    replacers.push([`$items("${oldN}"`, `$items("${newN}"`]);
  }

  // Sticky note 標題
  mergedNodes.push({
    parameters: {
      content: `## ${sec.num}. ${sec.label}\n**Webhook 路徑：** \`/${sec.path}\`\n\n${sec.desc}`,
      height: BAND - 80,
      width: maxX - minX + 700,
      color: sec.color,
    },
    id: `sticky-section-${sec.num}`,
    name: `區段 ${sec.num}：${sec.label}`,
    type: "n8n-nodes-base.stickyNote",
    typeVersion: 1,
    position: [260, bandTop],
  });

  // 處理每個節點：改寫表達式 + 改名 + 改 id + 移位
  for (const node of wf.nodes) {
    const moved = deepReplace(node, replacers);
    moved.name = renameMap.get(node.name);
    moved.id = `w${sec.num}-${node.id}`;
    moved.position = [
      node.position[0] - minX + X_SHIFT,
      node.position[1] - minY + contentTop,
    ];
    mergedNodes.push(moved);
  }

  // 重建 connections（key 與 target 節點名都要改）
  for (const [srcName, conn] of Object.entries(wf.connections || {})) {
    const newSrc = renameMap.get(srcName) || srcName;
    const newConn = {};
    for (const [outType, outputs] of Object.entries(conn)) {
      newConn[outType] = outputs.map((targets) =>
        (targets || []).map((t) => ({
          ...t,
          node: renameMap.get(t.node) || t.node,
        }))
      );
    }
    mergedConnections[newSrc] = newConn;
  }
});

const merged = {
  name: "AutoPost 全流程（All-in-One）",
  nodes: mergedNodes,
  connections: mergedConnections,
  active: false,
  settings: { executionOrder: "v1" },
  pinData: {},
  meta: {},
};

writeFileSync(
  "./n8n-workflows/00-all-in-one.json",
  JSON.stringify(merged, null, 2),
  "utf8"
);

console.log(`✓ 合併完成：${mergedNodes.length} 個節點`);
console.log(`  - ${SECTIONS.length} 個 sticky note 區段`);
console.log(`  - ${mergedNodes.length - SECTIONS.length} 個功能節點`);
console.log(`  - connections 來源節點數：${Object.keys(mergedConnections).length}`);
console.log(`  - 輸出：n8n-workflows/00-all-in-one.json`);
