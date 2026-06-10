'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Campaign, Communication } from '@/lib/types';
import { formatNumber, formatPercent, relativeTime, formatDateTime } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  ArrowLeft, Send, RefreshCw, CheckCircle2, Eye, MousePointerClick,
  XCircle, ShoppingCart,
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

const STATUS_COLOR: Record<string, string> = {
  queued:    'bg-gray-100 text-gray-600',
  sent:      'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  opened:    'bg-violet-100 text-violet-700',
  clicked:   'bg-orange-100 text-orange-700',
  converted: 'bg-emerald-100 text-emerald-700',
  failed:    'bg-red-100 text-red-700',
};

export function CampaignDetailView({ id }: { id: string }) {
  const [campaign, setCampaign] = useState<Campaign & { segment_name?: string } | null>(null);
  const [comms, setComms] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/campaigns/${id}`);
    const data = await res.json();
    setCampaign(data.campaign);
    setComms(data.communications ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh while campaign is sending
  useEffect(() => {
    if (campaign?.status !== 'sending' && campaign?.status !== 'sent') return;
    if (campaign.status === 'sent' && campaign.stat_delivered + campaign.stat_failed === campaign.stat_sent) return;

    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [campaign?.status, campaign?.stat_sent, campaign?.stat_delivered, campaign?.stat_failed, fetchData]);

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/send`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Send failed', description: data.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Campaign launched!', description: `Dispatched to ${formatNumber(data.recipientCount)} customers` });
      await fetchData();
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="h-40 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  if (!campaign) return <div className="p-8 text-muted-foreground">Campaign not found.</div>;

  const deliveryRate = campaign.stat_sent > 0 ? (campaign.stat_delivered / campaign.stat_sent) * 100 : 0;
  const openRate     = campaign.stat_delivered > 0 ? (campaign.stat_opened / campaign.stat_delivered) * 100 : 0;
  const clickRate    = campaign.stat_opened > 0 ? (campaign.stat_clicked / campaign.stat_opened) * 100 : 0;

  const funnelData = [
    { name: 'Sent',      value: campaign.stat_sent,      fill: '#6366f1' },
    { name: 'Delivered', value: campaign.stat_delivered, fill: '#10b981' },
    { name: 'Opened',    value: campaign.stat_opened,    fill: '#f59e0b' },
    { name: 'Clicked',   value: campaign.stat_clicked,   fill: '#3b82f6' },
    { name: 'Converted', value: campaign.stat_converted, fill: '#8b5cf6' },
  ].filter((d) => d.value > 0);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/campaigns">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{campaign.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                campaign.status === 'sent' ? 'bg-green-100 text-green-700' :
                campaign.status === 'sending' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                'bg-gray-100 text-gray-700'
              }`}>{campaign.status}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {campaign.segment_name ?? 'No segment'} · {campaign.channel.toUpperCase()} · {relativeTime(campaign.created_at)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          {campaign.status === 'draft' && (
            <Button size="sm" onClick={handleSend} disabled={sending} className="gap-2">
              <Send className="w-3.5 h-3.5" />
              {sending ? 'Launching...' : 'Launch Campaign'}
            </Button>
          )}
        </div>
      </div>

      {/* Message preview */}
      <Card className="border-0 shadow-sm bg-primary/5 border-primary/10">
        <CardContent className="pt-4">
          <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">Message</p>
          <p className="text-sm whitespace-pre-wrap">{campaign.message_body}</p>
        </CardContent>
      </Card>

      {/* Stats row */}
      {campaign.stat_sent > 0 && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { icon: Send,              label: 'Sent',      value: campaign.stat_sent,      color: 'text-indigo-600',  bg: 'bg-indigo-50' },
              { icon: CheckCircle2,      label: 'Delivered', value: campaign.stat_delivered, color: 'text-green-600',   bg: 'bg-green-50',  rate: deliveryRate },
              { icon: Eye,               label: 'Opened',    value: campaign.stat_opened,    color: 'text-amber-600',   bg: 'bg-amber-50',  rate: openRate },
              { icon: MousePointerClick, label: 'Clicked',   value: campaign.stat_clicked,   color: 'text-blue-600',    bg: 'bg-blue-50',   rate: clickRate },
              { icon: ShoppingCart,      label: 'Converted', value: campaign.stat_converted, color: 'text-purple-600',  bg: 'bg-purple-50' },
            ].map(({ icon: Icon, label, value, color, bg, rate }) => (
              <Card key={label} className="border-0 shadow-sm">
                <CardContent className="pt-5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-1.5 rounded-lg ${bg}`}>
                      <Icon className={`w-3.5 h-3.5 ${color}`} />
                    </div>
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                  <p className="text-2xl font-bold">{formatNumber(value)}</p>
                  {rate !== undefined && (
                    <p className="text-xs text-muted-foreground mt-0.5">{formatPercent(rate)}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Failed */}
          {campaign.stat_failed > 0 && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">
              <XCircle className="w-4 h-4" />
              {campaign.stat_failed} messages failed to deliver
            </div>
          )}

          {/* Funnel chart */}
          {funnelData.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Engagement Funnel</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={funnelData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
                    <Tooltip formatter={(v) => [formatNumber(Number(v)), '']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {funnelData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Communications table */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Individual Messages ({formatNumber(comms.length)} shown)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {comms.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 py-4">
              {campaign.status === 'draft' ? 'Launch the campaign to see messages here.' : 'No messages yet.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left font-medium text-muted-foreground px-6 py-3">Customer</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Status</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Sent</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Delivered</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Opened</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {comms.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30">
                      <td className="px-6 py-3">
                        <p className="font-medium">{c.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{c.customer_email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[c.status] ?? ''}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{relativeTime(c.sent_at)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{relativeTime(c.delivered_at)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{relativeTime(c.opened_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
