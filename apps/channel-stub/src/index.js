const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const CRM_RECEIPT_URL = process.env.CRM_RECEIPT_URL || 'http://localhost:3000/api/receipts';

// ── Simulated delivery outcome probabilities per channel ─────────────────────
const CHANNEL_OUTCOMES = {
  whatsapp: { delivered: 0.92, opened: 0.75, clicked: 0.18, converted: 0.06, failed: 0.08 },
  sms:      { delivered: 0.88, opened: 0.65, clicked: 0.08, converted: 0.03, failed: 0.12 },
  email:    { delivered: 0.85, opened: 0.35, clicked: 0.12, converted: 0.04, failed: 0.15 },
  rcs:      { delivered: 0.90, opened: 0.70, clicked: 0.20, converted: 0.07, failed: 0.10 },
};

// ── In-memory stats for the /stats endpoint ───────────────────────────────────
const stats = {
  totalReceived: 0,
  totalCallbacksSent: 0,
  totalCallbacksFailed: 0,
  totalRetries: 0,
  byChannel: {},
  byStatus: {},
};

function recordStat(channel, status) {
  stats.byChannel[channel] = (stats.byChannel[channel] || 0) + 1;
  stats.byStatus[status]   = (stats.byStatus[status]   || 0) + 1;
}

// ── Outcome simulation ────────────────────────────────────────────────────────
function simulateOutcomeChain(channel, communicationId) {
  const probs = CHANNEL_OUTCOMES[channel] || CHANNEL_OUTCOMES.sms;
  const roll = Math.random();
  const events = [];
  let delay = 300 + Math.random() * 1500; // delivery in 0.3–1.8s

  if (roll < probs.failed) {
    events.push({ delay, status: 'failed', communicationId, channel });
    return events;
  }

  // Delivered
  events.push({ delay, status: 'delivered', communicationId, channel });

  // Opened?
  if (Math.random() < probs.opened) {
    delay += 1000 + Math.random() * 30000; // 1s–31s after delivery
    events.push({ delay, status: 'opened', communicationId, channel });

    // Clicked?
    if (Math.random() < probs.clicked) {
      delay += 500 + Math.random() * 15000;
      events.push({ delay, status: 'clicked', communicationId, channel });

      // Converted?
      if (Math.random() < (probs.converted || 0.1)) {
        delay += 2000 + Math.random() * 60000;
        events.push({ delay, status: 'converted', communicationId, channel });
      }
    }
  }

  return events;
}

// ── Retry-enabled callback fire ───────────────────────────────────────────────
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

async function fireCallback(event, attempt = 0) {
  try {
    await axios.post(
      CRM_RECEIPT_URL,
      {
        communicationId: event.communicationId,
        status: event.status,
        timestamp: new Date().toISOString(),
      },
      { timeout: 8000 }
    );
    stats.totalCallbacksSent++;
    recordStat(event.channel, event.status);
    console.log(`[✓] ${event.status.padEnd(10)} → ${event.communicationId.slice(0, 8)}…`);
  } catch (err) {
    stats.totalRetries++;
    if (attempt < MAX_RETRIES) {
      const backoff = RETRY_BASE_MS * Math.pow(2, attempt) + Math.random() * 500;
      console.warn(
        `[retry ${attempt + 1}/${MAX_RETRIES}] ${event.communicationId.slice(0, 8)}… ` +
        `→ ${event.status} (in ${Math.round(backoff)}ms) — ${err.message}`
      );
      setTimeout(() => fireCallback(event, attempt + 1), backoff);
    } else {
      stats.totalCallbacksFailed++;
      console.error(
        `[✗] Max retries exceeded: ${event.communicationId.slice(0, 8)}… → ${event.status}`
      );
    }
  }
}

async function fireCallbacks(events) {
  for (const event of events) {
    await new Promise((resolve) => setTimeout(resolve, event.delay));
    // Fire and don't await — each callback handles its own retries
    fireCallback(event).catch(() => {});
  }
}

// ── Routes ────────────────────────────────────────────────────────────────────

// POST /send — called by the CRM to dispatch a message
app.post('/send', (req, res) => {
  const { communicationId, recipientId, channel, message, campaignId } = req.body;

  if (!communicationId || !recipientId || !channel || !message) {
    return res.status(400).json({
      error: 'Missing required fields: communicationId, recipientId, channel, message',
    });
  }

  const normalizedChannel = channel.toLowerCase();
  if (!CHANNEL_OUTCOMES[normalizedChannel]) {
    return res.status(400).json({ error: `Unsupported channel: ${channel}` });
  }

  stats.totalReceived++;
  console.log(`[→] ${normalizedChannel.padEnd(9)} ${communicationId.slice(0, 8)}… (campaign: ${(campaignId || 'n/a').slice(0, 8)})`);

  // Acknowledge immediately — async simulation follows
  res.status(202).json({ accepted: true, communicationId });

  const events = simulateOutcomeChain(normalizedChannel, communicationId);
  fireCallbacks(events).catch((err) =>
    console.error('[fireCallbacks error]', err.message)
  );
});

// GET /health
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'channel-stub',
    crmReceiptUrl: CRM_RECEIPT_URL,
    uptime: Math.round(process.uptime()),
  });
});

// GET /stats — live delivery stats
app.get('/stats', (_req, res) => {
  res.json({
    ...stats,
    callbackSuccessRate: stats.totalCallbacksSent > 0
      ? ((stats.totalCallbacksSent / (stats.totalCallbacksSent + stats.totalCallbacksFailed)) * 100).toFixed(1) + '%'
      : 'n/a',
  });
});

// ── Boot ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('  ┌─────────────────────────────────────────┐');
  console.log('  │        Channel Stub  ·  port ' + PORT + '          │');
  console.log('  ├─────────────────────────────────────────┤');
  console.log('  │  POST /send     Receive campaign msgs   │');
  console.log('  │  GET  /health   Health check            │');
  console.log('  │  GET  /stats    Live delivery stats     │');
  console.log('  └─────────────────────────────────────────┘');
  console.log('');
  console.log(`  Callbacks → ${CRM_RECEIPT_URL}`);
  console.log(`  Max retries: ${MAX_RETRIES} (exponential backoff)`);
  console.log('');
});
