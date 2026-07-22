/** Premium palette for diagram (schema) mode. */
export const DIAGRAM_TOKENS = {
  bg: "#F5F0E8",
  bgWarm: "#FAF6EF",
  surface: "#FFFCF8",
  surfaceHover: "#FFFDF9",
  border: "#D9CEBD",
  borderActive: "#2D4A3E",
  text: "#152A21",
  textMuted: "#5A6B62",
  accent: "#2D4A3E",
  gold: "#B8953D",
  goldSoft: "rgba(196, 169, 98, 0.28)",
  shadow: "rgba(31, 51, 42, 0.12)",
  shadowHover: "rgba(31, 51, 42, 0.16)",
  edge: "#5A7568",
  edgeLight: "#8FA399",
  edgeActive: "#1F332A",
  edgeDim: 0.28,
} as const;

export const DIAGRAM_EDGE_STROKE = DIAGRAM_TOKENS.edge;
export const DIAGRAM_EDGE_STROKE_LIGHT = DIAGRAM_TOKENS.edgeLight;
export const DIAGRAM_EDGE_STROKE_WIDTH = 2.25;
export const DIAGRAM_EDGE_STROKE_WIDTH_ACTIVE = 2.75;
