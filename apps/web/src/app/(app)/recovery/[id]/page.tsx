import type { Metadata } from "next";
import { CaseView } from "../../../../features/recovery/case-view";

export const metadata: Metadata = { title: "Recovery case · Ghost" };

export default async function RecoveryCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CaseView id={id} />;
}
