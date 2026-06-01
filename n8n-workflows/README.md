# n8n Workflows — 社群媒體內容發文產線

## 匯入步驟

1. 開啟你的 n8n 實例
2. 點擊左側選單 → **Workflows**
3. 點擊右上角 **⋮** → **Import from File**
4. 依序匯入以下 8 個 JSON 檔案

## Workflow 清單

| # | 檔案 | Webhook 路徑 | 說明 |
|---|------|-------------|------|
| 1 | `01-brand-setup.json` | `/webhook/brand-setup` | 新品牌建立時初始化 |
| 2 | `02-topic-discovery.json` | `/webhook/topic-discovery` | Serper.dev 搜尋 + AI 評分主題 |
| 3 | `03-content-generation.json` | `/webhook/content-generation` | AI 生成貼文文案 + 圖片提示詞 |
| 4 | `04-post-scheduler.json` | `/webhook/post-scheduler` | Meta Graph API 發佈到 FB/IG |
| 5 | `05-analytics-collection.json` | `/webhook/analytics-collection` | 收集 FB/IG 互動數據 |
| 6 | `06-weekly-optimization.json` | `/webhook/weekly-optimization` | AI 週報分析 + 優化建議 |
| 7 | `07-customer-identification.json` | `/webhook/customer-identification` | AI 從留言識別潛在客戶 |
| 8 | `08-update-schedule.json` | `/webhook/update-schedule` | 同步排程設定 |

## n8n 環境變數

在 n8n 的 **Settings → Environment Variables** 中設定：

```
N8N_API_KEY=你的自訂密鑰（與 .env.local 中的 N8N_API_KEY 一致）
GOOGLE_SHEETS_SPREADSHEET_ID=你的 Google Sheets ID
SERPER_API_KEY=你的 Serper.dev API Key
OPENAI_API_KEY=你的 OpenAI API Key
OPENAI_API_BASE=https://api.openai.com（或自訂端點）
OPENAI_MODEL=gpt-4o-mini（或其他模型）
```

## n8n 憑證設定

匯入後需要設定 **Google Sheets OAuth2** 憑證：

1. n8n 左側 → **Credentials** → **Add Credential**
2. 搜尋 **Google Sheets** → 選擇 **OAuth2**
3. 按照引導完成 Google OAuth 授權
4. 回到每個 workflow，將所有 Google Sheets 節點的 credential 指向你剛建立的憑證

## 架構說明

```
Next.js App → POST /webhook/{workflow-name} → n8n Webhook
                                                  ↓
                                            驗證 API Key
                                                  ↓
                                          記錄到 pipeline_logs
                                                  ↓
                                            執行主要邏輯
                                                  ↓
                                         寫入 Google Sheets
                                                  ↓
                                          回應 JSON 結果
```

每個 workflow 都包含：
- **API Key 驗證**：透過 `x-api-key` header 驗證
- **Pipeline 記錄**：開始時寫入 running，完成時更新為 success
- **錯誤處理**：失敗時自動記錄 failed 狀態
