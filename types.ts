export interface Point {
  x: number;
  y: number;
}

export interface Segment { // Updated for kinematic chain
  x: number;
  y: number;
  angle: number;
  length: number; // Base length of the segment
  width: number;  // Current width for drawing the spine
}

// Leg and LegTip types are removed as leg geometry will be calculated procedurally.
