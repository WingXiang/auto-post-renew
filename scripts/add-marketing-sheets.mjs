// 把「行銷訓練」的分頁整合進 AutoPost 試算表，並為 topics 表新增行銷欄位
import { readFileSync } from "node:fs";
import { google } from "googleapis";

const env = {};
for (const line of readFileSync("./.env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2];
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  env[m[1]] = v;
}
const SPREADSHEET_ID = env.GOOGLE_SHEETS_SPREADSHEET_ID;
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

// 新分頁與標題（取自行銷訓練結構）
const NEW_SHEETS = {
  領域: ["領域名稱"],
  時事: ["日期", "瀏覽量", "標題", "領域", "網址", "恐懼", "利好"],
  切角: ["name", "example"],
  誘餌: ["name", "example"],
  優秀腳本: ["逐字稿"],
  全部組合: ["日期", "領域", "時事選題", "切角", "誘餌", "AI腳本", "人工腳本", "CPL", "邀約率", "成交率"],
};

// topics 表要新增的欄位
const TOPICS_NEW_COLS = ["領域", "瀏覽量", "恐懼鉤子", "利好理由"];

const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
const existing = new Set(meta.data.sheets.map((s) => s.properties.title));

// 1) 建立缺少的分頁
const addReqs = [];
for (const name of Object.keys(NEW_SHEETS)) {
  if (!existing.has(name)) addReqs.push({ addSheet: { properties: { title: name } } });
}
if (addReqs.length) {
  await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests: addReqs } });
  console.log(`✓ 新增分頁：${addReqs.map((r) => r.addSheet.properties.title).join("、")}`);
} else {
  console.log("（所有新分頁已存在，略過建立）");
}

// 2) 寫入新分頁的標題列（若第一列為空）
for (const [name, headers] of Object.entries(NEW_SHEETS)) {
  const hr = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${name}!1:1` });
  if (!hr.data.values || hr.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${name}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
    console.log(`  ✓ ${name} 標題：${headers.join(", ")}`);
  } else {
    console.log(`  （${name} 已有標題，略過）`);
  }
}

// 3) topics 表新增欄位（append 到現有標題列尾端，不動既有欄位）
const tr = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `topics!1:1` });
const topicHeaders = tr.data.values?.[0] ?? [];
const toAdd = TOPICS_NEW_COLS.filter((c) => !topicHeaders.includes(c));
if (toAdd.length) {
  const newHeaders = [...topicHeaders, ...toAdd];
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `topics!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [newHeaders] },
  });
  console.log(`✓ topics 新增欄位：${toAdd.join(", ")}（現有欄位保留）`);
} else {
  console.log("（topics 欄位已是最新，略過）");
}

console.log("\n完成。");
