import { CampaignDetailView } from '@/components/campaigns/CampaignDetailView';
export const dynamic = 'force-dynamic';
export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CampaignDetailView id={id} />;
}
