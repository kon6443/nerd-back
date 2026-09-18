import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface LibraryCaptureRedirectProps {
  params: Promise<{ slug: string }>;
}

export default async function LibraryCaptureRedirectPage({ params }: LibraryCaptureRedirectProps) {
  const { slug } = await params;
  redirect(`/stories/${encodeURIComponent(slug)}/capture`);
}
