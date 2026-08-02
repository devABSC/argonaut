import SectionPage from "../../SectionPage";

export default async function FinanceTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  return <SectionPage sectionKey="finance" tab={tab} />;
}
