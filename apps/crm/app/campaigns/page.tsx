import { Suspense } from 'react';
import { CampaignsView } from '@/components/campaigns/CampaignsView';

export const dynamic = 'force-dynamic';

export default function CampaignsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">Loading...</div>}>
      <CampaignsView />
    </Suspense>
  );
}
