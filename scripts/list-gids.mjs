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
const r = await google.sheets({ version: "v4", auth }).spreadsheets.get({ spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID });
console.log("Spreadsheet ID:", env.GOOGLE_SHEETS_SPREADSHEET_ID);
for (const s of r.data.sheets) console.log(`${s.properties.title} => gid ${s.properties.sheetId}`);
