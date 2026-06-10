'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Segment, FilterRuleGroup, FilterRule, FilterField, FilterOperator } from '@/lib/types';
import { Sparkles, Plus, Trash2, X, Loader2, Users, Wand2 } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

type Mode = 'ai' | 'builder';

const FIELD_OPTIONS: { value: FilterField; label: string }[] = [
  { value: 'total_spent',            label: 'Lifetime Spend (₹)' },
  { value: 'order_count',            label: 'Order Count' },
  { value: 'days_since_last_order',  label: 'Days Since Last Order' },
  { value: 'days_since_first_order', label: 'Days Since First Order' },
  { value: 'city',                   label: 'City' },
  { value: 'tags',                   label: 'Customer Tag' },
  { value: 'category_purchased',     label: 'Category Purchased' },
];

const OPERATOR_OPTIONS: Record<string, { value: FilterOperator; label: string }[]> = {
  numeric: [
    { value: 'gt',  label: 'greater than' },
    { value: 'gte', label: 'at least' },
    { value: 'lt',  label: 'less than' },
    { value: 'lte', label: 'at most' },
    { value: 'eq',  label: 'equals' },
  ],
  string: [
    { value: 'eq',       label: 'is' },
    { value: 'neq',      label: 'is not' },
    { value: 'contains', label: 'contains' },
  ],
  array: [
    { value: 'includes', label: 'includes' },
    { value: 'excludes', label: 'excludes' },
  ],
};

const FIELD_TYPE: Record<FilterField, 'numeric' | 'string' | 'array'> = {
  total_spent:            'numeric',
  order_count:            'numeric',
  days_since_last_order:  'numeric',
  days_since_first_order: 'numeric',
  city:                   'string',
  tags:                   'array',
  category_purchased:     'array',
  channel_preference:     'array',
};

const ARRAY_VALUE_OPTIONS: Partial<Record<FilterField, string[]>> = {
  tags:               ['vip','repeat-buyer','discount-seeker','new','at-risk','loyal','high-aov','social-follower','referral','early-adopter'],
  category_purchased: ['apparel','footwear','accessories','skincare','home-decor','bags'],
};

interface Props {
  onClose: () => void;
  onCreated: (segment: Segment) => void;
}

export function CreateSegmentModal({ onClose, onCreated }: Props) {
  const [mode, setMode] = useState<Mode>('ai');

  // AI mode state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    filter_rules: FilterRuleGroup;
    name: string;
    description: string;
    estimated_count: number;
  } | null>(null);

  // Builder mode state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState<FilterRule[]>([
    { field: 'order_count', operator: 'gte', value: 1 },
  ]);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  // ── AI mode ─────────────────────────────────────────────────────────────────

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await fetch('/api/ai/segment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAiResult(data);
    } catch (err) {
      console.error(err);
      alert('Failed to generate segment. Check your AI settings.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiSave = async () => {
    if (!aiResult) return;
    setSaving(true);
    try {
      const res = await fetch('/api/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: aiResult.name,
          description: aiResult.description,
          filter_rules: aiResult.filter_rules,
          ai_prompt: aiPrompt,
        }),
      });
      const seg = await res.json();
      onCreated(seg);
    } finally {
      setSaving(false);
    }
  };

  // ── Builder mode ─────────────────────────────────────────────────────────────

  const addRule = () => {
    setRules((prev) => [...prev, { field: 'order_count', operator: 'gte', value: 1 }]);
    setPreviewCount(null);
  };

  const updateRule = (index: number, patch: Partial<FilterRule>) => {
    setRules((prev) => prev.map((r, i) => i === index ? { ...r, ...patch } : r));
    setPreviewCount(null);
  };

  const removeRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
    setPreviewCount(null);
  };

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/segments/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filter_rules: { combinator: 'AND', rules },
        }),
      });
      const data = await res.json();
      setPreviewCount(data.count);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleBuilderSave = async () => {
    if (!name.trim()) { alert('Name is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          filter_rules: { combinator: 'AND', rules },
        }),
      });
      const seg = await res.json();
      onCreated(seg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-semibold">Create Segment</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Define who to reach</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex p-6 pb-0 gap-2">
          <button
            onClick={() => setMode('ai')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'ai' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            <Sparkles className="w-4 h-4" /> AI Generate
          </button>
          <button
            onClick={() => setMode('builder')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === 'builder' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            <Wand2 className="w-4 h-4" /> Rule Builder
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* AI mode */}
          {mode === 'ai' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Describe your audience</label>
                <Textarea
                  placeholder="e.g. Customers who spent more than ₹5,000 and haven't purchased in 60 days"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  rows={3}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAiGenerate();
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">Tip: Cmd/Ctrl + Enter to generate</p>
              </div>

              <Button
                onClick={handleAiGenerate}
                disabled={aiLoading || !aiPrompt.trim()}
                className="gap-2 w-full"
              >
                {aiLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Generate Segment Rules</>
                )}
              </Button>

              {aiResult && (
                <div className="border rounded-xl p-4 space-y-4 bg-primary/5 border-primary/20">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">{aiResult.name}</h3>
                        <Badge variant="info" className="text-xs"><Sparkles className="w-3 h-3 mr-1" />AI</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{aiResult.description}</p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-lg px-2.5 py-1 shrink-0">
                      <Users className="w-3.5 h-3.5" />
                      <span className="text-sm font-bold">{formatNumber(aiResult.estimated_count)}</span>
                    </div>
                  </div>

                  {/* Show generated rules */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Generated Rules:</p>
                    <div className="space-y-1.5">
                      {aiResult.filter_rules.rules.map((rule, i) => {
                        if ('combinator' in rule) return null;
                        return (
                          <div key={i} className="flex items-center gap-2 text-xs bg-background rounded-lg px-3 py-2">
                            <span className="font-medium">{rule.field.replace(/_/g, ' ')}</span>
                            <span className="text-muted-foreground">{rule.operator}</span>
                            <span className="font-medium">{String(rule.value)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <Button onClick={handleAiSave} disabled={saving} className="w-full gap-2">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Save Segment
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Builder mode */}
          {mode === 'builder' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Name *</label>
                  <Input placeholder="e.g. VIP Shoppers" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Description</label>
                  <Input placeholder="Optional description" value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium">Rules (ALL must match)</label>
                  <Button variant="ghost" size="sm" onClick={addRule} className="gap-1 h-7 text-xs">
                    <Plus className="w-3.5 h-3.5" /> Add Rule
                  </Button>
                </div>

                <div className="space-y-2">
                  {rules.map((rule, i) => {
                    const fieldType = FIELD_TYPE[rule.field] ?? 'numeric';
                    const ops = OPERATOR_OPTIONS[fieldType] ?? OPERATOR_OPTIONS.numeric;
                    const arrayValues = ARRAY_VALUE_OPTIONS[rule.field];

                    return (
                      <div key={i} className="flex items-center gap-2 bg-secondary/50 rounded-lg p-2">
                        {/* Field */}
                        <Select
                          value={rule.field}
                          onValueChange={(v) => updateRule(i, { field: v as FilterField, operator: 'gte', value: '' })}
                        >
                          <SelectTrigger className="h-8 text-xs flex-1 bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_OPTIONS.map((f) => (
                              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Operator */}
                        <Select
                          value={rule.operator}
                          onValueChange={(v) => updateRule(i, { operator: v as FilterOperator })}
                        >
                          <SelectTrigger className="h-8 text-xs w-32 bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ops.map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Value */}
                        {arrayValues ? (
                          <Select
                            value={String(rule.value)}
                            onValueChange={(v) => updateRule(i, { value: v })}
                          >
                            <SelectTrigger className="h-8 text-xs w-36 bg-background">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {arrayValues.map((v) => (
                                <SelectItem key={v} value={v}>{v}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            className="h-8 text-xs w-28 bg-background"
                            type={fieldType === 'numeric' ? 'number' : 'text'}
                            value={String(rule.value)}
                            onChange={(e) => updateRule(i, {
                              value: fieldType === 'numeric' ? Number(e.target.value) : e.target.value
                            })}
                            placeholder={fieldType === 'numeric' ? '0' : 'value'}
                          />
                        )}

                        <button onClick={() => removeRule(i)} className="p-1 hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Preview */}
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={handlePreview} disabled={previewLoading} className="gap-2">
                  {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                  Preview Count
                </Button>
                {previewCount !== null && (
                  <div className="flex items-center gap-2 bg-primary/10 text-primary rounded-lg px-3 py-1.5">
                    <Users className="w-4 h-4" />
                    <span className="font-bold">{formatNumber(previewCount)}</span>
                    <span className="text-xs">customers matched</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
                <Button onClick={handleBuilderSave} disabled={saving} className="flex-1 gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create Segment
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
