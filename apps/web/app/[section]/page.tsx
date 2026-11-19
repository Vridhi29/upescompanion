import { FeatureWorkspace } from "@/components/FeatureWorkspace";

export default async function FeaturePage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return <FeatureWorkspace section={section} />;
}
