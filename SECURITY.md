# Secrets / 安全政策

這份檔案說明本專案哪些東西要保密、放在哪、洩漏時怎麼處理。
任何加入新外部服務的人都應該先讀過這份。

---

## 1. 哪些東西算 secret

| 類別 | 變數 / 位置 | 影響範圍 |
|---|---|---|
| Clerk | `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET` | 可登入任何使用者、偽造 webhook |
| Google Sheets SA | `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | 可讀寫整份試算表 |
| n8n | `N8N_API_KEY`（HTTP shared secret）+ Zeabur n8n 的 admin password、PostgreSQL 密碼 | 可觸發任一 workflow |
| Gemini | `GEMINI_API_KEY` | 計入帳單 |
| Serper | `SERPER_API_KEY` | 計入帳單 |
| Vercel Blob | `BLOB_READ_WRITE_TOKEN` | 可寫入 / 刪除任何 blob |
| Anthropic | `ANTHROPIC_API_KEY` | 計入帳單 |
| Meta | 各品牌的 `meta_access_token`（存於 Google Sheets `brands` sheet） | 可發 / 刪該粉專所有貼文、讀私訊 |

---

## 2. Secret 放在哪

| 環境 | 位置 |
|---|---|
| 本機開發 | `.env.local`（已 .gitignore） |
| Vercel production | Vercel Dashboard → Settings → Environment Variables |
| n8n production | Zeabur Service → Environment（n8n 與 n8n-worker **必須完全相同**） |
| 多品牌 Meta token | Google Sheets `brands` sheet → `meta_access_token` 欄 |

**永遠不要**：
- 把真實 secret 寫進 `.env.example`
- 把 secret 直接貼進 commit / PR / issue
- 把 secret 貼進對話視窗給 AI 助手（包括這個 repo 的 Claude）
- 用 `git add -A` 或 `git add .`（容易意外把 dump 檔加進去）

---

## 3. 已部署的防洩漏機制

1. **`.gitignore`** — 排除 `.env*.local`、`_*.py`、所有 `exec*/ee*/cg*/ps*/wf*/e*.json` dump、`*.key`/`*.pem`/`*.p8`/`service-account*.json` 等
2. **`scripts/check-secrets.mjs`** — pre-commit 掃 staged content，命中 secret pattern 即擋下
3. **`.githooks/pre-commit`** — 呼叫上述 script，需執行 `npm run secrets:install-hooks` 啟用
4. **`src/lib/redact.ts`** — `redactSecrets()` / `redactError()` 把 API key / token / private key 從錯誤訊息中遮罩；已套用到 `src/lib/n8n.ts`, `src/app/api/upload-base64`, `src/app/api/brands/test-meta`, `src/app/api/email-generate`
5. **`/api/upload-base64`** — n8n shared-secret 用 timing-safe 比較
6. **`src/proxy.ts`** — Clerk 中介層只讓必要 webhook / upload endpoint 對外開放

---

## 4. 開發者第一次 clone repo 要做的事

```bash
cp .env.example .env.local
# 然後手動填值 — 永遠不要從別人對話視窗複製貼上完整 token

npm install
npm run secrets:install-hooks   # 啟用 pre-commit 掃描

# 確認沒有 secret 已經混進工作樹
npm run secrets:scan-all
```

---

## 5. Secret 洩漏處理 SOP

如果發現某個 key 已經外流（commit 進 repo、貼到 chat、終端輸出截圖被分享等），照以下順序處理：

### 5.1 立刻輪換

| Secret | 輪換方法 |
|---|---|
| `CLERK_SECRET_KEY` | Clerk Dashboard → API Keys → Roll Secret Key |
| `CLERK_WEBHOOK_SECRET` | Clerk Dashboard → Webhooks → 該 endpoint → Roll signing secret |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | GCP Console → IAM & Admin → Service Accounts → Keys → 新建一把 → 把舊的 disable / delete |
| `N8N_API_KEY` | 自己決定的字串。在 Vercel **與** Zeabur (n8n + n8n-worker) 三處同步換新；重啟 n8n + worker |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey → Revoke 舊 key → Create new |
| `SERPER_API_KEY` | https://serper.dev → Dashboard → Regenerate |
| `BLOB_READ_WRITE_TOKEN` | Vercel Dashboard → Storage → Blob store → Tokens → Revoke + Generate |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com → Settings → API keys → Revoke + Create |
| Meta access token | Meta Business Suite → Settings → Users → 該 system user → 重新 Generate Token；然後到 Google Sheets `brands` sheet 把 `meta_access_token` 欄手動更新（每個受影響品牌） |

### 5.2 更新所有部署點

每次輪換完，請確認 **三個地方** 都同步：
1. `.env.local`（本機）
2. Vercel production env vars → Redeploy
3. Zeabur n8n + n8n-worker env vars → 兩個服務都要重啟

### 5.3 清掉 git 歷史（如果是被 commit 到 repo）

```bash
# 用 git filter-repo（推薦）或 BFG Repo-Cleaner 移除歷史中的字串
git filter-repo --replace-text <(echo '舊token==>REDACTED')
git push --force origin <branch>
```

**注意**：filter-repo / force push 不會把已經 clone 的本機備份、CI 紀錄、第三方鏡像清掉。所以「輪換 key」永遠是第一步，清歷史只是事後補救。

### 5.4 檢查是否有人用洩漏的 key

- Google Cloud → Logging → API key usage
- Meta：Business Suite → Activity Log
- n8n：`https://wing.zeabur.app/executions` 看有沒有非預期觸發
- Vercel → Blob → 看 unexpected uploads

---

## 6. 本機腳本 (`_*.py`) 政策

`_*.py` 是一次性 admin / debug 腳本（會讀 `.env.local`、可能把 token 寫進變數），永遠不會被 commit。
寫新腳本一律以 `_` 開頭，已被 `.gitignore` 自動排除。

---

## 7. AI 助手互動規則（本專案特有）

這個 repo 主要由 Claude 協助維護。對話過程中：

- AI **不會**主動將完整 API key 貼回對話視窗 — 即使檔案裡讀到也會用遮罩
- 真實 secret 由使用者本人填入 Vercel / Zeabur / Clerk / GCP 介面，不透過 chat 中轉
- AI 寫的腳本若需要 token，會從 `.env.local` 讀，不會 hardcode

如果你發現 AI 在輸出中包含真實的 key 字串，請立刻：
1. 停止對話、不要把該回覆 copy/paste 到任何地方
2. 將該 key 視為已洩漏，照第 5 節輪換
