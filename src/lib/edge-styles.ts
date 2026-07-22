import type { CSSProperties } from "react";

import type {
  Confidence,
  ParentKind,
  SpouseStatus,
} from "@/types/family";

import {
  DIAGRAM_EDGE_STROKE,
  DIAGRAM_EDGE_STROKE_LIGHT,
  DIAGRAM_EDGE_STROKE_WIDTH,
} from "@/lib/diagram-theme";

const EDGE_STROKE = DIAGRAM_EDGE_STROKE;
const EDGE_STROKE_WIDTH = DIAGRAM_EDGE_STROKE_WIDTH;
const EDGE_STROKE_LIGHT = DIAGRAM_EDGE_STROKE_LIGHT;

export interface EdgeVisualMeta {
  kind?: string;
  parentKind?: ParentKind;
  spouseStatus?: SpouseStatus;
  confidence?: Confidence;
  label?: string;
  relatedIds?: string[];
}

export function parentEdgeStyle(
  parentKind: ParentKind | undefined,
  confidence: Confidence | undefined,
): CSSProperties {
  const uncertain =
    confidence === "probable" || confidence === "uncertain";

  if (parentKind === "adoptive") {
    return {
      stroke: EDGE_STROKE,
      strokeWidth: EDGE_STROKE_WIDTH,
      strokeDasharray: "6 4",
    };
  }

  if (parentKind === "step") {
    return {
      stroke: EDGE_STROKE_LIGHT,
      strokeWidth: EDGE_STROKE_WIDTH,
      strokeDasharray: "2 4",
    };
  }

  if (parentKind === "guardian") {
    return {
      stroke: EDGE_STROKE,
      strokeWidth: EDGE_STROKE_WIDTH,
      strokeDasharray: "5 3",
    };
  }

  if (uncertain) {
    return {
      stroke: EDGE_STROKE,
      strokeWidth: EDGE_STROKE_WIDTH,
      strokeDasharray: "4 3",
    };
  }

  return {
    stroke: EDGE_STROKE,
    strokeWidth: EDGE_STROKE_WIDTH,
  };
}

export function spouseEdgeStyle(
  spouseStatus: SpouseStatus | undefined,
  confidence: Confidence | undefined,
): CSSProperties {
  const uncertain =
    confidence === "probable" || confidence === "uncertain";

  if (spouseStatus === "former") {
    return {
      stroke: EDGE_STROKE_LIGHT,
      strokeWidth: EDGE_STROKE_WIDTH,
      ...(uncertain ? { strokeDasharray: "4 3" } : {}),
    };
  }

  if (uncertain) {
    return {
      stroke: EDGE_STROKE,
      strokeWidth: EDGE_STROKE_WIDTH,
      strokeDasharray: "4 3",
    };
  }

  return {
    stroke: EDGE_STROKE,
    strokeWidth: EDGE_STROKE_WIDTH,
  };
}

export function edgeLabelForMeta(meta: EdgeVisualMeta): string | undefined {
  if (meta.parentKind === "guardian") {
    return "опека";
  }
  if (meta.confidence === "probable" || meta.confidence === "uncertain") {
    return "?";
  }
  return meta.label;
}
