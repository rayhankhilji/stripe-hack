import { listOutbox } from "@ghost/core";
import { OutboxStatus, AppError } from "@ghost/shared";
import { withHandler } from "../../../../server/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withHandler(({ searchParams }) => {
  const raw = searchParams.get("status");
  if (raw === null) return listOutbox();
  const status = OutboxStatus.safeParse(raw);
  if (!status.success) throw new AppError("VALIDATION", "Unknown outbox status", { status: raw, allowed: OutboxStatus.options });
  return listOutbox(status.data);
});
