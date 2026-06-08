// 清除測試資料：保留 brands（品牌設定）與 schedules（排程設定），
// 清空其餘所有「紀錄」類工作表的資料列（保留標題列）。
import { readFileSync } from "node:fs";
import { google } from "googleapis";

// 載入 .env.local
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

// 要清空的工作表（保留 brands / schedules）
const TO_CLEAR = [
  "topics",
  "posts",
  "analytics",
  "optimization_log",
  "potential_customers",
  "pipeline_logs",
];

for (const name of TO_CLEAR) {
  try {
    const before = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${name}!A:A`,
    });
    const rowCount = (before.data.values?.length ?? 0);
    const dataRows = Math.max(0, rowCount - 1);
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${name}!A2:Z`,
    });
    console.log(`✓ ${name}: 清除 ${dataRows} 筆資料（保留標題列）`);
  } catch (e) {
    console.log(`✗ ${name}: ${e.message}`);
  }
}
console.log("\n保留：brands（品牌設定）、schedules（排程設定）");
console.log("完成。");
