// ─── Domain types ─────────────────────────────────────────────────────────────

export type Channel = 'whatsapp' | 'sms' | 'email' | 'rcs';

export type CommunicationStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'converted'
  | 'failed';

export type CampaignStatus = 'draft' | 'sending' | 'sent' | 'paused';

// ─── Database row shapes ──────────────────────────────────────────────────────

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  tags: string[];
  total_spent: number;
  order_count: number;
  last_order_at: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  customer_id: string;
  total: number;
  status: string;
  category: string | null;
  items: OrderItem[];
  ordered_at: string;
}

export interface OrderItem {
  name: string;
  price: number;
  qty: number;
}

export interface Segment {
  id: string;
  name: string;
  description: string | null;
  filter_rules: FilterRuleGroup;
  ai_prompt: string | null;
  customer_count: number;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  segment_id: string | null;
  channel: Channel;
  message_body: string;
  status: CampaignStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  stat_sent: number;
  stat_delivered: number;
  stat_opened: number;
  stat_clicked: number;
  stat_converted: number;
  stat_failed: number;
  // Joined fields
  segment_name?: string;
}

export interface Communication {
  id: string;
  campaign_id: string;
  customer_id: string;
  channel: Channel;
  message_body: string;
  status: CommunicationStatus;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  converted_at: string | null;
  failed_at: string | null;
  created_at: string;
  // Joined
  customer_name?: string;
  customer_email?: string;
}

export interface ChatSession {
  id: string;
  title: string | null;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  // Optional structured actions the AI suggested
  action?: ChatAction;
}

export type ChatAction =
  | { type: 'create_segment'; segment: Partial<Segment> }
  | { type: 'create_campaign'; campaign: Partial<Campaign> }
  | { type: 'show_insights'; filters?: Record<string, unknown> };

// ─── Segment filter DSL ───────────────────────────────────────────────────────

export type FilterCombinator = 'AND' | 'OR';

export interface FilterRuleGroup {
  combinator: FilterCombinator;
  rules: (FilterRule | FilterRuleGroup)[];
}

export function isFilterRuleGroup(r: FilterRule | FilterRuleGroup): r is FilterRuleGroup {
  return 'combinator' in r;
}

export interface FilterRule {
  field: FilterField;
  operator: FilterOperator;
  value: string | number | string[];
}

export type FilterField =
  | 'total_spent'
  | 'order_count'
  | 'days_since_last_order'
  | 'days_since_first_order'
  | 'city'
  | 'tags'
  | 'category_purchased'
  | 'channel_preference';

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'includes'
  | 'excludes'
  | 'contains';

// ─── API response shapes ──────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  error: string;
  details?: string;
}

// ─── Channel stub contract ────────────────────────────────────────────────────

export interface SendRequest {
  communicationId: string;
  recipientId: string;
  channel: Channel;
  message: string;
  campaignId: string;
  recipientPhone?: string;
  recipientEmail?: string;
}

export interface ReceiptPayload {
  communicationId: string;
  status: CommunicationStatus;
  timestamp: string;
}

// ─── Dashboard / analytics ────────────────────────────────────────────────────

export interface DashboardStats {
  totalCustomers: number;
  totalCampaigns: number;
  totalCommunications: number;
  avgDeliveryRate: number;
  avgOpenRate: number;
  avgClickRate: number;
  recentCampaigns: Campaign[];
  topSegments: Array<{ name: string; customer_count: number }>;
  communicationsByDay: Array<{ date: string; sent: number; delivered: number; opened: number }>;
}
