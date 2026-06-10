'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from 'recharts';
import {
  Users, Megaphone, MessageSquare, TrendingUp,
  ArrowUpRight, CheckCircle2, Eye, MousePointerClick, ShoppingCart,
} from 'lucide-react';
import { DashboardStats, Campaign } from '@/lib/types';
import { formatNumber, formatPercent, formatDate, relativeTime } from '@/lib/utils';
import Link from 'next/link';

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

const CHANNEL_COLOR: Record<string, string> = {
  whatsapp: '#25D366',
  sms:      '#6366f1',
  email:    '#f59e0b',
  rcs:      '#8b5cf6',
};

interface ChannelStat {
  channel: string;
  total_sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  failed: number;
  delivery_rate: number;
  open_rate: number;
}

interface ExtendedStats extends DashboardStats {
  channelStats?: ChannelStat[];
  totalConverted?: number;
  campaignsWithConversions?: number;
}

export function DashboardView() {
  const [stats, setStats] = useState<ExtendedStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((data) => {
        setStats({
          ...data,
          communicationsByDay: data.communicationsByDay ?? [],
          recentCampaigns: data.recentCampaigns ?? [],
          topSegments: data.topSegments ?? [],
          channelStats: data.channelStats ?? [],
        });
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const metricCards = [
    {
      title: 'Total Customers',
      value: formatNumber(stats.totalCustomers),
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'Campaigns Sent',
      value: formatNumber(stats.totalCampaigns),
      icon: Megaphone,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
    {
      title: 'Messages Dispatched',
      value: formatNumber(stats.totalCommunications),
      icon: MessageSquare,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      title: 'Conversions',
      value: formatNumber(stats.totalConverted ?? 0),
      icon: ShoppingCart,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
  ];

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Real-time overview of your shopper engagement
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map(({ title, value, icon: Icon, color, bg }) => (
          <Card key={title} className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{title}</p>
                  <p className="text-2xl font-bold mt-1">{value}</p>
                </div>
                <div className={`p-2.5 rounded-lg ${bg}`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Engagement rates */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Delivery Rate</p>
                <p className="text-xl font-bold">{formatPercent(stats.avgDeliveryRate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Eye className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Open Rate</p>
                <p className="text-xl font-bold">{formatPercent(stats.avgOpenRate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <MousePointerClick className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Click Rate</p>
                <p className="text-xl font-bold">{formatPercent(stats.avgClickRate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-3 gap-6">
        {/* Activity chart */}
        <Card className="col-span-2 border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Message Activity (14 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.communicationsByDay.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                No data yet — send your first campaign!
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={stats.communicationsByDay}>
                  <defs>
                    <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="openGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => {
                    const dt = new Date(d);
                    return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                  }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    labelFormatter={(d) => formatDate(d)}
                  />
                  <Area type="monotone" dataKey="sent"   name="Sent"   stroke="#6366f1" fill="url(#sentGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="opened" name="Opened" stroke="#10b981" fill="url(#openGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Top segments */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Top Segments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.topSegments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No segments yet</p>
            ) : (
              stats.topSegments.map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm truncate max-w-[160px]">{s.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {formatNumber(s.customer_count)}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Channel performance breakdown */}
      {stats.channelStats && stats.channelStats.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Channel Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {stats.channelStats.map((ch) => (
                <div key={ch.channel} className="border rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{CHANNEL_EMOJI[ch.channel] ?? '📨'}</span>
                    <span className="font-semibold text-sm capitalize">{ch.channel}</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Sent</span>
                      <span className="font-medium">{formatNumber(ch.total_sent)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Delivery</span>
                      <span className="font-medium text-green-600">{ch.delivery_rate}%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Opens</span>
                      <span className="font-medium text-blue-600">{ch.open_rate}%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Conversions</span>
                      <span className="font-medium text-purple-600">{formatNumber(ch.converted)}</span>
                    </div>
                  </div>
                  {/* Delivery rate bar */}
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${ch.delivery_rate}%`,
                        backgroundColor: CHANNEL_COLOR[ch.channel] ?? '#6366f1',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent campaigns */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Campaigns</CardTitle>
          <Link href="/campaigns" className="text-xs text-primary hover:underline flex items-center gap-1">
            View all <ArrowUpRight className="w-3 h-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {stats.recentCampaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No campaigns yet —{' '}
              <Link href="/campaigns" className="text-primary hover:underline">create one</Link>
            </p>
          ) : (
            <div className="space-y-3">
              {stats.recentCampaigns.map((c: Campaign & { segment_name?: string }) => {
                const deliveryRate = c.stat_sent > 0
                  ? Math.round((c.stat_delivered / c.stat_sent) * 100)
                  : null;
                return (
                  <Link
                    key={c.id}
                    href={`/campaigns/${c.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{CHANNEL_EMOJI[c.channel] ?? '📨'}</span>
                      <div>
                        <p className="text-sm font-medium group-hover:text-primary transition-colors">
                          {c.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {c.segment_name ?? 'No segment'} · {relativeTime(c.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {c.stat_sent > 0 && (
                        <div className="text-right text-xs text-muted-foreground">
                          <div>{formatNumber(c.stat_sent)} sent</div>
                          {deliveryRate !== null && (
                            <div className="text-green-600">{deliveryRate}% delivered</div>
                          )}
                        </div>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[c.status] ?? ''}`}>
                        {c.status}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
