import { Suspense } from "react";
import { OutboxView } from "../../../features/outbox/outbox-view";

export default function OutboxPage() {
  return (
    <Suspense>
      <OutboxView />
    </Suspense>
  );
}
