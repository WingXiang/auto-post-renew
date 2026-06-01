export interface Brand {
  brand_id: string;
  brand_name: string;
  theme: string;
  style: string;
  tone: string;
  target_audience: string;
  past_content_samples: string;
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
  created_at?: string;
}

export interface Post {
  post_id: string;
  brand_id: string;
  topic_id?: string;
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
  started_at: string;
  finished_at?: string;
}
