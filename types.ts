
export interface Point {
  x: number;
  y: number;
}

export interface Segment extends Point { // Segment is a point with velocity
  vx: number;
  vy: number;
}

export interface LegTip extends Point { // LegTip is also a point with velocity
  vx: number;
  vy: number;
}

export interface Leg {
  attachSegmentIndex: number;
  side: 'left' | 'right';
  length: number;
  angleFromSegment: number; // Resting angle relative to segment's forward direction in radians
  tip: LegTip; 
  phase: number; // For animation cycling
}
