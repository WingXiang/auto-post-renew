// 把 AutoPost 區段2 主題探索的「Serper+Gemini評估」換成「Perplexity 時事研究 + Gemini 整理」
import { readFileSync, writeFileSync } from "node:fs";
const FILE = "./n8n-workflows/00-all-in-one.json";
const j = JSON.parse(readFileSync(FILE, "utf8"));

const OPENROUTER_CRED = { openRouterApi: { id: "lgVpYGGdH7A0e3CU", name: "OpenRouter account" } };
const SHEETS_CRED = { googleApi: { id: "M653HfRFnL0gLZej", name: "Google Sheets SA" } };
const SS = "={{ $env.GOOGLE_SHEETS_SPREADSHEET_ID }}";

// 1) 移除舊的搜尋/評估節點
const REMOVE = ["2·組合搜尋關鍵字", "2·Serper 搜尋", "2·彙整搜尋結果", "2·是否 MOCK_GEMINI？", "2·假 AI 結果（測試用）", "2·AI 評估相關性"];
j.nodes = j.nodes.filter((n) => !REMOVE.includes(n.name));
for (const r of REMOVE) delete j.connections[r];

// 2) Perplexity 研究 prompt（用品牌 theme 當領域）
const researchText = `=你是公司的行銷長，為「{{ $('2·讀取品牌資料').first().json.theme || '社群行銷' }}」這個領域做收名單行銷內容策劃。
品牌：{{ $('2·讀取品牌資料').first().json.brand_name || '' }}；目標受眾：{{ $('2·讀取品牌資料').first().json.target_audience || '一般大眾' }}。
{{ $('2·驗證請求').first().json.search_keyword ? '使用者特別想聚焦的關鍵字：' + $('2·驗證請求').first().json.search_keyword : '' }}

請搜尋近一個月內、台灣（排除中國大陸）與此領域相關、且與「職涯／轉職／高薪／人才／趨勢／大數據報告」其中一項有關的最新重要時事。
條件：必須是整體環境趨勢或重大事件、瀏覽量高、有大數據佐證（報告/統計/調查），不能是單一品牌廣告或促銷。

請列出最多 7 則，每則務必包含：
1. 標題（吸睛繁體中文短句，融合恐懼與利好概念；若為國外新聞，標題結尾加上對台灣職場的關聯/影響）
2. 日期（yyyy-MM-dd）
3. 網址
4. 瀏覽量（概略阿拉伯數字）
5. 恐懼鉤子（一句話：不行動就會落後／被淘汰）
6. 利好理由（一句話：掌握後能得到什麼好處／站上什麼位置）
只輸出條列內容，不要其他說明。`;

const perplexityAgent = {
  parameters: { promptType: "define", text: researchText, options: {} },
  type: "@n8n/n8n-nodes-langchain.agent",
  typeVersion: 3,
  position: [1180, 1240],
  id: "w2-perplexity-agent",
  name: "2·Perplexity 時事研究",
};
const openRouterModel = {
  parameters: { model: "perplexity/sonar-pro", options: {} },
  type: "@n8n/n8n-nodes-langchain.lmChatOpenRouter",
  typeVersion: 1,
  position: [1180, 1460],
  id: "w2-openrouter-model",
  name: "2·OpenRouter Model",
  credentials: OPENROUTER_CRED,
};

// 3) 整理時事（Gemini HTTP）→ 輸出純 JSON 陣列
const geminiBody =
  "={{ JSON.stringify({" +
  " systemInstruction: { parts: [{ text: '你是社群內容策略專家。把使用者提供的時事清單整理成純 JSON 陣列（不要 markdown 包裹），最多 7 筆，依重要性/瀏覽量由高到低。每個項目包含：topic_title(繁中吸睛標題)、source_url、relevance_score(0-100整數)、brand_relevance(一句話說明與品牌關聯)、suggested_angles(3種撰寫角度用、分隔)、content_type(從 教學/案例分享/觀點/工具評測/趨勢 擇一)、views(瀏覽量純數字字串)、fear(恐懼鉤子一句)、benefit(利好理由一句)。' }] }," +
  " contents: [{ role: 'user', parts: [{ text: ('品牌主題：' + ($('2·讀取品牌資料').first().json.theme || '') + '\\n\\n時事清單：\\n' + ($('2·Perplexity 時事研究').first().json.output || '')) }] }]," +
  " generationConfig: { temperature: 0.3 }" +
  "}) }}";
const organizeNode = {
  parameters: {
    method: "POST",
    url: "=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={{ $env.GEMINI_API_KEY }}",
    sendHeaders: true,
    headerParameters: { parameters: [{ name: "Content-Type", value: "application/json" }] },
    sendBody: true,
    specifyBody: "json",
    jsonBody: geminiBody,
    options: { retry: { maxTries: 3 } },
  },
  type: "n8n-nodes-base.httpRequest",
  typeVersion: 4.2,
  position: [1440, 1240],
  id: "w2-organize",
  name: "2·整理時事",
};

// 4) 修改「2·解析 AI 結果」：加上新欄位
const parse = j.nodes.find((n) => n.name === "2·解析 AI 結果");
parse.parameters.jsCode = `const req = $('2·驗證請求').first().json;
const brandId = req.brand_id;
const brandTheme = $('2·讀取品牌資料').first().json.theme || '';
const response = $input.first().json;
const content = response.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
let topics;
try {
  const cleaned = content.replace(/\`\`\`json\\n?/g, '').replace(/\`\`\`\\n?/g, '').trim();
  topics = JSON.parse(cleaned);
} catch (e) { topics = []; }
topics = (Array.isArray(topics) ? topics : []).slice(0, 7);
const now = new Date().toISOString();
return topics.map((t, i) => ({
  json: {
    topic_id: \`topic-\${Date.now()}-\${i}\`,
    brand_id: brandId,
    topic_title: t.topic_title || t['標題'] || '',
    source_url: t.source_url || t['網址'] || '',
    relevance_score: String(t.relevance_score || 0),
    status: 'pending',
    brand_relevance: t.brand_relevance || '',
    suggested_angles: t.suggested_angles || '',
    content_type: t.content_type || req.content_type || '',
    target_reader: req.target_reader || '',
    search_keyword: req.search_keyword || '',
    archived_at: '',
    created_at: now,
    '領域': brandTheme,
    '瀏覽量': String(t.views || t['瀏覽量'] || ''),
    '恐懼鉤子': t.fear || t['恐懼鉤子'] || '',
    '利好理由': t.benefit || t['利好理由'] || ''
  }
}));`;

// 5) 修改「2·寫入主題」：加 4 個新欄位到 value + schema
const writeTopics = j.nodes.find((n) => n.name === "2·寫入主題");
const cv = writeTopics.parameters.columns.value;
cv["領域"] = "={{ $json['領域'] }}";
cv["瀏覽量"] = "={{ $json['瀏覽量'] }}";
cv["恐懼鉤子"] = "={{ $json['恐懼鉤子'] }}";
cv["利好理由"] = "={{ $json['利好理由'] }}";
for (const id of ["領域", "瀏覽量", "恐懼鉤子", "利好理由"]) {
  writeTopics.parameters.columns.schema.push({ id, displayName: id, required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true });
}

// 6) 新增「2·寫入時事」（append 到 時事 分頁，統一資料層）
const writeShishi = {
  parameters: {
    operation: "append",
    documentId: { __rl: true, mode: "id", value: SS },
    sheetName: { __rl: true, mode: "list", value: "326635734", cachedResultName: "時事" },
    columns: {
      mappingMode: "defineBelow",
      value: {
        "日期": "={{ ($json.created_at || '').slice(0,10) }}",
        "瀏覽量": "={{ $json['瀏覽量'] }}",
        "標題": "={{ $json.topic_title }}",
        "領域": "={{ $json['領域'] }}",
        "網址": "={{ $json.source_url }}",
        "恐懼": "={{ $json['恐懼鉤子'] }}",
        "利好": "={{ $json['利好理由'] }}",
      },
      matchingColumns: [],
      schema: ["日期", "瀏覽量", "標題", "領域", "網址", "恐懼", "利好"].map((id) => ({ id, displayName: id, required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true })),
    },
    options: {},
  },
  type: "n8n-nodes-base.googleSheets",
  typeVersion: 4.5,
  position: [2100, 1420],
  id: "w2-write-shishi",
  name: "2·寫入時事",
  credentials: SHEETS_CRED,
};

j.nodes.push(perplexityAgent, openRouterModel, organizeNode, writeShishi);

// 7) 連線
j.connections["2·讀取品牌資料"] = { main: [[{ node: "2·Perplexity 時事研究", type: "main", index: 0 }]] };
j.connections["2·OpenRouter Model"] = { ai_languageModel: [[{ node: "2·Perplexity 時事研究", type: "ai_languageModel", index: 0 }]] };
j.connections["2·Perplexity 時事研究"] = { main: [[{ node: "2·整理時事", type: "main", index: 0 }]] };
j.connections["2·整理時事"] = { main: [[{ node: "2·解析 AI 結果", type: "main", index: 0 }]] };
// 解析 → 寫入主題（既有）；寫入主題 → 寫入時事 → 批次觸發產文
j.connections["2·解析 AI 結果"] = { main: [[{ node: "2·寫入主題", type: "main", index: 0 }]] };
j.connections["2·寫入主題"] = { main: [[{ node: "2·寫入時事", type: "main", index: 0 }]] };
j.connections["2·寫入時事"] = { main: [[{ node: "2·批次觸發產文", type: "main", index: 0 }]] };

writeFileSync(FILE, JSON.stringify(j, null, 2), "utf8");
console.log("✓ 區段2 已改為 Perplexity 時事研究。總節點數：" + j.nodes.length);
