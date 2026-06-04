"use client";

import { Tabs } from "@/components/ui";

interface PostPreviewProps {
  brandName: string;
  logoUrl?: string;
  caption: string;
  imageUrl?: string;
  platform: "facebook" | "instagram";
  onPlatformChange: (p: "facebook" | "instagram") => void;
  onClose: () => void;
}

function Avatar({ src, name }: { src?: string; name: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className="h-10 w-10 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
      {name.charAt(0)}
    </div>
  );
}

function FacebookPreview({
  brandName,
  logoUrl,
  caption,
  imageUrl,
}: Omit<PostPreviewProps, "platform" | "onPlatformChange" | "onClose">) {
  return (
    <div className="mx-auto max-w-lg overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar src={logoUrl} name={brandName} />
        <div className="flex-1">
          <div className="text-sm font-semibold text-gray-900">{brandName}</div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span>剛剛</span>
            <span>·</span>
            <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zm3.7 7.3-3 3a1 1 0 0 1-1.4 0l-1.5-1.5a1 1 0 1 1 1.4-1.4l.8.8 2.3-2.3a1 1 0 0 1 1.4 1.4z" />
            </svg>
          </div>
        </div>
        <button className="text-gray-400">···</button>
      </div>

      {/* Caption */}
      <div className="whitespace-pre-wrap px-4 pb-3 text-sm text-gray-900">
        {caption}
      </div>

      {/* Image */}
      {imageUrl && (
        <div className="w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            className="w-full object-cover"
            style={{ maxHeight: 500 }}
          />
        </div>
      )}

      {/* Engagement bar */}
      <div className="border-t border-gray-200 px-4 py-1">
        <div className="flex items-center justify-between py-1 text-xs text-gray-500">
          <span>👍 12</span>
          <span>3 則留言 · 1 次分享</span>
        </div>
      </div>
      <div className="flex border-t border-gray-200">
        {[
          { icon: "👍", label: "讚" },
          { icon: "💬", label: "留言" },
          { icon: "↗", label: "分享" },
        ].map((a) => (
          <button
            key={a.label}
            className="flex flex-1 items-center justify-center gap-1 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <span>{a.icon}</span>
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function InstagramPreview({
  brandName,
  logoUrl,
  caption,
  imageUrl,
}: Omit<PostPreviewProps, "platform" | "onPlatformChange" | "onClose">) {
  return (
    <div className="mx-auto max-w-md overflow-hidden rounded-lg border border-gray-300 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        <Avatar src={logoUrl} name={brandName} />
        <div className="flex-1 text-sm font-semibold text-gray-900">
          {brandName}
        </div>
        <button className="text-gray-400">···</button>
      </div>

      {/* Image (square crop) */}
      {imageUrl ? (
        <div className="aspect-square w-full bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="flex aspect-square w-full items-center justify-center bg-gray-100 text-sm text-gray-400">
          尚無圖片
        </div>
      )}

      {/* Action icons */}
      <div className="flex items-center gap-4 px-3 py-2.5">
        <button className="text-2xl">♡</button>
        <button className="text-2xl">💬</button>
        <button className="text-2xl">✈</button>
        <button className="ml-auto text-2xl">🔖</button>
      </div>

      {/* Likes */}
      <div className="px-3 text-sm font-semibold text-gray-900">12 個讚</div>

      {/* Caption */}
      <div className="px-3 pb-3 pt-1">
        <span className="text-sm">
          <span className="font-semibold text-gray-900">{brandName}</span>{" "}
          <span className="whitespace-pre-wrap text-gray-800">{caption}</span>
        </span>
      </div>
    </div>
  );
}

export function PostPreview({
  brandName,
  logoUrl,
  caption,
  imageUrl,
  platform,
  onPlatformChange,
  onClose,
}: PostPreviewProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-12"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl">
        {/* Controls */}
        <div className="mb-3 flex items-center justify-between">
          <Tabs
            value={platform}
            onChange={(v) =>
              onPlatformChange(v as "facebook" | "instagram")
            }
            options={[
              { value: "facebook", label: "📘 Facebook" },
              { value: "instagram", label: "📷 Instagram" },
            ]}
          />
          <button
            onClick={onClose}
            className="rounded-full bg-white/90 px-3 py-1 text-sm font-medium text-gray-700 shadow hover:bg-white"
          >
            關閉
          </button>
        </div>

        {/* Preview */}
        {platform === "facebook" ? (
          <FacebookPreview
            brandName={brandName}
            logoUrl={logoUrl}
            caption={caption}
            imageUrl={imageUrl}
          />
        ) : (
          <InstagramPreview
            brandName={brandName}
            logoUrl={logoUrl}
            caption={caption}
            imageUrl={imageUrl}
          />
        )}
      </div>
    </div>
  );
}
