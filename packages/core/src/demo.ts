// Demo reset: wipe, re-migrate and rebuild everything from the recorded fixtures. Never touches live sources.
import { migrate, resetDatabase } from "@ghost/db";
import { runIngest } from "@ghost/ingest";
import { AppError } from "@ghost/shared";
import { recordAudit } from "./audit";
import { runDetection } from "./detect";
import { runExpansionScan } from "./expansion";

/** Truncates every table, so it is refused unless the deployment is explicitly a demo. */
export async function resetDemo(): Promise<void> {
  if (process.env.DEMO_MODE !== "true") {
    throw new AppError("POLICY_BLOCKED", "Demo reset is disabled: set DEMO_MODE=true to allow wiping data");
  }
  await resetDatabase();
  await migrate();
  const ingest = await runIngest({ source: "fixtures" });
  const detection = await runDetection();
  const expansion = await runExpansionScan();
  await recordAudit({
    actorType: "system",
    actor: "demo",
    kind: "info",
    action: "demo.reset",
    summary: `Demo reset from fixtures: ${detection.created} findings detected, ${expansion.created} expansion opportunities`,
    subjectType: "system",
    subjectId: null,
    externalRef: null,
    data: { ingestRunId: ingest.id, ingestStatus: ingest.status, detection, expansion },
  });
}
