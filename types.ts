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

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  opacity: number;
  lifespan: number;
  maxLifespan: number;
  size: number;
}

// Leg and LegTip types are removed as leg geometry will be calculated procedurally.