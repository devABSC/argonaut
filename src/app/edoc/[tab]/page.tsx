import SectionPage from "../../SectionPage";

export default async function EdocTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  return <SectionPage sectionKey="edoc" tab={tab} />;
}
