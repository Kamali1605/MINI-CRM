'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Campaign, Segment } from '@/lib/types';
import { Sparkles, X, Loader2, Plus, Wand2 } from 'lucide-react';

const CHANNELS = [
  { value: 'whatsapp', label: '💬 WhatsApp', description: 'Best engagement, supports rich media' },
  { value: 'sms',      label: '📱 SMS',      description: 'Universal reach, plain text' },
  { value: 'email',    label: '📧 Email',    description: 'Detailed content, trackable' },
  { value: 'rcs',      label: '✨ RCS',      description: 'Rich cards, modern devices' },
];

interface Props {
  preselectedSegmentId?: string;
  onClose: () => void;
  onCreated: (campaign: Campaign) => void;
}

export function CreateCampaignModal({ preselectedSegmentId, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [segmentId, setSegmentId] = useState(preselectedSegmentId ?? '');
  const [channel, setChannel] = useState('whatsapp');
  const [message, setMessage] = useState('');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [campaignGoal, setCampaignGoal] = useState('');

  useEffect(() => {
    fetch('/api/segments')
      .then((r) => r.json())
      .then((data) => setSegments(data.data ?? []));
  }, []);

  const selectedSegment = segments.find((s) => s.id === segmentId);

  const handleAiMessage = async () => {
    if (!selectedSegment) {
      alert('Select a segment first so the AI knows who it\'s writing for.');
      return;
    }
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segmentDescription: selectedSegment.description ?? selectedSegment.name,
          channel,
          campaignGoal: campaignGoal || undefined,
        }),
      });
      const data = await res.json();
      if (data.message) setMessage(data.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !message.trim()) {
      alert('Name and message are required.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, segment_id: segmentId || undefined, channel, message_body: message }),
      });
      const campaign = await res.json();
      onCreated(campaign);
    } finally {
      setSaving(false);
    }
  };

  const charLimit = channel === 'sms' ? 160 : channel === 'email' ? 500 : 300;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-semibold">Create Campaign</h2>
            <p className="text-sm text-muted-foreground">Configure your message and audience</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Campaign Name *</label>
            <Input
              placeholder="e.g. VIP Win-back June"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Segment */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Audience Segment</label>
            <Select value={segmentId} onValueChange={setSegmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a segment" />
              </SelectTrigger>
              <SelectContent>
                {segments.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} ({s.customer_count} customers)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedSegment?.description && (
              <p className="text-xs text-muted-foreground mt-1">{selectedSegment.description}</p>
            )}
          </div>

          {/* Channel */}
          <div>
            <label className="text-sm font-medium mb-2 block">Channel</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CHANNELS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setChannel(c.value)}
                  className={`p-3 rounded-xl text-left border-2 transition-all ${
                    channel === c.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <p className="text-sm font-medium">{c.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{c.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Message with AI assist */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium">Message *</label>
              <div className="flex items-center gap-2">
                {channel !== 'email' && (
                  <span className={`text-xs ${message.length > charLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {message.length}/{charLimit}
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAiMessage}
                  disabled={aiLoading}
                  className="gap-1.5 h-7 text-xs"
                >
                  {aiLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  AI Draft
                </Button>
              </div>
            </div>

            {/* Campaign goal for AI context */}
            <Input
              className="mb-2 text-xs"
              placeholder="Campaign goal (helps AI draft better — e.g. 'Drive repeat purchase', 'Announce new collection')"
              value={campaignGoal}
              onChange={(e) => setCampaignGoal(e.target.value)}
            />

            <Textarea
              placeholder={`Write your message here. Use {{name}} for personalisation.\n\nOr click "AI Draft" to have the AI write it for you.`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              <Wand2 className="w-3 h-3 inline mr-1" />
              Use <code>{'{{name}}'}</code> to insert the customer&#39;s first name
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1 gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create as Draft
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
