"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

export function JunctionNodeComponent(_props: NodeProps<Node>) {
  return (
    <div className="pointer-events-none relative h-px w-px">
      <Handle
        id="family-in"
        type="target"
        position={Position.Top}
        isConnectable={false}
        style={{ opacity: 0, width: 4, height: 4 }}
      />
      <Handle
        id="family-out"
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        style={{ opacity: 0, width: 4, height: 4 }}
      />
    </div>
  );
}

export const JunctionNode = memo(JunctionNodeComponent);
