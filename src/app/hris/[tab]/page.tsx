import SectionPage from "../../SectionPage";

export default async function HrisTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  return <SectionPage sectionKey="hris" tab={tab} />;
}
