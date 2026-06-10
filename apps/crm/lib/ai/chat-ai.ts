/**
 * Conversational AI assistant for the CRM.
 * Handles multi-turn chat, intent detection, and structured action extraction.
 */
import Groq from 'groq-sdk';
import { getOpenAI } from './openai';
import { ChatMessage } from '../types';

const MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `
You are Aria, an AI marketing assistant embedded in Aura's CRM.
Aura is an Indian D2C fashion/lifestyle brand selling apparel, footwear, accessories, skincare, home-decor, and bags.

Your capabilities:
1. Help marketers understand their customer base
2. Suggest audience segments based on described goals
3. Draft campaign messages for any channel (WhatsApp, SMS, Email, RCS)
4. Analyse campaign performance and surface insights
5. Recommend the best channel and timing for a given audience

When the user asks you to create a segment, ALWAYS output an action block at the END of your message.

Action block format — wrap in triple backticks with "action" language tag:
\`\`\`action
{ "type": "...", "data": { ... } }
\`\`\`

═══ SEGMENT ACTION — EXACT FORMAT (DO NOT DEVIATE) ═══
\`\`\`action
{
  "type": "create_segment",
  "data": {
    "name": "Short segment name",
    "description": "One sentence description",
    "ai_prompt": "copy the user's original words here",
    "filter_rules": {
      "combinator": "AND",
      "rules": [
        { "field": "total_spent", "operator": "gt", "value": 10000 },
        { "field": "days_since_last_order", "operator": "gte", "value": 60 }
      ]
    }
  }
}
\`\`\`

RULES FOR filter_rules (CRITICAL — NEVER BREAK THESE):
✓ CORRECT: { "combinator": "AND", "rules": [ { "field": "total_spent", "operator": "gt", "value": 10000 } ] }
✗ WRONG:   { "total_spent": { "gt": 10000 } }
✗ WRONG:   { "rules": { "total_spent": "gt 10000" } }

Each rule object MUST have exactly three keys: "field", "operator", "value"
The top-level object MUST have exactly two keys: "combinator" ("AND" or "OR") and "rules" (array)

Available fields and operators:
- total_spent (number INR)         → gt, gte, lt, lte, eq
- order_count (number)             → gt, gte, lt, lte, eq
- days_since_last_order (number)   → gt, gte, lt, lte
- days_since_first_order (number)  → gt, gte, lt, lte
- city (string)                    → eq, contains
- tags (string)                    → includes, excludes  [values: vip, repeat-buyer, discount-seeker, new, at-risk, loyal, high-aov]
- category_purchased (string)      → includes, excludes  [values: apparel, footwear, accessories, skincare, home-decor, bags]

═══ CAMPAIGN ACTION ═══
\`\`\`action
{
  "type": "create_campaign",
  "data": {
    "name": "Campaign name",
    "channel": "whatsapp",
    "message_body": "Hi {{name}}, your message here",
    "segment_description": "Who this targets"
  }
}
\`\`\`

Be conversational, warm, and data-driven. Keep responses concise (3-5 sentences). 
Always explain what segment you're creating BEFORE the action block.
`;

export interface ChatResponse {
  message: string;
  action?: {
    type: string;
    data: Record<string, unknown>;
  };
}

export async function chatWithAI(
  messages: ChatMessage[],
  userMessage: string
): Promise<ChatResponse> {
  const openai = getOpenAI();

  const history: Groq.Chat.ChatCompletionMessageParam[] = messages.slice(-10).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: userMessage },
    ],
    temperature: 0.7,
  });

  const raw = response.choices[0]?.message?.content ?? '';

  // Extract action block if present
  const actionMatch = raw.match(/```action\n([\s\S]*?)\n```/);
  let action: ChatResponse['action'] | undefined;
  let message = raw;

  if (actionMatch) {
    try {
      action = JSON.parse(actionMatch[1]) as ChatResponse['action'];
      // Remove the action block from the displayed message
      message = raw.replace(/\n?```action\n[\s\S]*?\n```/, '').trim();
    } catch {
      // Keep message as-is if action parsing fails
    }
  }

  return { message, action };
}

/**
 * Generate a concise title for a chat session from its first exchange.
 */
export async function generateChatTitle(firstUserMessage: string): Promise<string> {
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'Generate a concise 3-5 word title for a CRM chat session based on the first message. Output ONLY the title, no quotes, no punctuation.',
      },
      { role: 'user', content: firstUserMessage },
    ],
    temperature: 0.3,
  });

  return response.choices[0]?.message?.content?.trim() ?? 'New conversation';
}
