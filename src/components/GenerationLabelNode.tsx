"use client";

import { memo } from "react";
import type { Node, NodeProps } from "@xyflow/react";

interface GenerationLabelData extends Record<string, unknown> {
  label: string;
}

function GenerationLabelNodeComponent({
  data,
}: NodeProps<Node<GenerationLabelData>>) {
  return (
    <div className="pointer-events-none hidden select-none md:block">
      <span className="text-[12px] font-semibold tracking-[0.22em] text-[#8A9A8E] uppercase sm:text-[13px]">
        {data.label}
      </span>
    </div>
  );
}

export const GenerationLabelNode = memo(GenerationLabelNodeComponent);
