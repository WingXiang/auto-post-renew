export interface Brand {
  brand_id: string;
  brand_name: string;
  theme: string;
  style: string;
  tone: string;
  target_audience: string;
  past_content_samples: string; // legacy; UI 已改用 past_content_urls
  past_content_urls: string; // JSON array of URL 字串
  fb_page_id: string;
  ig_account_id: string;
  meta_access_token: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  font_preference: string;
  visual_keywords: string;
}

export interface Topic {
  topic_id: string;
  brand_id: string;
  topic_title: string;
  source_url: string;
  relevance_score: number;
  status: "pending" | "approved" | "rejected" | "used";
  brand_relevance: string;     // AI 寫的「為何此主題與品牌相關」
  suggested_angles: string;    // AI 建議的撰寫角度（pipe-separated 或 JSON array）
  content_type: string;        // 教學 / 案例 / 觀點 / 工具評測 / 趨勢
  target_reader: string;       // 新手 / 進階 / 決策者
  search_keyword: string;      // 此主題在哪次搜尋被找到（使用者輸入的關鍵字）
  archived_at: string;         // 空字串 = 未封存；ISO 時間 = 已封存
  created_at?: string;
}

export interface Post {
  post_id: string;
  brand_id: string;
  topic_id?: string;
  topic_title?: string;        // 快取自 topic.topic_title，給 UI 直接顯示
  platform: "facebook" | "instagram" | "both";
  caption: string;
  image_prompt: string;
  image_url?: string;
  scheduled_time: string;
  status: "draft" | "scheduled" | "published" | "failed";
  fb_post_id?: string;
  ig_post_id?: string;
  optimization_version: number;
  created_at?: string;
}

export interface Analytics {
  analytics_id: string;
  brand_id: string;
  post_id: string;
  platform: string;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  engagement_rate: number;
  collected_at: string;
}

export interface OptimizationLog {
  log_id: string;
  brand_id: string;
  week_start: string;
  top_topics: string;
  top_posts: string;
  caption_guidelines: string;
  image_guidelines: string;
  created_at: string;
}

export interface PotentialCustomer {
  customer_id: string;
  brand_id: string;
  display_name: string;
  interaction_type: string;
  interaction_content: string;
  post_id: string;
  suggested_action: string;
  status: "new" | "contacted" | "converted" | "dismissed";
  identified_at: string;
}

export interface Schedule {
  schedule_id: string;
  brand_id: string;
  // 新 schema（白話排程）
  weekday_mask: string;        // "1010101" 共 7 位元，週日→週六（1=發、0=不發）
  time_slots: string;          // JSON array e.g. "[\"09:00\",\"18:00\"]"
  auto_publish_enabled: string; // "true" / "false"
  // 舊欄位保留兼容
  frequency: string;
  post_times: string;
  topic_discovery_day: string;
  analytics_day: string;
  updated_at: string;
}

export interface PipelineLog {
  log_id: string;
  brand_id: string;
  workflow_name: string;
  status: "running" | "success" | "failed";
  message: string;
  subject: string;             // 人話描述「正在做什麼」e.g. 「搜尋主題：AI 自動化」
  progress: string;            // 多步驟流程進度 e.g. "3/7"；可空
  started_at: string;
  finished_at?: string;
  stalled?: boolean;           // server 端計算：started_at 超過 10 分鐘且 status=running
}
