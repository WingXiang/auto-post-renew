/**
 * Runtime secret redaction.
 *
 * 任何要回給前端、或要寫到 server log、或要回傳 API 錯誤訊息的字串，
 * 都應該先過 `redactSecrets()`，避免 n8n / Google / Meta 回傳的 echo
 * 把 access_token / api_key 等敏感欄位帶回 client。
 */

// 常見明文 secret pattern
const SECRET_PATTERNS: RegExp[] = [
  /AIza[0-9A-Za-z_\-]{30,}/g, // Google API key
  /sk-ant-[A-Za-z0-9_\-]{20,}/g, // Anthropic
  /sk-[A-Za-z0-9]{20,}/g, // OpenAI
  /EAA[A-Za-z0-9]{60,}/g, // Meta long-lived token
  /vercel_blob_rw_[A-Za-z0-9_]{20,}/g, // Vercel Blob
  /sk_(?:test|live)_[A-Za-z0-9]{20,}/g, // Clerk
  /whsec_[A-Za-z0-9+/=]{20,}/g, // Clerk webhook
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g, // PEM
  /eyJ[A-Za-z0-9_\-]{10,}\.eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}/g, // JWT
];

// querystring / JSON 欄位形式：key=value 或 "key":"value"
const FIELD_PATTERNS: RegExp[] = [
  /\b(access_token|api_key|apiKey|api-key|x-api-key|authorization|password|secret|private_key|token|client_secret)=([^&\s"'<>\\]+)/gi,
  /"(access_token|api_key|apiKey|password|secret|private_key|token|client_secret)"\s*:\s*"([^"]+)"/gi,
];

function maskMiddle(value: string): string {
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

/**
 * 把字串中常見 secret 模式換成「****…XXXX」遮罩。安全可重入。
 * 對 null / undefined / 非字串輸入會直接回傳，不會丟錯。
 */
export function redactSecrets(input: unknown): string {
  if (input == null) return "";
  let s = typeof input === "string" ? input : safeStringify(input);

  for (const re of SECRET_PATTERNS) {
    s = s.replace(re, (m) => `[REDACTED:${maskMiddle(m)}]`);
  }

  // 處理 key=value / "key":"value"
  s = s.replace(FIELD_PATTERNS[0], (_m, k, v) => `${k}=[REDACTED:${maskMiddle(v)}]`);
  s = s.replace(FIELD_PATTERNS[1], (_m, k, v) => `"${k}":"[REDACTED:${maskMiddle(v)}]"`);

  return s;
}

/**
 * 對 error 做安全字串化 — 不會把 stack trace 拿來原樣噴出。
 */
export function redactError(err: unknown): string {
  if (err instanceof Error) return redactSecrets(err.message);
  return redactSecrets(err);
}

function safeStringify(v: unknown): string {
  try {
    return typeof v === "object" ? JSON.stringify(v) : String(v);
  } catch {
    return String(v);
  }
}
