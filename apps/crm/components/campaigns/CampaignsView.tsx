'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Campaign } from '@/lib/types';
import { formatNumber, formatPercent, relativeTime } from '@/lib/utils';
import { Plus, Megaphone, Send, BarChart2 } from 'lucide-react';
import { CreateCampaignModal } from './CreateCampaignModal';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

const STATUS_STYLE: Record<string, string> = {
  draft:   'bg-gray-100 text-gray-700',
  sending: 'bg-blue-100 text-blue-700 animate-pulse',
  sent:    'bg-green-100 text-green-700',
  paused:  'bg-yellow-100 text-yellow-700',
};

const CHANNEL_EMOJI: Record<string, string> = {
  whatsapp: '💬',
  sms:      '📱',
  email:    '📧',
  rcs:      '✨',
};

export function CampaignsView() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const preselectedSegment = searchParams.get('segment') ?? undefined;

  const fetchCampaigns = useCallback(async () => {
    const res = await fetch('/api/campaigns');
    const data = await res.json();
    setCampaigns(data.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  // Auto-open create modal if segment param present
  useEffect(() => {
    if (preselectedSegment) setShowCreate(true);
  }, [preselectedSegment]);

  const handleSend = async (campaignId: string) => {
    try {
      setCampaigns((prev) =>
        prev.map((c) => c.id === campaignId ? { ...c, status: 'sending' } : c)
      );
      const res = await fetch(`/api/campaigns/${campaignId}/send`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        toast({ title: 'Send failed', description: data.error, variant: 'destructive' });
        setCampaigns((prev) =>
          prev.map((c) => c.id === campaignId ? { ...c, status: 'draft' } : c)
        );
        return;
      }

      toast({
        title: 'Campaign launched!',
        description: `Sent to ${formatNumber(data.recipientCount)} customers. Tracking updates in real-time.`,
      });

      await fetchCampaigns();
    } catch {
      toast({ title: 'Send failed', variant: 'destructive' });
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Reach your shoppers with personalised messages
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          New Campaign
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : campaigns.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 flex flex-col items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <Megaphone className="w-6 h-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-medium">No campaigns yet</p>
              <p className="text-sm text-muted-foreground mt-1">Launch your first campaign to engage shoppers.</p>
            </div>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Create Campaign
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <CampaignRow key={c.id} campaign={c} onSend={() => handleSend(c.id)} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateCampaignModal
          preselectedSegmentId={preselectedSegment}
          onClose={() => setShowCreate(false)}
          onCreated={(campaign) => {
            setCampaigns((prev) => [campaign, ...prev]);
            setShowCreate(false);
            toast({ title: 'Campaign created!', description: `"${campaign.name}" saved as draft.` });
          }}
        />
      )}
    </div>
  );
}

function CampaignRow({
  campaign,
  onSend,
}: {
  campaign: Campaign & { segment_name?: string };
  onSend: () => void;
}) {
  const deliveryRate = campaign.stat_sent > 0
    ? (campaign.stat_delivered / campaign.stat_sent) * 100
    : null;
  const openRate = campaign.stat_delivered > 0
    ? (campaign.stat_opened / campaign.stat_delivered) * 100
    : null;

  return (
    <div className="border rounded-xl p-4 bg-card hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-2xl mt-0.5">{CHANNEL_EMOJI[campaign.channel] ?? '📨'}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm">{campaign.name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[campaign.status]}`}>
                {campaign.status}
              </span>
              <Badge variant="outline" className="text-xs capitalize">{campaign.channel}</Badge>
            </div>
            {campaign.segment_name && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Segment: {campaign.segment_name}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1 italic">
              &ldquo;{campaign.message_body.slice(0, 100)}{campaign.message_body.length > 100 ? '...' : ''}&rdquo;
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 shrink-0">
          {campaign.stat_sent > 0 && (
            <div className="text-right text-xs text-muted-foreground space-y-0.5">
              <div className="font-medium text-foreground">{formatNumber(campaign.stat_sent)} sent</div>
              {deliveryRate !== null && <div>↗ {formatPercent(deliveryRate)} delivered</div>}
              {openRate !== null && <div>👁 {formatPercent(openRate)} opened</div>}
            </div>
          )}

          <div className="flex gap-2">
            <Link href={`/campaigns/${campaign.id}`}>
              <Button variant="outline" size="sm" className="gap-1 text-xs">
                <BarChart2 className="w-3.5 h-3.5" /> Details
              </Button>
            </Link>
            {campaign.status === 'draft' && (
              <Button size="sm" className="gap-1 text-xs" onClick={onSend}>
                <Send className="w-3.5 h-3.5" /> Send
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-3 pt-3 border-t">
        <span className="text-xs text-muted-foreground">{relativeTime(campaign.created_at)}</span>
        {campaign.stat_sent > 0 && (
          <>
            <span className="text-muted-foreground">·</span>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>✉ {campaign.stat_sent} sent</span>
              <span>✓ {campaign.stat_delivered} delivered</span>
              <span>👁 {campaign.stat_opened} opened</span>
              <span>🖱 {campaign.stat_clicked} clicked</span>
              {campaign.stat_converted > 0 && <span>🛒 {campaign.stat_converted} converted</span>}
              {campaign.stat_failed > 0 && <span className="text-red-500">✗ {campaign.stat_failed} failed</span>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
