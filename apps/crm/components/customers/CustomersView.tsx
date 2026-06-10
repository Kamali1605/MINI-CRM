'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Customer } from '@/lib/types';
import { formatCurrency, formatNumber, relativeTime } from '@/lib/utils';
import { Search, Users, ChevronLeft, ChevronRight } from 'lucide-react';
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

export function CustomersView() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);

  const PAGE_SIZE = 50;

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      ...(search ? { search } : {}),
    });
    const res = await fetch(`/api/customers?${params}`);
    const data = await res.json();
    setCustomers(data.data ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [page, search]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {formatNumber(total)} total shoppers
          </p>
        </div>
        <div className="flex items-center gap-2 bg-primary/10 text-primary rounded-lg px-3 py-1.5">
          <Users className="w-4 h-4" />
          <span className="text-sm font-medium">{formatNumber(total)}</span>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            className="pl-9"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline">Search</Button>
        {search && (
          <Button type="button" variant="ghost" onClick={() => { setSearch(''); setSearchInput(''); setPage(1); }}>
            Clear
          </Button>
        )}
      </form>

      {/* Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All Customers</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : customers.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No customers found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left font-medium text-muted-foreground px-6 py-3">Customer</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">City</th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-3">Lifetime Spend</th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-3">Orders</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Last Order</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Tags</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-3">
                        <Link href={`/customers/${c.id}`} className="font-medium hover:text-primary transition-colors">
                          {c.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{c.email}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{c.city ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(c.total_spent)}</td>
                      <td className="px-4 py-3 text-right">{c.order_count}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{relativeTime(c.last_order_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {c.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${TAG_COLORS[tag] ?? 'bg-gray-100 text-gray-700'}`}
                            >
                              {tag}
                            </span>
                          ))}
                          {c.tags.length > 2 && (
                            <span className="text-xs text-muted-foreground">+{c.tags.length - 2}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {formatNumber(total)}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="flex items-center text-sm px-3">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
