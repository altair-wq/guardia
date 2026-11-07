import { DecisionDetail } from "@/components/DecisionDetail";

export default async function Page({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  return <DecisionDetail invoiceId={decodeURIComponent(invoiceId)} />;
}
