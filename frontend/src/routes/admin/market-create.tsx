import { createFileRoute } from '@tanstack/react-router';
import { CreateMarketForm } from '../../components/admin/CreateMarketForm';

export const Route = createFileRoute('/admin/market-create')({
  component: CreateMarketPage,
});

function CreateMarketPage() {
  return <CreateMarketForm />;
}
