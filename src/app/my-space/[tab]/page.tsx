import SectionPage from "../../SectionPage";

export default async function MySpaceTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  return <SectionPage sectionKey="my-space" tab={tab} />;
}
