interface ProposalDiffProps {
  beforeLabel?: string;
  afterLabel?: string;
  before: unknown;
  after: unknown;
}

export function ProposalDiff({
  beforeLabel = "Было",
  afterLabel = "Предлагается",
  before,
  after,
}: ProposalDiffProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-[#E4DDD1] bg-[#FAF7F1] p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#5C6B63]">
          {beforeLabel}
        </p>
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs text-[#2D4A3E]">
          {JSON.stringify(before, null, 2)}
        </pre>
      </div>
      <div className="rounded-xl border border-[#C4A962]/40 bg-[#FFFCF7] p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#5C6B63]">
          {afterLabel}
        </p>
        <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs text-[#2D4A3E]">
          {JSON.stringify(after, null, 2)}
        </pre>
      </div>
    </div>
  );
}
