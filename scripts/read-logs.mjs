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
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });
const res = await sheets.spreadsheets.values.get({
  spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
  range: "pipeline_logs!A:Z",
});
const rows = res.data.values || [];
if (rows.length < 2) { console.log("pipeline_logs 無資料"); process.exit(0); }
const headers = rows[0];
const recent = rows.slice(1).slice(-10);
for (const r of recent) {
  const o = {};
  headers.forEach((h, i) => (o[h] = r[i] ?? ""));
  console.log(`[${o.workflow_name}] ${o.status} | ${o.message} | start=${o.started_at} | end=${o.finished_at}`);
}
