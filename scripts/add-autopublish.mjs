// 在 00-all-in-one.json 加入「區段 9：自動發布排程」
// Schedule Trigger(每15分) → 讀取所有貼文 → 篩選已到期的 scheduled → 呼叫 post-scheduler webhook 發文
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "./n8n-workflows/00-all-in-one.json";
const j = JSON.parse(readFileSync(FILE, "utf8"));

// 避免重複加入
if (j.nodes.some((n) => n.id && n.id.startsWith("w9-"))) {
  console.log("區段 9 已存在，跳過。");
  process.exit(0);
}

const CRED = { googleApi: { id: "M653HfRFnL0gLZej", name: "Google Sheets SA" } };
const bandTop = 8080;
const y = bandTop + 150;

const filterCode = `// 篩選出已到期、狀態為 scheduled 的貼文
const now = new Date();
const out = [];
for (const item of $input.all()) {
  const p = item.json;
  if (!p || p.status !== 'scheduled') continue;
  if (!p.scheduled_time) continue;
  const t = new Date(p.scheduled_time);
  if (isNaN(t.getTime())) continue;
  if (t.getTime() <= now.getTime()) {
    out.push({ json: { brand_id: p.brand_id, post_id: p.post_id } });
  }
}
return out;`;

const newNodes = [
  {
    parameters: {
      content:
        "## 9. 自動發布排程\n**觸發：** 每 15 分鐘\n\n掃描所有 `status=scheduled` 且發佈時間已到的貼文，逐一呼叫 `/webhook/post-scheduler` 真正發到 FB / IG。\n（取代 Vercel cron — 免費方案每天只能跑一次）",
      height: 760,
      width: 1100,
      color: 6,
    },
    id: "sticky-section-9",
    name: "區段 9：自動發布排程",
    type: "n8n-nodes-base.stickyNote",
    typeVersion: 1,
    position: [260, bandTop],
  },
  {
    parameters: {
      rule: { interval: [{ field: "minutes", minutesInterval: 15 }] },
    },
    id: "w9-schedule-trigger",
    name: "9·排程觸發（每15分）",
    type: "n8n-nodes-base.scheduleTrigger",
    typeVersion: 1.2,
    position: [360, y],
  },
  {
    parameters: {
      operation: "read",
      documentId: {
        __rl: true,
        mode: "id",
        value: "={{ $env.GOOGLE_SHEETS_SPREADSHEET_ID }}",
      },
      sheetName: {
        __rl: true,
        mode: "list",
        value: "1821047073",
        cachedResultName: "posts",
      },
      options: {},
      authentication: "serviceAccount",
    },
    id: "w9-read-posts",
    name: "9·讀取待發貼文",
    type: "n8n-nodes-base.googleSheets",
    typeVersion: 4.5,
    position: [620, y],
    credentials: CRED,
  },
  {
    parameters: { jsCode: filterCode },
    id: "w9-filter-due",
    name: "9·篩選到期貼文",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [880, y],
  },
  {
    parameters: {
      method: "POST",
      url: "https://wing.zeabur.app/webhook/post-scheduler",
      sendBody: true,
      specifyBody: "json",
      jsonBody:
        "={{ JSON.stringify({ api_key: $env.N8N_API_KEY, brand_id: $json.brand_id, post_id: $json.post_id }) }}",
      options: {},
    },
    id: "w9-call-publish",
    name: "9·呼叫發文",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [1140, y],
    onError: "continueRegularOutput",
  },
];

j.nodes.push(...newNodes);

j.connections["9·排程觸發（每15分）"] = {
  main: [[{ node: "9·讀取待發貼文", type: "main", index: 0 }]],
};
j.connections["9·讀取待發貼文"] = {
  main: [[{ node: "9·篩選到期貼文", type: "main", index: 0 }]],
};
j.connections["9·篩選到期貼文"] = {
  main: [[{ node: "9·呼叫發文", type: "main", index: 0 }]],
};

writeFileSync(FILE, JSON.stringify(j, null, 2), "utf8");
console.log(`✓ 已加入區段 9（共 ${newNodes.length} 個節點）`);
console.log(`  總節點數：${j.nodes.length}`);
