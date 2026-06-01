"use client";

import { useEffect, useState } from "react";
import { Card, PageHeader, Button, Input, Textarea, Spinner } from "@/components/ui";
import type { Brand } from "@/types";

export default function BrandPage() {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

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
      const res = await fetch(
        `https://graph.facebook.com/v21.0/me?access_token=${brand.meta_access_token}`
      );
      if (res.ok) {
        const data = await res.json();
        setTestResult(`連線成功！帳號名稱: ${data.name}`);
      } else {
        setTestResult("連線失敗，請確認 Token 是否正確");
      }
    } catch {
      setTestResult("連線失敗，請檢查網路連線");
    } finally {
      setTesting(false);
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
        description="設定品牌基本資料、風格與社群帳號連結"
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
            <Input label="視覺風格" value={brand.style} onChange={(e) => update("style", e.target.value)} placeholder="如：簡約、活潑、高端" />
            <Input label="語調" value={brand.tone} onChange={(e) => update("tone", e.target.value)} placeholder="如：專業、親切、幽默" />
            <Textarea label="目標受眾描述" value={brand.target_audience} onChange={(e) => update("target_audience", e.target.value)} rows={3} placeholder="描述你的目標受眾特徵..." />
            <Textarea label="過去貼文範例（JSON 格式）" value={brand.past_content_samples} onChange={(e) => update("past_content_samples", e.target.value)} rows={4} placeholder='[{"title":"範例貼文","content":"貼文內容..."}]' />
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
