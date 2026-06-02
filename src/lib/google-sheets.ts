import { google, sheets_v4 } from "googleapis";

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
        /\\n/g,
        "\n"
      ),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheets(): sheets_v4.Sheets {
  return google.sheets({ version: "v4", auth: getAuth() });
}

export type SheetName =
  | "brands"
  | "topics"
  | "posts"
  | "analytics"
  | "optimization_log"
  | "potential_customers"
  | "schedules"
  | "pipeline_logs";

export async function getRows(
  sheet: SheetName,
  filterFn?: (row: Record<string, string>) => boolean
): Promise<Record<string, string>[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheet}!A:Z`,
  });

  const rows = res.data.values;
  if (!rows || rows.length < 2) return [];

  const headers = rows[0];
  const data = rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? "";
    });
    return obj;
  });

  return filterFn ? data.filter(filterFn) : data;
}

export async function getRowsByBrand(
  sheet: SheetName,
  brandId: string
): Promise<Record<string, string>[]> {
  return getRows(sheet, (row) => row.brand_id === brandId);
}

export async function appendRow(
  sheet: SheetName,
  data: Record<string, string>
): Promise<void> {
  const sheets = getSheets();
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheet}!1:1`,
  });
  const headers = headerRes.data.values?.[0] ?? [];

  const row = headers.map((h) => data[h as string] ?? "");

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheet}!A:Z`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
}

export async function updateRow(
  sheet: SheetName,
  matchColumn: string,
  matchValue: string,
  updates: Record<string, string>
): Promise<boolean> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheet}!A:Z`,
  });

  const rows = res.data.values;
  if (!rows || rows.length < 2) return false;

  const headers = rows[0];
  const matchIdx = headers.indexOf(matchColumn);
  if (matchIdx === -1) return false;

  const rowIndex = rows.findIndex(
    (row, i) => i > 0 && row[matchIdx] === matchValue
  );
  if (rowIndex === -1) return false;

  const updatedRow = [...rows[rowIndex]];
  for (const [key, value] of Object.entries(updates)) {
    const colIdx = headers.indexOf(key);
    if (colIdx !== -1) {
      while (updatedRow.length <= colIdx) updatedRow.push("");
      updatedRow[colIdx] = value;
    }
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheet}!A${rowIndex + 1}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [updatedRow] },
  });

  return true;
}

/**
 * 一次更新某個欄位多個列 — 用 single batchUpdate API call 避免 Sheets 配額爆掉。
 * matchValues / values 索引對應；若某 matchValue 找不到列就跳過。
 * 回傳實際更新的列數。
 */
export async function bulkUpdateColumn(
  sheet: SheetName,
  matchColumn: string,
  matchValues: string[],
  targetColumn: string,
  values: string[]
): Promise<number> {
  if (matchValues.length === 0) return 0;
  if (matchValues.length !== values.length) {
    throw new Error("bulkUpdateColumn: matchValues / values 長度不一致");
  }
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheet}!A:Z`,
  });
  const rows = res.data.values;
  if (!rows || rows.length < 2) return 0;
  const headers = rows[0];
  const matchIdx = headers.indexOf(matchColumn);
  const targetIdx = headers.indexOf(targetColumn);
  if (matchIdx === -1 || targetIdx === -1) return 0;

  // 把 matchValue → row 索引（1-based row in sheet = i+1）映射
  const rowByValue = new Map<string, number>();
  for (let i = 1; i < rows.length; i++) {
    const v = rows[i][matchIdx];
    if (v) rowByValue.set(v, i + 1); // sheet 是 1-based
  }

  function colLetter(n: number): string {
    let s = "";
    let x = n;
    while (true) {
      s = String.fromCharCode("A".charCodeAt(0) + (x % 26)) + s;
      if (x < 26) return s;
      x = Math.floor(x / 26) - 1;
    }
  }
  const col = colLetter(targetIdx);

  const data: { range: string; values: string[][] }[] = [];
  let n = 0;
  for (let i = 0; i < matchValues.length; i++) {
    const rowNum = rowByValue.get(matchValues[i]);
    if (!rowNum) continue;
    data.push({ range: `${sheet}!${col}${rowNum}`, values: [[values[i]]] });
    n++;
  }
  if (n === 0) return 0;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });
  return n;
}

export async function deleteRow(
  sheet: SheetName,
  matchColumn: string,
  matchValue: string
): Promise<boolean> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheet}!A:Z`,
  });

  const rows = res.data.values;
  if (!rows || rows.length < 2) return false;

  const headers = rows[0];
  const matchIdx = headers.indexOf(matchColumn);
  if (matchIdx === -1) return false;

  const rowIndex = rows.findIndex(
    (row, i) => i > 0 && row[matchIdx] === matchValue
  );
  if (rowIndex === -1) return false;

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });
  const sheetMeta = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === sheet
  );
  if (!sheetMeta?.properties?.sheetId && sheetMeta?.properties?.sheetId !== 0)
    return false;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheetMeta.properties.sheetId,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });

  return true;
}

export async function initializeSpreadsheet(): Promise<void> {
  const sheets = getSheets();

  const worksheets: { name: SheetName; headers: string[] }[] = [
    {
      name: "brands",
      headers: [
        "brand_id",
        "brand_name",
        "theme",
        "style",
        "tone",
        "target_audience",
        "past_content_samples",
        "past_content_urls", // NEW: JSON array of URL strings
        "fb_page_id",
        "ig_account_id",
        "meta_access_token",
        "logo_url",
        "primary_color",
        "secondary_color",
        "font_preference",
        "visual_keywords",
      ],
    },
    {
      name: "topics",
      headers: [
        "topic_id",
        "brand_id",
        "topic_title",
        "source_url",
        "relevance_score",
        "status",
        "brand_relevance",   // NEW
        "suggested_angles",  // NEW
        "content_type",      // NEW
        "target_reader",     // NEW
        "search_keyword",    // NEW
        "archived_at",       // NEW
        "created_at",
      ],
    },
    {
      name: "posts",
      headers: [
        "post_id",
        "brand_id",
        "topic_id",
        "topic_title", // NEW: cached for UI
        "platform",
        "caption",
        "image_prompt",
        "image_url",
        "scheduled_time",
        "status",
        "fb_post_id",
        "ig_post_id",
        "optimization_version",
        "created_at",
      ],
    },
    {
      name: "analytics",
      headers: [
        "analytics_id",
        "brand_id",
        "post_id",
        "platform",
        "likes",
        "comments",
        "shares",
        "reach",
        "engagement_rate",
        "collected_at",
      ],
    },
    {
      name: "optimization_log",
      headers: [
        "log_id",
        "brand_id",
        "week_start",
        "top_topics",
        "top_posts",
        "caption_guidelines",
        "image_guidelines",
        "created_at",
      ],
    },
    {
      name: "potential_customers",
      headers: [
        "customer_id",
        "brand_id",
        "display_name",
        "interaction_type",
        "interaction_content",
        "post_id",
        "suggested_action",
        "status",
        "identified_at",
      ],
    },
    {
      name: "schedules",
      headers: [
        "schedule_id",
        "brand_id",
        "weekday_mask",        // NEW: "1010101"
        "time_slots",          // NEW: JSON array of "HH:mm"
        "auto_publish_enabled", // NEW: "true" / "false"
        "frequency",           // legacy
        "post_times",          // legacy
        "topic_discovery_day", // legacy
        "analytics_day",       // legacy
        "updated_at",
      ],
    },
    {
      name: "pipeline_logs",
      headers: [
        "log_id",
        "brand_id",
        "workflow_name",
        "status",
        "message",
        "subject",   // NEW: 人話描述
        "progress",  // NEW: e.g. "3/7"
        "started_at",
        "finished_at",
      ],
    },
  ];

  const existing = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });
  const existingNames = new Set(
    existing.data.sheets?.map((s) => s.properties?.title) ?? []
  );

  for (const ws of worksheets) {
    if (!existingNames.has(ws.name)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: ws.name } } }],
        },
      });
    }

    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${ws.name}!1:1`,
    });
    if (!headerRes.data.values?.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${ws.name}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [ws.headers] },
      });
    }
  }
}
