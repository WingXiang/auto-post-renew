#!/usr/bin/env node
/**
 * 掃描將要 commit 的內容是否包含明文 secret。
 * - 用 `git diff --cached` 取得 staged diff（只看新增行）
 * - 比對常見 secret 模式，命中即 fail（exit 1）
 * - 可由 .githooks/pre-commit 呼叫，或 CI 上手動跑：
 *     node scripts/check-secrets.mjs [--all]   # --all 改掃整個 working tree
 *
 * 純 Node，不依賴外部套件，Windows / macOS / Linux 皆可。
 */
import { execSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const SCAN_ALL = process.argv.includes("--all");

// (name, regex, hint) — 命中即視為洩漏
const PATTERNS = [
  ["Google API key", /\bAIza[0-9A-Za-z_\-]{30,}\b/g, "可能是 GEMINI / Maps / Firebase key"],
  ["OpenAI key", /\bsk-[A-Za-z0-9]{20,}\b/g, "OpenAI secret key"],
  ["Anthropic key", /\bsk-ant-[A-Za-z0-9_\-]{20,}\b/g, "Anthropic secret key"],
  ["Meta access token", /\bEAA[A-Za-z0-9]{60,}\b/g, "Facebook / Instagram access token"],
  ["Vercel Blob RW token", /\bvercel_blob_rw_[A-Za-z0-9_]{20,}\b/g, "Vercel Blob 讀寫權杖"],
  ["Clerk secret key", /\bsk_(test|live)_[A-Za-z0-9]{20,}\b/g, "Clerk secret key"],
  ["Clerk webhook secret", /\bwhsec_[A-Za-z0-9+/=]{20,}\b/g, "Clerk webhook signing secret"],
  ["Serper API key", /\b[a-f0-9]{40}\b/g, "Serper 40-char hex（誤報率高，請人工確認）"],
  ["PEM private key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g, "PEM 格式私鑰"],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/g, "AWS access key id"],
  ["GitHub token", /\bghp_[A-Za-z0-9]{30,}\b/g, "GitHub personal access token"],
  ["JWT (3-part)", /\beyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b/g, "JWT — 可能是 n8n API key 或 Clerk session token"],
];

// 不掃這些副檔名 / 路徑
const SKIP_PATH = /(^|\/)(node_modules|\.next|\.git|coverage|dist|build|out)(\/|$)|\.(lock|map|min\.js|woff2?|ttf|otf|png|jpg|jpeg|gif|webp|ico|pdf|zip|gz|tar|svg)$/i;

// 同一檔案內若整行符合這些 marker 就跳過（給合理註解、範例用）
const ALLOW_INLINE = /(secrets-allow|pragma: allowlist secret|example|placeholder)/i;

function getStagedFiles() {
  const out = execSync("git diff --cached --name-only --diff-filter=ACM", { encoding: "utf8" });
  return out.split(/\r?\n/).filter(Boolean);
}

function getStagedContent(path) {
  try {
    return execSync(`git show :${JSON.stringify(path).slice(1, -1)}`, { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
  } catch {
    return "";
  }
}

function getAllTrackedFiles() {
  const out = execSync("git ls-files", { encoding: "utf8" });
  return out.split(/\r?\n/).filter(Boolean);
}

function readWorking(path) {
  try {
    const stat = statSync(path);
    if (!stat.isFile() || stat.size > 50 * 1024 * 1024) return "";
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

const files = SCAN_ALL ? getAllTrackedFiles() : getStagedFiles();

if (files.length === 0) {
  process.exit(0);
}

let hits = 0;
for (const file of files) {
  if (SKIP_PATH.test(file)) continue;
  // 跳過 .env.example（為了顯示 key 名稱，會誤報）
  if (/\.env\.example$/.test(file)) continue;
  // .gitignore / SECURITY.md 本身就會提到模式
  if (/\.gitignore$/.test(file)) continue;
  if (/SECURITY\.md$/.test(file)) continue;
  // 這支腳本本身的 regex 不能誤報
  if (/scripts\/check-secrets\.mjs$/.test(file)) continue;

  const content = SCAN_ALL ? readWorking(file) : getStagedContent(file);
  if (!content) continue;

  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (ALLOW_INLINE.test(line)) continue;
    for (const [name, re, hint] of PATTERNS) {
      re.lastIndex = 0;
      const m = re.exec(line);
      if (m) {
        hits++;
        console.error(
          `\n  ✘ ${file}:${i + 1}  [${name}]` +
            `\n      ${hint}` +
            `\n      → ${line.trim().slice(0, 200)}`
        );
      }
    }
  }
}

if (hits > 0) {
  console.error(`\n偵測到 ${hits} 筆疑似 secret。`);
  console.error("如為誤報，可：");
  console.error("  1. 將該行加上「// secrets-allow」或「# pragma: allowlist secret」註解");
  console.error("  2. 或把該檔案排除進 .gitignore");
  console.error("如為真實 secret：請從這次 commit 移除，並立即輪換該金鑰。");
  process.exit(1);
}

console.log(`✓ secrets scan passed (${files.length} file${files.length === 1 ? "" : "s"} checked)`);
