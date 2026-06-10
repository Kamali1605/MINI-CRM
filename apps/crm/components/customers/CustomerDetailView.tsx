'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Customer, Order } from '@/lib/types';
import { formatCurrency, formatDateTime, relativeTime } from '@/lib/utils';
import { ArrowLeft, Mail, Phone, MapPin, ShoppingBag } from 'lucide-react';
import Link from 'next/link';

export function CustomerDetailView({ id }: { id: string }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/customers/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setCustomer(data.customer);
        setOrders(data.orders ?? []);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-40 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  if (!customer) return <div className="p-8 text-muted-foreground">Customer not found.</div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/customers">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{customer.name}</h1>
          <p className="text-muted-foreground text-sm">Customer since {relativeTime(customer.created_at)}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Profile card */}
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <span>{customer.email}</span>
            </div>
            {customer.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{customer.phone}</span>
              </div>
            )}
            {customer.city && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span>{customer.city}</span>
              </div>
            )}
            {customer.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-2">
                {customer.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">Purchase Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground">Lifetime Spend</p>
              <p className="text-2xl font-bold">{formatCurrency(customer.total_spent)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Total Orders</p>
                <p className="text-lg font-semibold">{customer.order_count}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg. Order</p>
                <p className="text-lg font-semibold">
                  {customer.order_count > 0
                    ? formatCurrency(customer.total_spent / customer.order_count)
                    : '—'}
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last Purchase</p>
              <p className="text-sm font-medium">{relativeTime(customer.last_order_at)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">Actions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Link href={`/campaigns?customer=${id}`}>
              <Button variant="outline" className="w-full justify-start gap-2" size="sm">
                <ShoppingBag className="w-4 h-4" />
                Create Campaign
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Order history */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Order History ({orders.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {orders.length === 0 ? (
            <p className="text-muted-foreground text-sm px-6 py-4">No orders yet</p>
          ) : (
            <div className="divide-y">
              {orders.map((o) => (
                <div key={o.id} className="px-6 py-4 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">{o.category}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDateTime(o.ordered_at)}</span>
                    </div>
                    {Array.isArray(o.items) && (
                      <p className="text-sm mt-1 text-muted-foreground">
                        {o.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}
                      </p>
                    )}
                  </div>
                  <p className="font-semibold">{formatCurrency(o.total)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
