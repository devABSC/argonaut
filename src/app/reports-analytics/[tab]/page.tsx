import SectionPage from "../../SectionPage";

export default async function ReportsTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  return <SectionPage sectionKey="reports-analytics" tab={tab} />;
}
