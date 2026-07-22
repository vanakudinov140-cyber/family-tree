"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

function UnionNodeComponent(_props: NodeProps<Node>) {
  return (
    <div className="pointer-events-none relative h-[18px] w-[18px]">
      <Handle
        id="spouse-left"
        type="target"
        position={Position.Left}
        isConnectable={false}
        style={{ opacity: 0, width: 8, height: 8, pointerEvents: "none" }}
      />
      <Handle
        id="spouse-right"
        type="source"
        position={Position.Right}
        isConnectable={false}
        style={{ opacity: 0, width: 8, height: 8, pointerEvents: "none" }}
      />
      <Handle
        id="family-in"
        type="target"
        position={Position.Top}
        isConnectable={false}
        style={{ opacity: 0, width: 8, height: 8, pointerEvents: "none" }}
      />
      <Handle
        id="family-out"
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        style={{ opacity: 0, width: 8, height: 8, pointerEvents: "none" }}
      />

      <div
        className="pointer-events-none absolute inset-0 m-auto h-[14px] w-[14px] rounded-full border-2 border-[#7E9186] bg-[#F7F3ED] shadow-[0_1px_4px_rgba(45,74,62,0.12)]"
        aria-hidden
      >
        <div className="mx-auto mt-[3px] h-[4px] w-[4px] rounded-full bg-[#C4A962]/80" />
      </div>
    </div>
  );
}

export const UnionNode = memo(UnionNodeComponent);
