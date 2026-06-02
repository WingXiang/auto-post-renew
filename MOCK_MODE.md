# Mock 模式 — 無 quota 限制測試指南

這份檔案記錄所有為了「不用 Gemini 額度也能完整測試」而做的修改，
以及怎麼開、怎麼關、怎麼還原。

---

## 一、目前狀態（2026-06-02）

| 項目 | 狀態 | 說明 |
|---|---|---|
| n8n workflow `主題探索` | ✅ 已加 mock 分支 | `MOCK_GEMINI=true` 時跳過 Gemini |
| n8n workflow `文案產生` | ✅ 已加 mock 分支 | 同上 |
| Zeabur env `MOCK_GEMINI` | ⏸ **尚未設定**（預設關閉） | 需要你親自加 |
| Gemini model | hardcoded `gemini-2.5-flash` | 不再讀 `$env.GEMINI_MODEL` |

---

## 二、要開啟 Mock 模式（無限測試）

### Step 1. 到 Zeabur 加 env

兩個服務 **都要** 加：
- `wing` 服務（n8n 主機）
- `wing-worker` 服務（n8n-worker，如果有）

新增 env：
```
MOCK_GEMINI=true
```

### Step 2. 重啟兩個服務

每個服務點「重啟目前版本」即可，**不需要重新部署**。

### Step 3. 驗證

打開 https://auto-post-renew.vercel.app/topics → 按「+ 搜尋新主題」→ 隨便填關鍵字 → 開始搜尋。

預期：
- 約 5 秒內出現 7 個主題，標題都以「**【測試】**」開頭
- 接著 fan-out 開始派送 7 個產文（每 15 秒一個 → 約 105 秒完成）
- 每篇貼文 caption 開頭是「🚀【測試模式】」
- 圖片仍是 `https://i.ibb.co/VchfbRqg/content.jpg`
- 全程不消耗任何 Gemini 額度

如果還是看到 quota 錯誤 → env 沒生效，回 Step 1 確認兩個服務都有 + 都重啟過。

---

## 三、要切回真 Gemini（正式使用）

### Step 1. 在 Zeabur 把 env 改掉

兩個服務都做：
- 把 `MOCK_GEMINI=true` 刪掉，**或** 改成 `MOCK_GEMINI=false`

### Step 2. 重啟兩個服務

點「重啟目前版本」。

### Step 3. 確認 GEMINI_API_KEY 有效 + 有額度

- 到 https://aistudio.google.com/apikey 看 key 與用量
- 若 free tier 不夠用，把 GCP project 開啟 billing（會變成 paid tier，限額大很多）

### Step 4. 驗證

同樣按搜尋新主題。預期：
- 真實 7 個主題（標題不會有「【測試】」）
- 真實 caption（不會出現「🚀【測試模式】」字樣）

---

## 四、所有為了 mock + quota 修過的東西（之後想完全還原時用）

### A. n8n workflow 變更（直接透過 REST API 改的）

| Workflow | 節點 | 改動 |
|---|---|---|
| 主題探索 | `AI 評估相關性` HTTP node | URL 改成 hardcoded `models/gemini-2.5-flash`（原本是 `models/{{ $env.GEMINI_MODEL || 'gemini-2.0-flash' }}`） |
| 主題探索 | `是否 MOCK_GEMINI？` (IF) | **新增** — 檢查 `$env.MOCK_GEMINI === 'true'` |
| 主題探索 | `假 AI 結果（測試用）` (Code) | **新增** — 回 7 個固定假主題 |
| 主題探索 | `批次觸發產文` (Code) | 從 `Promise.allSettled` 平行 → 改成 `for` 循序 + 15s `setTimeout` 間隔 |
| 主題探索 | `記錄完成` message | 改寫成「找到 N 個，已開始依序產生 N 篇文案（每篇間隔 15 秒，預計 2 分鐘完成）」 |
| 文案產生 | `AI 生成貼文` HTTP node | URL 同樣硬碼為 `gemini-2.5-flash`；`retryOnFail=true, maxTries=4, waitBetweenTries=8000` |
| 文案產生 | `是否 MOCK_GEMINI？` (IF) | **新增** |
| 文案產生 | `假 貼文回應（測試用）` (Code) | **新增** — 回固定 caption + image_prompt + hashtags |

連線變動：
- `主題探索`: `彙整搜尋結果 → 是否 MOCK_GEMINI？` → true 走 `假 AI 結果`、false 走 `AI 評估相關性`，兩條都接到 `解析 AI 結果`
- `文案產生`: `準備 AI 提示 → 是否 MOCK_GEMINI？` → true 走 `假 貼文回應`、false 走 `AI 生成貼文`，兩條都接到 `解析貼文`

本機檔 `n8n-workflows/02-topic-discovery.json` 與 `n8n-workflows/03-content-generation.json` 已同步。

### B. 為了還原成「100% 原版」要做的事

1. **把 mock node + IF node 刪掉**（如果不想留著當測試開關）：
   - 主題探索：刪 `是否 MOCK_GEMINI？` + `假 AI 結果（測試用）`，把 `彙整搜尋結果 → AI 評估相關性` 直接重接
   - 文案產生：刪 `是否 MOCK_GEMINI？` + `假 貼文回應（測試用）`，把 `準備 AI 提示 → AI 生成貼文` 直接重接

2. **把 Gemini model URL 改回 env 變數**（如果要重新支援 `GEMINI_MODEL` env）：
   - 兩個 workflow 的 URL 改回 `models/{{ $env.GEMINI_MODEL || 'gemini-2.0-flash' }}:generateContent?key={{ $env.GEMINI_API_KEY }}`
   - 並在 Zeabur 設 `GEMINI_MODEL=gemini-2.5-flash`（或其他想用的 model）

3. **把 fan-out 改回平行**（如果你有付費 Gemini quota，想加速）：
   - `主題探索 → 批次觸發產文` 改回 `Promise.allSettled` 模式
   - 但建議**保留 stagger**，因為 Vercel 端各個 content-generation 共用同個 SA，仍然會撞 Sheets quota

### C. Vercel 端的相關修改（commit 在 main branch）

| 檔案 | 改動 | 目的 |
|---|---|---|
| `src/lib/google-sheets.ts` | 加 `bulkUpdateColumn()` helper | 取代 N 次 `updateRow` 避免 Sheets quota |
| `src/app/api/topics/route.ts` | `discover` + `archive_all` 改用 bulkUpdate | 同上 |
| `src/app/api/schedules/route.ts` | `autoFillSchedule` 改用 bulkUpdate | 同上 |
| `src/components/pipeline-sidebar.tsx` | 加 `WORKFLOW_LABEL` 中文 map | 讓 sidebar 不再顯示英文 workflow_name |
| `src/proxy.ts` | DEV_BYPASS_AUTH production fail-safe | 防 prod 環境誤開後門 |
| `src/lib/redact.ts` | runtime secret 遮罩 | 防 API 錯誤訊息 echo token |
| `.gitignore` + `scripts/check-secrets.mjs` + `.githooks/pre-commit` | pre-commit secret 掃描 | 防 commit 入 secret |

---

## 五、Mock 模式下哪些功能仍會打真 API（要注意）

| 功能 | 仍打真 API？ | 影響 |
|---|---|---|
| 主題搜尋 | ❌ 不打 Gemini | 完全 mock |
| 文案產生 | ❌ 不打 Gemini | 完全 mock |
| 立即發布到 FB / IG | ✅ 真打 Meta Graph API | **真的會發貼文！** 測試時請小心 |
| Vercel Blob 圖片上傳 | ✅ 真上傳 | 無實質風險（用免費額度） |
| Google Sheets 讀寫 | ✅ 真讀寫 | 受 SA quota 60 read/min 限制 |
| URL fetch 測試 | ✅ 真抓 | 公開內容無風險 |

**重要**：發布到 FB / IG 不能 mock — 一按「立即發布」就會真的發到你的粉專。
如果只想測 UI 不想真發，**改用「測試品牌」** 或暫時把 brand 的 `meta_access_token` 清空。

---

## 六、Mock 資料內容（預先知道你會看到什麼）

### 主題（7 個）
1. 【測試】2026 一人公司 AI 自動化必備工具清單 — 工具評測 / 98
2. 【測試】從零開始：個人創業者的 AI 自動化流程拆解 — 教學 / 96
3. 【測試】一人公司年營收破千萬：他靠這 3 個 AI 自動化做到 — 案例分享 / 94
4. 【測試】別再迷信『AI 取代人類』— 一人公司真正該追的是什麼 — 觀點 / 88
5. 【測試】2026 趨勢：個人品牌 × AI Agent 新商業模式 — 趨勢 / 85
6. 【測試】Notion + AI 一人公司營運系統實戰 — 教學 / 82
7. 【測試】我用 AI 把 1 個人運作成 5 人團隊，每月省 18 小時 — 案例分享 / 80

### 貼文 caption 範本（每篇主題都會產生 FB + IG 各一篇）
```
🚀【測試模式】關於「{topic}」

想像一下：一個人，搭配對的 AI 工具，
就能完成過去 5 個人才能做的事。

三個你今天就可以開始的步驟：
1️⃣ 寫下你最花時間的 3 個重複任務
2️⃣ 找一個 AI 工具試試其中一項
3️⃣ 用 1 週評估省下的時間

「自動化不是取代你，是放大你。」

#一人公司 #AI自動化 #個人創業 #數位顧問
```

### 圖片
固定 `https://i.ibb.co/VchfbRqg/content.jpg`（mock 與非 mock 都一樣）

---

## 七、常見問題

**Q: 加 env 後重啟還是用真 Gemini？**
A: `n8n` 與 `n8n-worker` 兩個服務的 env **必須相同**。確認兩邊都有 `MOCK_GEMINI=true` 且都重啟過。

**Q: 想看真實內容測試怎麼辦？**
A: 暫時關 mock（刪 env 或設 false），跑一次（耗 1-2 RPM 配額），再開回 mock。

**Q: Mock 模式會影響 production 使用者嗎？**
A: 會。env 是 process-wide，所有打到該 n8n 的請求都走 mock。所以 **正式上線前一定要把 mock env 關掉**。
