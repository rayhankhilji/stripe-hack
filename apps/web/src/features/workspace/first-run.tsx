"use client";

import type { AuditEventDTO } from "@ghost/shared";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { ActivityStream } from "../../components/ghost/activity-stream";
import { Logo } from "../../components/ghost/logo";
import { SystemIcon } from "../../components/ghost/system-icon";
import { Button } from "../../components/ui/button";
import { useRunDetection, useRunIngest } from "../../lib/queries";
import { cn } from "../../lib/cn";
import { SYSTEM_LABEL, SYSTEM_ORDER } from "./copy";
import { MutationNotice } from "./mutation-notice";

type Step = "idle" | "sync" | "hunt" | "done";

/**
 * First run: nothing has been ingested. One action connects the company: it syncs every system, then runs the
 * detector, while the audit stream shows each step. When detection finishes the overview refetches and the
 * workspace replaces this screen.
 */
export function FirstRun({ events }: { events: AuditEventDTO[] }) {
  const ingest = useRunIngest();
  const detect = useRunDetection();
  const [step, setStep] = useState<Step>("idle");
  const running = step === "sync" || step === "hunt";

  async function connect() {
    ingest.reset();
    detect.reset();
    setStep("sync");
    try {
      const run = await ingest.mutateAsync({ source: "fixtures" });
      if (run.status === "failed") {
        setStep("idle");
        return;
      }
      setStep("hunt");
      await detect.mutateAsync();
      setStep("done");
    } catch {
      // The mutation keeps the error; MutationNotice renders it. Return to idle so the operator can retry.
      setStep("idle");
    }
  }

  return (
    <section
      aria-labelledby="first-run-headline"
      className="relative overflow-hidden rounded-panel bg-forest px-6 py-10 text-porcelain shadow-soft md:px-12 md:py-14"
    >
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        <div>
          <span className="grid size-14 place-items-center rounded-card bg-forest-2">
            <Logo variant="mark" className="size-8" />
          </span>
          <p className="mt-8 font-mono text-xs uppercase tracking-widest text-petal/80">Agent workspace · first run</p>
          <h1
            id="first-run-headline"
            className="mt-3 font-display text-4xl font-semibold leading-tight text-petal text-balance md:text-5xl"
          >
            Connect Sapora Networks
          </h1>
          <p className="mt-4 max-w-md text-porcelain/70">
            Ghost reads seven systems of record, resolves each customer across them, and checks every closed-won deal for
            revenue that was never billed. Nothing is invoiced without your approval.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button size="md" variant="primary" onClick={() => void connect()} disabled={running} loading={running}>
              {running ? "Connecting…" : "Connect Sapora Networks"}
              {running ? null : <ArrowRight aria-hidden className="size-4" />}
            </Button>
            <span className="text-xs text-porcelain/60">Reads the recorded Era snapshot · about a minute</span>
          </div>

          <ol className="mt-8 space-y-2" aria-label="Connection progress">
            <ProgressRow label="Sync seven systems" state={stepState(step, "sync")} />
            <ProgressRow label="Hunt for unbilled revenue" state={stepState(step, "hunt")} />
          </ol>

          <div className="mt-4">
            <MutationNotice
              results={[
                {
                  key: "ingest",
                  error: ingest.error,
                  message: ingest.data && ingest.data.status !== "succeeded" ? `Sync ${ingest.data.status}${ingest.data.error ? `: ${ingest.data.error}` : "."}` : null,
                  warn: true,
                  onDismiss: ingest.reset,
                },
                { key: "detect", error: detect.error, message: null, onDismiss: detect.reset },
              ]}
            />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Systems Ghost will read">
            {SYSTEM_ORDER.map((system) => (
              <li key={system} className="flex items-center gap-2 rounded-control bg-forest-2 px-3 py-2">
                <SystemIcon system={system} size="sm" />
                <span className="truncate text-xs text-porcelain/80">{SYSTEM_LABEL[system]}</span>
              </li>
            ))}
          </ul>
          <div className="min-h-48 rounded-card bg-forest-2 p-4">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-porcelain/60">Live activity</h2>
            {events.length === 0 ? (
              <p className="text-sm text-porcelain/60">
                {running ? "Waiting for the first audit event…" : "Each step Ghost takes will stream here as it happens."}
              </p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <ActivityStream events={events.slice(0, 12)} tone="dark" />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

type RowState = "pending" | "active" | "done";

function stepState(step: Step, row: "sync" | "hunt"): RowState {
  const order: Step[] = ["idle", "sync", "hunt", "done"];
  const at = order.indexOf(step);
  const mine = order.indexOf(row);
  if (at > mine) return "done";
  if (at === mine) return "active";
  return "pending";
}

function ProgressRow({ label, state }: { label: string; state: RowState }) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <span
        aria-hidden
        className={cn(
          "grid size-5 place-items-center rounded-full",
          state === "done" && "bg-lime text-forest",
          state === "active" && "bg-petal text-forest",
          state === "pending" && "border border-porcelain/25",
        )}
      >
        {state === "done" ? <Check className="size-3" strokeWidth={3} /> : null}
        {state === "active" ? <LoaderCircle className="size-3 animate-spin motion-reduce:animate-none" strokeWidth={3} /> : null}
      </span>
      <span className={cn(state === "pending" ? "text-porcelain/50" : "text-porcelain")}>{label}</span>
      <span className="sr-only">{state}</span>
    </li>
  );
}
