import SectionPage from "../../SectionPage";

export default async function ServiceDeskTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  return <SectionPage sectionKey="service-desk" tab={tab} />;
}
