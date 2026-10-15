import { getFinding } from "@ghost/core";
import { withHandler } from "../../../../../server/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withHandler(({ params }) => getFinding(params.id ?? ""));
