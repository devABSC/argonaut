import SectionPage from "../../SectionPage";

export default async function ProjectTab({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  return <SectionPage sectionKey="project" tab={tab} />;
}
