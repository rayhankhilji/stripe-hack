import { Fragment, useMemo } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import type { EvidenceDTO, FindingDetailDTO } from "@ghost/shared";
import { CaseSection } from "./case-section";
import { resolveCitation } from "./case-model";
import { parseMarkdown, type Block, type Inline } from "./markdown";

type Props = {
  finding: FindingDetailDTO;
  onCite: (evidenceId: string) => void;
};

export function ExplanationSection({ finding, onCite }: Props) {
  const explanation = finding.explanation;
  const blocks = useMemo(() => (explanation ? parseMarkdown(explanation.bodyMd) : []), [explanation]);

  if (!explanation) {
    return (
      <CaseSection id="explanation" title="Agent explanation">
        <p className="text-sm leading-relaxed text-fg-muted">
          {finding.status === "analyzing"
            ? "Ghost is investigating this case. The explanation appears here once every citation is checked against the evidence."
            : "Ghost hasn't investigated this case yet. Run the investigation to get an explanation that cites each source record."}
        </p>
      </CaseSection>
    );
  }

  const template = explanation.model.startsWith("template@");
  return (
    <CaseSection
      id="explanation"
      title="Agent explanation"
      aside={
        <span className="inline-flex items-center gap-1.5">
          {explanation.validated ? (
            <ShieldCheck className="size-3.5 text-lime-deep dark:text-lime" aria-hidden />
          ) : (
            <ShieldAlert className="size-3.5 text-punch" aria-hidden />
          )}
          <span>{explanation.validated ? "Citations and amounts validated" : "Not validated"}</span>
          <span aria-hidden>·</span>
          <span className="font-mono">{template ? "deterministic template" : explanation.model}</span>
          <span aria-hidden>·</span>
          <span className="font-mono">{explanation.promptVersion}</span>
        </span>
      }
    >
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-fg-muted">
        {blocks.map((b, i) => (
          <MarkdownBlock key={i} block={b} explanation={explanation} evidence={finding.evidence} onCite={onCite} />
        ))}
      </div>
    </CaseSection>
  );
}

type Ctx = {
  explanation: NonNullable<FindingDetailDTO["explanation"]>;
  evidence: EvidenceDTO[];
  onCite: (id: string) => void;
};

function MarkdownBlock({ block, ...ctx }: { block: Block } & Ctx) {
  switch (block.type) {
    case "heading": {
      const Tag = `h${block.level + 1}` as "h3" | "h4" | "h5";
      return (
        <Tag className="pt-1 text-sm font-semibold text-fg">
          <Inlines nodes={block.content} {...ctx} />
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p>
          <Inlines nodes={block.content} {...ctx} />
        </p>
      );
    case "list": {
      const List = block.ordered ? "ol" : "ul";
      return (
        <List
          className={block.ordered ? "flex list-decimal flex-col gap-1.5 pl-5" : "flex list-disc flex-col gap-1.5 pl-5"}
        >
          {block.items.map((item, i) => (
            <li key={i} className="marker:text-fg-subtle">
              <Inlines nodes={item} {...ctx} />
            </li>
          ))}
        </List>
      );
    }
  }
}

function Inlines({ nodes, ...ctx }: { nodes: Inline[] } & Ctx) {
  return (
    <>
      {nodes.map((n, i) => (
        <Fragment key={i}>
          <InlineNode node={n} {...ctx} />
        </Fragment>
      ))}
    </>
  );
}

function InlineNode({ node, explanation, evidence, onCite }: { node: Inline } & Ctx) {
  switch (node.type) {
    case "text":
      return node.text;
    case "strong":
      return <strong className="font-semibold text-fg">{node.text}</strong>;
    case "em":
      return <em>{node.text}</em>;
    case "code":
      return <code className="rounded bg-surface-muted px-1 py-0.5 font-mono text-xs">{node.text}</code>;
    case "cite":
      return (
        <CitationChip
          n={node.n}
          target={resolveCitation(node.n, explanation.citedEvidenceIds, evidence)}
          onCite={onCite}
        />
      );
  }
}

function CitationChip({ n, target, onCite }: { n: number; target: EvidenceDTO | null; onCite: (id: string) => void }) {
  if (!target) {
    // The validator should prevent this; if it ever happens, show it as unresolved rather than hide it.
    return (
      <span
        className="mx-0.5 rounded bg-punch/10 px-1 font-mono text-xs text-punch"
        title="Citation does not match any evidence"
      >
        E{n}?
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onCite(target.id)}
      title={`${target.source.title} — ${target.quote}`}
      className="mx-0.5 inline-flex items-center rounded-md bg-petal/50 px-1.5 align-baseline font-mono text-xs font-medium text-forest transition-colors duration-200 hover:bg-petal focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
    >
      E{n}
    </button>
  );
}
