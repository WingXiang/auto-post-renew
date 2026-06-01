"use client";

import { useEffect, useState, useRef } from "react";
import { Card, PageHeader, Button, Input, Textarea, Spinner } from "@/components/ui";
import type { Brand } from "@/types";

export default function BrandPage() {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/brands")
      .then((r) => r.json())
      .then((d) => setBrand(d.brand))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!brand) return;
    setSaving(true);
    try {
      await fetch("/api/brands", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(brand),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!brand?.meta_access_token) {
      setTestResult("請先輸入 Meta Access Token");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/brands/test-meta", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const parts: string[] = [];
        if (data.fb_page_name) parts.push(`FB Page: ${data.fb_page_name}`);
        if (data.ig_username) parts.push(`IG: @${data.ig_username}`);
        setTestResult(parts.length ? `連線成功！${parts.join("，")}` : "連線成功");
      } else {
        setTestResult(`連線失敗：${data.error || "請確認 Token、Page ID、IG ID"}`);
      }
    } catch {
      setTestResult("連線失敗，請檢查網路連線");
    } finally {
      setTesting(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.url) {
        update("logo_url", data.url);
      } else {
        alert(`上傳失敗：${data.error || "未知錯誤"}`);
      }
    } catch {
      alert("上傳失敗");
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const update = (field: keyof Brand, value: string) => {
    setBrand((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  if (loading) return <Spinner />;
  if (!brand) return <div className="text-center text-gray-500">請先建立品牌（選擇或建立 Organization）</div>;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="品牌設定"
        description="設定品牌基本資料、視覺識別與社群帳號連結"
        actions={
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "儲存中..." : "儲存設定"}
          </Button>
        }
      />

      <div className="space-y-6">
        <Card>
          <h2 className="mb-4 text-lg font-semibold">基本資料</h2>
          <div className="space-y-4">
            <Input label="品牌名稱" value={brand.brand_name} onChange={(e) => update("brand_name", e.target.value)} />
            <Input label="品牌主題" value={brand.theme} onChange={(e) => update("theme", e.target.value)} placeholder="如：永續時尚、健康生活" />
            <Input label="風格" value={brand.style} onChange={(e) => update("style", e.target.value)} placeholder="如：簡約、活潑、高端" />
            <Input label="語調" value={brand.tone} onChange={(e) => update("tone", e.target.value)} placeholder="如：專業、親切、幽默" />
            <Textarea label="目標受眾描述" value={brand.target_audience} onChange={(e) => update("target_audience", e.target.value)} rows={3} placeholder="描述你的目標受眾特徵..." />
            <Textarea label="過去貼文範例（JSON 格式）" value={brand.past_content_samples} onChange={(e) => update("past_content_samples", e.target.value)} rows={4} placeholder='[{"title":"範例貼文","content":"貼文內容..."}]' />
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold">視覺識別</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">品牌 Logo</label>
              <div className="flex items-center gap-4">
                {brand.logo_url ? (
                  <img
                    src={brand.logo_url}
                    alt="Logo"
                    className="h-20 w-20 rounded-md border border-gray-200 object-contain bg-white"
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
                    {uploadingLogo ? "上傳中..." : brand.logo_url ? "更換 Logo" : "上傳 Logo"}
                  </Button>
                  {brand.logo_url && (
                    <Button variant="ghost" size="sm" onClick={() => update("logo_url", "")}>
                      移除
                    </Button>
                  )}
                </div>
              </div>
              {brand.logo_url && (
                <p className="mt-2 break-all text-xs text-gray-500">{brand.logo_url}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">主色</label>
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
                <label className="mb-1 block text-sm font-medium text-gray-700">輔色</label>
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
            <Input label="Facebook Page ID" value={brand.fb_page_id} onChange={(e) => update("fb_page_id", e.target.value)} />
            <Input label="Instagram Business Account ID" value={brand.ig_account_id} onChange={(e) => update("ig_account_id", e.target.value)} />
            <Input label="Meta Access Token" type="password" value={brand.meta_access_token} onChange={(e) => update("meta_access_token", e.target.value)} />
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={handleTestConnection} disabled={testing}>
                {testing ? "測試中..." : "測試連線"}
              </Button>
              {testResult && (
                <span className={`text-sm ${testResult.includes("成功") ? "text-green-600" : "text-red-600"}`}>
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
