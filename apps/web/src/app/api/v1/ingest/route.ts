import { IngestBody } from "@ghost/shared";
import { runIngest } from "../../../../../../../packages/ingest/src/index";
import { withHandler } from "../../../../server/handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withHandler(({ body }) => runIngest({ source: body.source }), { body: IngestBody });
