import SectionPage from "../../SectionPage";

export default async function CarTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  return <SectionPage sectionKey="car" tab={tab} />;
}
