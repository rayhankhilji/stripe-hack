import type { Metadata } from "next";
import { Suspense } from "react";
import { RecoveryQueue } from "../../../features/recovery/recovery-queue";

export const metadata: Metadata = { title: "Recovery · Ghost" };

export default function RecoveryPage() {
  // The queue reads its status tab from the URL, which needs a Suspense boundary.
  return (
    <Suspense>
      <RecoveryQueue />
    </Suspense>
  );
}
