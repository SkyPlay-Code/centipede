
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Point, Segment } from '../types';

// --- Configuration & Constants ---
// const REPTILE_SPEED = 3.5; // No longer used for head, head is instant. Retained for context.
const SEGMENT_COUNT = 45;
const BASE_SEGMENT_LENGTH = 9;

// Leg properties
const LEG_PAIRS = 5;
const LEG_START_SEGMENT_INDEX = 10;
const LEG_SEGMENT_GAP = 4;
const THIGH_LENGTH = 22;
const CALF_LENGTH = 20;
const FOOT_LENGTH = 8;
const LEG_WALK_PHASE_SPEED = 0.15; // Speed of the basic leg stepping rhythm

// Body features
const NECK_TAPER_SEGMENTS = 10;
const TAIL_TAPER_SEGMENTS = 18;

const HEAD_POINTS: Point[] = [
  { x: 18, y: 0 }, { x: 10, y: -7 }, { x: 2, y: -9 }, { x: -8, y: -7 },
  { x: -15, y: -2 }, { x: -15, y: 2 }, { x: -8, y: 7 }, { x: 2, y: 9 },
  { x: 10, y: 7 }, { x: 18, y: 0 },
];
const EYE_SOCKET_OFFSET: Point = { x: 5, y: -3 };
const EYE_SOCKET_RADIUS = 2.5;

const RIB_MAX_LENGTH = 18;
const RIB_START_SEGMENT_INDEX = 6;
const RIB_END_SEGMENT_INDEX = SEGMENT_COUNT - TAIL_TAPER_SEGMENTS - 1;

const TAIL_BONE_START_INDEX = SEGMENT_COUNT - TAIL_TAPER_SEGMENTS;
const TAIL_BONE_MAX_LENGTH = 10;

// Undulation properties
const UNDULATION_AMPLITUDE = 6; // Max sideways displacement in pixels
const UNDULATION_FREQUENCY = 0.4; // How many waves fit along the body (approx)
const UNDULATION_WAVE_SPEED = 0.08; // How fast the wave travels down the body

const ReptileCursor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameIdRef = useRef<number | undefined>(undefined);
  
  const mousePositionRef = useRef<Point>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const prevMousePositionRef = useRef<Point>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  const segments = useRef<Segment[]>([]).current; 
  const headSpeed = useRef<number>(0); // Now measures actual distance head moved
  const walkPhase = useRef<number>(0); // For basic leg stepping rhythm
  const undulationTimeRef = useRef<number>(0); // Drives the undulation wave

  // Holds the segments array for rendering, updated once per frame after all calculations
  const [drawableSegmentsForRender, setDrawableSegmentsForRender] = useState<Segment[]>([]);

  const createReptile = useCallback(() => {
    segments.length = 0; 
    const startX = mousePositionRef.current.x;
    const startY = mousePositionRef.current.y;

    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const progress = i / (SEGMENT_COUNT - 1);
      const neckTaperFactor = Math.min(1, (i + 1) / NECK_TAPER_SEGMENTS);
      const tailBaseIndex = SEGMENT_COUNT - TAIL_TAPER_SEGMENTS - 1;
      const tailProgress = Math.max(0, (i - tailBaseIndex)) / TAIL_TAPER_SEGMENTS;
      const tailTaperFactor = Math.max(0.1, Math.pow(1 - tailProgress, 1.5));
      let width = (3 * Math.sin(Math.PI * progress)) * neckTaperFactor * tailTaperFactor + 1.5;
      width = Math.max(1, width);

      segments.push({
        x: startX - i * BASE_SEGMENT_LENGTH, // Initialize in a straight line
        y: startY,
        angle: 0,
        length: BASE_SEGMENT_LENGTH,
        width: width,
      });
    }
    setDrawableSegmentsForRender([...segments]); // Initial render state
  }, [segments]);

  useEffect(() => { 
    const handleMouseMove = (event: MouseEvent) => {
      mousePositionRef.current = { x: event.clientX, y: event.clientY };
    };
    mousePositionRef.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    prevMousePositionRef.current = { ...mousePositionRef.current };
    createReptile();
    window.addEventListener('mousemove', handleMouseMove);
    
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
      mousePositionRef.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      prevMousePositionRef.current = { ...mousePositionRef.current };
      createReptile(); // Recreate reptile on resize
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [createReptile]);


  useEffect(() => {
    const updateReptileLogic = () => {
      if (segments.length === 0) return;

      undulationTimeRef.current += UNDULATION_WAVE_SPEED;

      const target = mousePositionRef.current;
      const headSegment = segments[0];

      // 1. Head: Unbreakable Leash
      const prevHeadX = headSegment.x;
      const prevHeadY = headSegment.y;

      headSegment.x = target.x;
      headSegment.y = target.y;
      
      const dxHeadMove = headSegment.x - prevHeadX;
      const dyHeadMove = headSegment.y - prevHeadY;
      headSpeed.current = Math.hypot(dxHeadMove, dyHeadMove);

      if (headSpeed.current > 0.1) { // Only update angle if moved significantly
        headSegment.angle = Math.atan2(dyHeadMove, dxHeadMove);
      }
      // If no movement, angle remains from previous frame.

      // Advance walk phase if reptile is moving
      if (headSpeed.current > 0.5) { 
        walkPhase.current += LEG_WALK_PHASE_SPEED * (headSpeed.current / 5); // Scale walk phase by speed
      }

      // 2. Spine: Cascade of Obedience & 3. Undulation
      for (let i = 1; i < SEGMENT_COUNT; i++) {
        const prev = segments[i - 1];
        const current = segments[i];
        
        // Calculate basic follow position
        const followDx = prev.x - current.x;
        const followDy = prev.y - current.y;
        const followDist = Math.hypot(followDx, followDy);
        const followAngle = Math.atan2(followDy, followDx);
        
        let targetX = prev.x - Math.cos(followAngle) * current.length;
        let targetY = prev.y - Math.sin(followAngle) * current.length;

        // Apply Undulation
        const waveProgress = (i / SEGMENT_COUNT) * Math.PI * 2 * UNDULATION_FREQUENCY - undulationTimeRef.current;
        const undulationOffset = UNDULATION_AMPLITUDE * Math.sin(waveProgress) * Math.sin(Math.PI * (i / (SEGMENT_COUNT -1 )) ); // Taper undulation at ends
        
        // Apply offset perpendicular to the previous segment's angle (or a smoothed angle if available)
        const perpAngle = prev.angle + Math.PI / 2;
        targetX += undulationOffset * Math.cos(perpAngle);
        targetY += undulationOffset * Math.sin(perpAngle);
        
        current.x = targetX;
        current.y = targetY;
        
        // Update current segment's angle to point towards the previous one (after undulation)
        const actualDx = prev.x - current.x;
        const actualDy = prev.y - current.y;
        current.angle = Math.atan2(actualDy, actualDx);
      }
      
      setDrawableSegmentsForRender([...segments]); 
      animationFrameIdRef.current = requestAnimationFrame(updateReptileLogic);
    };

    animationFrameIdRef.current = requestAnimationFrame(updateReptileLogic);
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [segments]); // segments ref itself doesn't change, but its contents do.

  // --- Drawing Helper Functions ---
  const drawHead = (ctx: CanvasRenderingContext2D, segment: Segment) => {
    ctx.save();
    ctx.translate(segment.x, segment.y);
    ctx.rotate(segment.angle);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#FFFFFF';
    
    ctx.beginPath();
    HEAD_POINTS.forEach((p, index) => {
        if (index === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(EYE_SOCKET_OFFSET.x, EYE_SOCKET_OFFSET.y, EYE_SOCKET_RADIUS, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  };

  const drawSideBone = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, length: number, tipAngleOffset: number = 0, tipLengthScale: number = 1) => {
    const endX = x + Math.cos(angle) * length;
    const endY = y + Math.sin(angle) * length;
    ctx.beginPath();
    ctx.moveTo(x, y);
    if (tipAngleOffset === 0 && tipLengthScale === 1) {
        ctx.lineTo(endX, endY);
    } else {
        const tipX = endX + Math.cos(angle + tipAngleOffset) * (length * 0.2 * tipLengthScale);
        const tipY = endY + Math.sin(angle + tipAngleOffset) * (length * 0.2 * tipLengthScale);
        ctx.quadraticCurveTo(endX, endY, tipX, tipY);
    }
    ctx.stroke();
  };
  
  const drawDynamicRibs = (ctx: CanvasRenderingContext2D, segment: Segment, prevSegment: Segment | null, index: number) => {
    if (!prevSegment || index < RIB_START_SEGMENT_INDEX || index > RIB_END_SEGMENT_INDEX) return;

    let angleDiff = segment.angle - prevSegment.angle;
    angleDiff = (angleDiff + Math.PI) % (2 * Math.PI) - Math.PI;

    const progressFromStart = (index - RIB_START_SEGMENT_INDEX) / (RIB_END_SEGMENT_INDEX - RIB_START_SEGMENT_INDEX);
    let ribLength;
    if (progressFromStart < 0.5) {
        ribLength = (RIB_MAX_LENGTH * 0.4) + (RIB_MAX_LENGTH * 0.6 * (progressFromStart * 2));
    } else {
        ribLength = (RIB_MAX_LENGTH * 0.4) + (RIB_MAX_LENGTH * 0.6 * (1 - (progressFromStart - 0.5) * 2));
    }
    ribLength = Math.max(RIB_MAX_LENGTH * 0.1, ribLength);
    
    const baseAngle = segment.angle + Math.PI / 2; 
    const angleOffset = 1.4; 
    const flex = angleDiff * 6; 

    ctx.lineWidth = 1;
    drawSideBone(ctx, segment.x, segment.y, baseAngle - angleOffset + flex, ribLength);
    drawSideBone(ctx, segment.x, segment.y, baseAngle + Math.PI + angleOffset + flex, ribLength);
  };

  const drawLeg = (ctx: CanvasRenderingContext2D, segment: Segment, segmentIndex: number, side: 1 | -1, currentWalkPhase: number, currentHeadSpeed: number) => {
    // Determine undulation influence for this segment
    const waveProgress = (segmentIndex / SEGMENT_COUNT) * Math.PI * 2 * UNDULATION_FREQUENCY - undulationTimeRef.current;
    // Taper undulation influence for legs near ends, or use full for mid-body
    const undulationInfluenceFactor = Math.sin(Math.PI * (segmentIndex / (SEGMENT_COUNT -1 )) ); 
    const localUndulationOffset = UNDULATION_AMPLITUDE * Math.sin(waveProgress) * undulationInfluenceFactor;

    const legPhaseOffset = (segmentIndex - LEG_START_SEGMENT_INDEX) / LEG_SEGMENT_GAP * (Math.PI / LEG_PAIRS) * 1.8;
    const legBasePhase = currentWalkPhase + legPhaseOffset;
    
    // Modulate leg swing by local undulation (segment's current sideways offset)
    // If undulation pushes segment to 'side', that leg reaches forward.
    let legSwing = (localUndulationOffset / UNDULATION_AMPLITUDE) * 1.1 * side; 
    // Add some base rhythmic swing from walkPhase as well
    legSwing += Math.sin(legBasePhase) * 0.4;
    legSwing = Math.max(-1.1, Math.min(1.1, legSwing)); // Clamp swing

    let kneeBend = (Math.cos(legBasePhase * 2) + 1) * 0.5 * 0.55 + 0.15; 
    
    const movementFactor = Math.min(1, currentHeadSpeed / 5 ); // Normalize speed influence
    
    const finalSwing = legSwing * movementFactor;
    const finalKneeBend = kneeBend * movementFactor + (0.35 * (1-movementFactor)); // More bent when still

    const thighAngle = segment.angle + (Math.PI / 2.9 + finalSwing) * side;
    const kneeX = segment.x + Math.cos(thighAngle) * THIGH_LENGTH;
    const kneeY = segment.y + Math.sin(thighAngle) * THIGH_LENGTH;
    
    const calfAngle = thighAngle + (-Math.PI / 2.6 + finalKneeBend) * side;
    const footX = kneeX + Math.cos(calfAngle) * CALF_LENGTH;
    const footY = kneeY + Math.sin(calfAngle) * CALF_LENGTH;

    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(segment.x, segment.y);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(footX, footY);
    ctx.stroke();

    ctx.lineWidth = 1;
    for (let t = -1; t <= 1; t+=1) { 
        const toeAngle = calfAngle + t * 0.5 * side;
        drawSideBone(ctx, footX, footY, toeAngle, FOOT_LENGTH);
    }
  };

  const drawTailBones = (ctx: CanvasRenderingContext2D, segment: Segment, index: number) => {
    if (index < TAIL_BONE_START_INDEX) return;

    const progressInTail = (index - TAIL_BONE_START_INDEX) / (SEGMENT_COUNT - 1 - TAIL_BONE_START_INDEX);
    const boneLength = Math.max(2, (1 - progressInTail) * TAIL_BONE_MAX_LENGTH);
    const baseAngle = segment.angle + Math.PI / 2;
    ctx.lineWidth = Math.max(0.8, segment.width * 0.5);
    const tipCurveAngle = Math.PI * 0.25;
    
    drawSideBone(ctx, segment.x, segment.y, baseAngle - 0.2, boneLength, -tipCurveAngle, 1);
    drawSideBone(ctx, segment.x, segment.y, baseAngle + Math.PI + 0.2, boneLength, tipCurveAngle, 1);
  };


  useEffect(() => { 
    const canvas = canvasRef.current;
    if (!canvas || drawableSegmentsForRender.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw spine
    for (let i = 0; i < drawableSegmentsForRender.length -1; i++) {
        const seg1 = drawableSegmentsForRender[i];
        const seg2 = drawableSegmentsForRender[i+1];
        ctx.beginPath();
        ctx.moveTo(seg1.x, seg1.y);
        ctx.lineTo(seg2.x, seg2.y);
        ctx.lineWidth = Math.max(1, seg1.width); 
        ctx.stroke();
    }
    
    // Draw details (head, ribs, legs, tail)
    let legPairCounter = 0;
    for (let i = 0; i < drawableSegmentsForRender.length; i++) {
        const seg = drawableSegmentsForRender[i];
        const prevSeg = i > 0 ? drawableSegmentsForRender[i-1] : null;
        
        if (i === 0) {
            drawHead(ctx, seg);
        } else if (i >= TAIL_BONE_START_INDEX) {
            drawTailBones(ctx, seg, i);
        } else {
             drawDynamicRibs(ctx, seg, prevSeg, i);
            if (i >= LEG_START_SEGMENT_INDEX && (i - LEG_START_SEGMENT_INDEX) % LEG_SEGMENT_GAP === 0 && legPairCounter < LEG_PAIRS) {
                // Pass segment index to drawLeg for undulation calculation
                drawLeg(ctx, seg, i, 1, walkPhase.current, headSpeed.current);
                drawLeg(ctx, seg, i, -1, walkPhase.current, headSpeed.current);
                legPairCounter++;
            }
        }
    }

  }, [drawableSegmentsForRender]); // Depends on the segments data for redrawing

  return (
    <canvas ref={canvasRef} width={window.innerWidth} height={window.innerHeight} className="w-full h-full block" aria-label="Animated reptile cursor" role="img"/>
  );
};

export default ReptileCursor;

    