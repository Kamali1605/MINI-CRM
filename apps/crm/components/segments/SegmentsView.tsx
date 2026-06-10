'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Segment, Customer } from '@/lib/types';
import { formatNumber, formatCurrency, relativeTime } from '@/lib/utils';
import {
  Plus, Sparkles, Users, Trash2, ArrowRight,
  ChevronDown, ChevronUp, Loader2, MapPin,
} from 'lucide-react';
import { CreateSegmentModal } from './CreateSegmentModal';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

const TAG_COLORS: Record<string, string> = {
  vip:             'bg-yellow-100 text-yellow-800',
  'repeat-buyer':  'bg-blue-100 text-blue-800',
  loyal:           'bg-green-100 text-green-800',
  'at-risk':       'bg-red-100 text-red-800',
  new:             'bg-purple-100 text-purple-800',
  'high-aov':      'bg-orange-100 text-orange-800',
  'discount-seeker': 'bg-gray-100 text-gray-800',
};

export function SegmentsView() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const { toast } = useToast();

  const fetchSegments = async () => {
    const res = await fetch('/api/segments');
    const data = await res.json();
    setSegments(data.data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchSegments(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this segment?')) return;
    await fetch(`/api/segments/${id}`, { method: 'DELETE' });
    setSegments((prev) => prev.filter((s) => s.id !== id));
    toast({ title: 'Segment deleted' });
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Segments</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Define audience groups to target in campaigns
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          New Segment
        </Button>
      </div>

      {/* AI tip */}
      <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl p-4">
        <Sparkles className="w-5 h-5 text-primary shrink-0" />
        <p className="text-sm">
          <strong>AI-powered:</strong> Describe your audience in plain English and the AI builds the rules.
          Try &ldquo;customers who spent over ₹5000 and haven&apos;t purchased in 45 days&rdquo;.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-36 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : segments.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 flex flex-col items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-medium">No segments yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first audience segment to get started.
              </p>
            </div>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Create Segment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {segments.map((s) => (
            <SegmentCard
              key={s.id}
              segment={s}
              onDelete={() => handleDelete(s.id)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateSegmentModal
          onClose={() => setShowCreate(false)}
          onCreated={(seg) => {
            setSegments((prev) => [seg, ...prev]);
            setShowCreate(false);
            toast({ title: 'Segment created', description: `"${seg.name}" with ${seg.customer_count} customers` });
          }}
        />
      )}
    </div>
  );
}

function SegmentCard({ segment, onDelete }: { segment: Segment; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const toggleCustomers = async () => {
    if (!expanded && customers.length === 0) {
      setLoadingCustomers(true);
      try {
        const res = await fetch(`/api/segments/${segment.id}?include=customers`);
        const data = await res.json();
        setCustomers(data.customers ?? []);
      } finally {
        setLoadingCustomers(false);
      }
    }
    setExpanded((prev) => !prev);
  };

  return (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold truncate">{segment.name}</CardTitle>
              {segment.ai_prompt && (
                <Badge variant="info" className="text-xs gap-1 shrink-0">
                  <Sparkles className="w-3 h-3" /> AI
                </Badge>
              )}
            </div>
            {segment.description && (
              <p className="text-xs text-muted-foreground mt-1">{segment.description}</p>
            )}
          </div>
          <button
            onClick={onDelete}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-destructive ml-2"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Stats row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-primary/10 text-primary rounded-lg px-2.5 py-1">
              <Users className="w-3.5 h-3.5" />
              <span className="text-sm font-semibold">{formatNumber(segment.customer_count)}</span>
            </div>
            <span className="text-xs text-muted-foreground">customers</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{relativeTime(segment.created_at)}</span>
            <button
              onClick={toggleCustomers}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-accent"
            >
              {loadingCustomers ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : expanded ? (
                <><ChevronUp className="w-3.5 h-3.5" /> Hide</>
              ) : (
                <><ChevronDown className="w-3.5 h-3.5" /> View customers</>
              )}
            </button>
            <Link href={`/campaigns?segment=${segment.id}`}>
              <Button size="sm" variant="ghost" className="text-xs gap-1 h-7 px-2">
                Use <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Customer list — expandable */}
        {expanded && (
          <div className="border rounded-xl overflow-hidden">
            {customers.length === 0 ? (
              <p className="text-xs text-muted-foreground p-4 text-center">No customers matched</p>
            ) : (
              <>
                <div className="bg-muted/40 px-4 py-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Showing {Math.min(customers.length, 50)} of {formatNumber(segment.customer_count)} customers
                  </span>
                </div>
                <div className="divide-y max-h-72 overflow-y-auto">
                  {customers.slice(0, 50).map((c) => (
                    <Link
                      key={c.id}
                      href={`/customers/${c.id}`}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-semibold text-primary">
                          {c.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{c.name}</p>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            {c.city && <><MapPin className="w-2.5 h-2.5" />{c.city}</>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-medium">{formatCurrency(c.total_spent)}</span>
                        {c.tags && c.tags.length > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${TAG_COLORS[c.tags[0]] ?? 'bg-gray-100 text-gray-700'}`}>
                            {c.tags[0]}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
                {segment.customer_count > 50 && (
                  <div className="px-4 py-2 bg-muted/20 text-center">
                    <Link href={`/customers`} className="text-xs text-primary hover:underline">
                      View all {formatNumber(segment.customer_count)} customers →
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
