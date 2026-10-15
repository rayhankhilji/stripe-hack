import { analyzeFinding } from "@ghost/agents";
import { withHandler } from "../../../../../../server/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withHandler(({ params }) => analyzeFinding(params.id ?? ""));
