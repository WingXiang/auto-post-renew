"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Card,
  PageHeader,
  Button,
  Input,
  Textarea,
  Spinner,
  HelpIcon,
  Badge,
} from "@/components/ui";
import { OnboardingStepBar } from "@/components/onboarding-stepbar";
import type { Brand } from "@/types";

interface UrlPreview {
  loading?: boolean;
  title?: string;
  excerpt?: string;
  source_type?: string;
  error?: string;
}

function parseUrls(raw: string): string[] {
  if (!raw) return [];
  try {
    const j = JSON.parse(raw);
    if (Array.isArray(j)) return j.filter((s) => typeof s === "string");
  } catch {
    /* legacy: 視為單行 URL 列表 */
    return raw
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export default function BrandPage() {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // URL list state
  const [urls, setUrls] = useState<string[]>([]);
  const [previews, setPreviews] = useState<Record<number, UrlPreview>>({});

  const fetchBrand = useCallback(() => {
    fetch("/api/brands", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setBrand(d.brand);
        setUrls(parseUrls(d.brand?.past_content_urls ?? ""));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchBrand();
  }, [fetchBrand]);

  const handleSave = () => {
    if (!brand) return;
    setSaving(true);
    fetch("/api/brands", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...brand,
        past_content_urls: JSON.stringify(urls.filter((u) => u.trim())),
      }),
    })
      .then((r) => r.json())
      .then(() => alert("儲存成功"))
      .catch(() => alert("儲存失敗"))
      .finally(() => setSaving(false));
  };

  const handleTestConnection = () => {
    if (!brand?.meta_access_token) {
      setTestResult("請先輸入 Meta Access Token");
      return;
    }
    setTesting(true);
    setTestResult(null);
    fetch("/api/brands/test-meta", { method: "POST" })
      .then((res) =>
        res.json().then((data) => ({ ok: res.ok, data }))
      )
      .then(({ ok, data }) => {
        if (ok) {
          const parts: string[] = [];
          if (data.fb_page_name) parts.push(`FB Page: ${data.fb_page_name}`);
          if (data.ig_username) parts.push(`IG: @${data.ig_username}`);
          setTestResult(
            parts.length ? `連線成功！${parts.join("，")}` : "連線成功"
          );
        } else {
          setTestResult(
            `連線失敗：${data.error || "請確認 Token、Page ID、IG ID"}`
          );
        }
      })
      .catch(() => setTestResult("連線失敗，請檢查網路連線"))
      .finally(() => setTesting(false));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !brand) return;
    if (!file.type.startsWith("image/")) {
      alert("請選擇圖片檔");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("檔案不能超過 5MB");
      return;
    }
    setUploadingLogo(true);
    const formData = new FormData();
    formData.append("file", file);
    fetch("/api/upload", { method: "POST", body: formData })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok && data.url) update("logo_url", data.url);
        else alert(`上傳失敗：${data.error || "未知錯誤"}`);
      })
      .catch(() => alert("上傳失敗"))
      .finally(() => {
        setUploadingLogo(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      });
  };

  const update = (field: keyof Brand, value: string) => {
    setBrand((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const updateUrl = (i: number, v: string) =>
    setUrls((arr) => arr.map((x, idx) => (idx === i ? v : x)));
  const removeUrl = (i: number) => {
    setUrls((arr) => arr.filter((_, idx) => idx !== i));
    setPreviews((p) => {
      const np: Record<number, UrlPreview> = {};
      Object.entries(p).forEach(([k, v]) => {
        const n = Number(k);
        if (n < i) np[n] = v;
        else if (n > i) np[n - 1] = v;
      });
      return np;
    });
  };
  const addUrl = () => setUrls((arr) => [...arr, ""]);
  const testUrl = (i: number) => {
    const url = urls[i]?.trim();
    if (!url) return;
    setPreviews((p) => ({ ...p, [i]: { loading: true } }));
    fetch("/api/brands/fetch-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    })
      .then((r) => r.json())
      .then((d) =>
        setPreviews((p) => ({
          ...p,
          [i]: d.error
            ? { error: d.error }
            : { title: d.title, excerpt: d.excerpt, source_type: d.source_type },
        }))
      )
      .catch((e) =>
        setPreviews((p) => ({ ...p, [i]: { error: String(e) } }))
      );
  };

  if (loading) return <Spinner />;
  if (!brand)
    return (
      <div className="text-center text-gray-500">
        請先建立品牌（選擇或建立 Organization）
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl">
      <OnboardingStepBar />

      <PageHeader
        title="品牌設定"
        description="這些設定是 AI 寫文的依據。填得越完整，AI 寫得越像你的品牌風格。"
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "儲存中..." : "儲存設定"}
            </Button>
            <HelpIcon text="品牌名稱 / 主題 / 語調 / 目標受眾 / Meta Token 是必填，AI 才能正確寫文與發佈。視覺識別影響未來自動產圖。" />
          </div>
        }
      />

      <div className="space-y-6">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">基本資料</h2>
          <div className="space-y-4">
            <Input
              label="品牌名稱"
              value={brand.brand_name}
              onChange={(e) => update("brand_name", e.target.value)}
            />
            <Input
              label="品牌主題"
              value={brand.theme}
              onChange={(e) => update("theme", e.target.value)}
              placeholder="如：永續時尚、健康生活"
            />
            <Input
              label="風格"
              value={brand.style}
              onChange={(e) => update("style", e.target.value)}
              placeholder="如：簡約、活潑、高端"
            />
            <Input
              label="語調"
              value={brand.tone}
              onChange={(e) => update("tone", e.target.value)}
              placeholder="如：專業、親切、幽默"
            />
            <Textarea
              label="目標受眾描述"
              value={brand.target_audience}
              onChange={(e) => update("target_audience", e.target.value)}
              rows={3}
              placeholder="描述你的目標受眾特徵..."
            />
          </div>
        </Card>

        {/* 過去貼文範例：URL 列表 */}
        <Card>
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-lg font-semibold">過去貼文範例</h2>
            <HelpIcon text="貼上你已經寫過的文章或社群貼文 URL（可以是部落格、Medium、自家網站、或公開的 FB / IG 貼文）。AI 會閱讀內容學你的寫作風格。" />
          </div>
          <p className="mb-4 text-sm text-gray-500">
            可以是你寫過的部落格、Medium、自家網站文章，或公開的 Facebook / Instagram
            貼文 URL。
          </p>
          <div className="space-y-3">
            {urls.length === 0 && (
              <div className="rounded-md border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
                還沒貼任何 URL — 按下方「+ 加一筆」開始
              </div>
            )}
            {urls.map((u, i) => {
              const preview = previews[i];
              return (
                <div key={i} className="space-y-2 rounded-md border border-gray-200 p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={u}
                      onChange={(e) => updateUrl(i, e.target.value)}
                      placeholder="https://..."
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => testUrl(i)}
                      disabled={!u.trim() || preview?.loading}
                    >
                      {preview?.loading ? "抓取中..." : "測試"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeUrl(i)}
                    >
                      移除
                    </Button>
                  </div>
                  {preview && !preview.loading && (
                    <div className="rounded-md bg-gray-50 px-3 py-2 text-xs">
                      {preview.error ? (
                        <span className="text-red-600">
                          ⚠ 無法解析：{preview.error}
                        </span>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <Badge color="blue">
                              {preview.source_type === "fb"
                                ? "Facebook"
                                : preview.source_type === "ig"
                                ? "Instagram"
                                : "公開網頁"}
                            </Badge>
                            <span className="font-medium text-gray-900">
                              {preview.title}
                            </span>
                          </div>
                          {preview.excerpt && (
                            <p className="mt-1 line-clamp-3 text-gray-600">
                              {preview.excerpt.slice(0, 200)}
                              {preview.excerpt.length > 200 ? "…" : ""}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <Button size="sm" variant="secondary" onClick={addUrl}>
              + 加一筆
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold">視覺識別</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                品牌 Logo
              </label>
              <div className="flex items-center gap-4">
                {brand.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={brand.logo_url}
                    alt="Logo"
                    className="h-20 w-20 rounded-md border border-gray-200 bg-white object-contain"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed border-gray-300 text-xs text-gray-400">
                    未上傳
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLogo}
                  >
                    {uploadingLogo
                      ? "上傳中..."
                      : brand.logo_url
                      ? "更換 Logo"
                      : "上傳 Logo"}
                  </Button>
                  {brand.logo_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => update("logo_url", "")}
                    >
                      移除
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  主色
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brand.primary_color || "#000000"}
                    onChange={(e) => update("primary_color", e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded border border-gray-300"
                  />
                  <input
                    type="text"
                    value={brand.primary_color}
                    onChange={(e) => update("primary_color", e.target.value)}
                    placeholder="#000000"
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  輔色
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brand.secondary_color || "#ffffff"}
                    onChange={(e) => update("secondary_color", e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded border border-gray-300"
                  />
                  <input
                    type="text"
                    value={brand.secondary_color}
                    onChange={(e) => update("secondary_color", e.target.value)}
                    placeholder="#ffffff"
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <Input
              label="字體偏好"
              value={brand.font_preference}
              onChange={(e) => update("font_preference", e.target.value)}
              placeholder="如：思源黑體、Noto Sans"
            />
            <Textarea
              label="視覺關鍵字"
              value={brand.visual_keywords}
              onChange={(e) => update("visual_keywords", e.target.value)}
              rows={2}
              placeholder="例：極簡、留白、暖色、商務、年輕"
            />
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold">Meta 社群帳號連結</h2>
          <div className="space-y-4">
            <Input
              label="Facebook Page ID"
              value={brand.fb_page_id}
              onChange={(e) => update("fb_page_id", e.target.value)}
            />
            <Input
              label="Instagram Business Account ID"
              value={brand.ig_account_id}
              onChange={(e) => update("ig_account_id", e.target.value)}
            />
            <Input
              label="Meta Access Token"
              type="password"
              value={brand.meta_access_token}
              onChange={(e) => update("meta_access_token", e.target.value)}
            />
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={handleTestConnection}
                disabled={testing}
              >
                {testing ? "測試中..." : "測試連線"}
              </Button>
              {testResult && (
                <span
                  className={`text-sm ${
                    testResult.includes("成功")
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {testResult}
                </span>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
