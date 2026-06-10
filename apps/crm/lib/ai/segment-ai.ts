/**
 * AI-powered segment generation.
 * Takes a natural-language description → returns a FilterRuleGroup.
 */
import { getOpenAI } from './openai';
import { FilterRuleGroup } from '../types';

const MODEL = 'llama-3.3-70b-versatile';

const SEGMENT_SYSTEM_PROMPT = `
You are an expert CRM data analyst for an Indian D2C fashion/lifestyle brand called "Aura".
Your job is to convert a marketer's natural-language audience description into a structured
JSON filter rule tree.

Available filter fields:
- total_spent        (number) — lifetime spend in INR
- order_count        (number) — total number of orders placed
- days_since_last_order (number) — days since last purchase
- days_since_first_order (number) — days since first purchase (lower = newer customer)
- city               (string) — e.g. "Mumbai", "Delhi"
- tags               (string) — values: vip, repeat-buyer, discount-seeker, new, at-risk, loyal, high-aov, social-follower, referral, early-adopter
- category_purchased (string) — values: apparel, footwear, accessories, skincare, home-decor, bags

Available operators:
- eq, neq            — equals / not equals (for strings and numbers)
- gt, gte, lt, lte   — numeric comparisons
- includes, excludes — array membership (for tags, category_purchased)
- contains           — substring match (for city)

Output ONLY valid JSON matching this TypeScript type (no explanation, no markdown, no code fence):

type FilterRuleGroup = {
  combinator: "AND" | "OR";
  rules: Array<
    | { field: string; operator: string; value: string | number }
    | FilterRuleGroup
  >;
};

Examples:

Input: "customers who spent more than 5000 and haven't ordered in 30 days"
Output: {"combinator":"AND","rules":[{"field":"total_spent","operator":"gt","value":5000},{"field":"days_since_last_order","operator":"gte","value":30}]}

Input: "new customers from Mumbai who bought footwear"
Output: {"combinator":"AND","rules":[{"field":"days_since_first_order","operator":"lte","value":30},{"field":"city","operator":"eq","value":"Mumbai"},{"field":"category_purchased","operator":"includes","value":"footwear"}]}

Input: "VIP customers who have bought more than 3 times"
Output: {"combinator":"AND","rules":[{"field":"tags","operator":"includes","value":"vip"},{"field":"order_count","operator":"gt","value":3}]}
`;

export async function generateSegmentRules(prompt: string): Promise<FilterRuleGroup> {
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SEGMENT_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.1,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new Error('No response from AI');

  const parsed = JSON.parse(raw) as FilterRuleGroup;

  if (!parsed.combinator || !Array.isArray(parsed.rules)) {
    throw new Error('AI returned invalid segment structure');
  }

  return parsed;
}

const MESSAGE_SYSTEM_PROMPT = `
You are a creative marketing copywriter for "Aura", an Indian D2C fashion/lifestyle brand.
Write a short, personalised message for a marketing campaign.

Guidelines:
- Keep it under 160 characters for SMS, under 300 for WhatsApp/RCS, under 500 for email
- Use a warm, conversational tone. Avoid corporate jargon.
- Include a soft call-to-action (e.g. "Shop now", "Explore the collection")
- You may use the placeholder {{name}} for personalisation
- For WhatsApp/RCS you can use emojis tastefully
- Do NOT include URLs or pricing (the marketer will add those)
- Output ONLY the message text, no JSON, no markdown

Channel-specific notes:
- sms: Plain text, concise, no emojis
- whatsapp: Can use emojis, slightly longer, friendly
- rcs: Like WhatsApp but slightly more formal
- email: Subject line on line 1 (prefixed "Subject: "), body on remaining lines
`;

export async function generateCampaignMessage(params: {
  segmentDescription: string;
  channel: string;
  campaignGoal?: string;
}): Promise<string> {
  const openai = getOpenAI();

  const userPrompt = `
Segment: ${params.segmentDescription}
Channel: ${params.channel}
Goal: ${params.campaignGoal || 'Drive repeat purchase'}
`;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: MESSAGE_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
  });

  return response.choices[0]?.message?.content?.trim() ?? '';
}

const SEGMENT_NAME_PROMPT = `
You are a CRM assistant. Given a natural-language audience description,
suggest a short, professional segment name (3-5 words max) and a one-sentence description.

Output ONLY JSON: {"name": "...", "description": "..."}
`;

export async function generateSegmentMeta(prompt: string): Promise<{ name: string; description: string }> {
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SEGMENT_NAME_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) return { name: 'AI Segment', description: prompt };

  return JSON.parse(raw) as { name: string; description: string };
}
