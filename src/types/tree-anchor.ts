export interface TreeAnchor {
  id: string;
  generation: number;
  /** Normalized horizontal position (0 = left, 1 = right). */
  x: number;
  /** Normalized vertical position (0 = crown top, 1 = roots bottom). */
  y: number;
  side: "left" | "center" | "right";
  branchId: string;
  pairGroup?: string;
  capacity?: number;
}
