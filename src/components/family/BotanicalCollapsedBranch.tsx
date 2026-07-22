"use client";

import { memo } from "react";
import { type Node, type NodeProps } from "@xyflow/react";
import { Leaf } from "lucide-react";

import { BOTANICAL_TOKENS } from "@/lib/botanical-tree-theme";

type CollapsedBranchData = {
  hiddenCount: number;
  anchorPersonId: string;
  branchTitle?: string;
  onExpand?: (personId: string) => void;
};

function BotanicalCollapsedBranchComponent({
  data,
}: NodeProps<Node<CollapsedBranchData>>) {
  const { hiddenCount, anchorPersonId, branchTitle, onExpand } = data;
  const label = branchTitle ?? `+${hiddenCount} родственников`;

  return (
    <button
      type="button"
      className="nodrag nopan nowheel pointer-events-auto flex max-w-[220px] items-center gap-1 rounded-full border bg-[#FFF9F0]/95 px-2.5 py-1 text-[10px] font-medium shadow-sm focus-visible:outline-none focus-visible:ring-2"
      style={{
        borderColor: BOTANICAL_TOKENS.leafSoft,
        color: BOTANICAL_TOKENS.text,
      }}
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onExpand?.(anchorPersonId);
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Leaf className="h-3 w-3 shrink-0" style={{ color: BOTANICAL_TOKENS.leaf }} aria-hidden />
      <span className="truncate">{label}</span>
    </button>
  );
}

export const BotanicalCollapsedBranch = memo(BotanicalCollapsedBranchComponent);
