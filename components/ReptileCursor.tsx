
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Point, Segment } from '../types';

// --- Configuration & Constants ---
const SEGMENT_COUNT = 45;
const BASE_SEGMENT_LENGTH = 9;

// Leg properties
const LEG_PAIRS = 7; 
const LEG_START_SEGMENT_INDEX = 8; 
const LEG_SEGMENT_GAP = 3;         
const THIGH_LENGTH = 18;
const CALF_LENGTH = 16;
const FOOT_LENGTH = 7;

const LEG_CYCLE_SPEED_SCALAR = 0.08;
const POWER_STROKE_RATIO = 0.65; 
const METACHRONAL_WAVE_FACTOR = 6.0; 

const LEG_RECOVERY_LIFT_HEIGHT = 15;
const LEG_RECOVERY_SWING_FORWARD_FACTOR = 1.2; 
const LEG_PLANT_FORWARD_OFFSET = 10; 
const LEG_PLANT_SIDE_OFFSET = 15;   

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
const UNDULATION_AMPLITUDE = 3.5; 
const UNDULATION_FREQUENCY = 0.5; 
const UNDULATION_WAVE_SPEED = 0.09; 
const UNDULATION_SETTLE_SPEED = 0.15;

interface LegState {
  id: number;
  pairIndex: number;
  side: -1 | 1;
  cyclePhase: number; // 0 to 1
  isPowerStroke: boolean;
  footPlantedWorldPos: Point | null;
  recoverySwingProgress: number; // 0 to 1, progress through recovery stroke
  segmentAttachIndex: number;
}

const ReptileCursor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameIdRef = useRef<number | undefined>(undefined);
  
  const mousePositionRef = useRef<Point>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  const segmentsRef = useRef<Segment[]>([]); 
  const headSpeed = useRef<number>(0); 
  
  const undulationTimeRef = useRef<number>(0);
  const currentUndulationMagnitudeFactorRef = useRef<number>(0); 
  
  const legStatesRef = useRef<LegState[]>([]);
  const globalLegCycleTimeRef = useRef<number>(0);

  const [isInitialized, setIsInitialized] = useState(false);


  const initializeSimulation = useCallback(() => {
    segmentsRef.current = []; 
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

      segmentsRef.current.push({
        x: startX - i * BASE_SEGMENT_LENGTH, 
        y: startY,
        angle: 0,
        length: BASE_SEGMENT_LENGTH,
        width: width,
      });
    }

    legStatesRef.current = [];
    let legIdCounter = 0;
    for (let i = 0; i < LEG_PAIRS; i++) {
      const segmentAttachIndex = LEG_START_SEGMENT_INDEX + i * LEG_SEGMENT_GAP;
      if (segmentAttachIndex >= SEGMENT_COUNT) break;
      
      legStatesRef.current.push({
        id: legIdCounter++,
        pairIndex: i,
        side: 1,
        cyclePhase: 0,
        isPowerStroke: false,
        footPlantedWorldPos: null,
        recoverySwingProgress: 0,
        segmentAttachIndex: segmentAttachIndex,
      });
      legStatesRef.current.push({
        id: legIdCounter++,
        pairIndex: i,
        side: -1,
        cyclePhase: 0, 
        isPowerStroke: false,
        footPlantedWorldPos: null,
        recoverySwingProgress: 0,
        segmentAttachIndex: segmentAttachIndex,
      });
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => { 
    const handleMouseMove = (event: MouseEvent) => {
      mousePositionRef.current = { x: event.clientX, y: event.clientY };
    };
    mousePositionRef.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    initializeSimulation(); // Initialize once on mount
    
    window.addEventListener('mousemove', handleMouseMove);
    
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
      mousePositionRef.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      initializeSimulation(); // Re-initialize on resize
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [initializeSimulation]);


  // Define drawing helpers within the component scope or import if they are pure
  // These are used by the main animation loop
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
    const flex = angleDiff * 6 * currentUndulationMagnitudeFactorRef.current;

    ctx.lineWidth = 1;
    drawSideBone(ctx, segment.x, segment.y, baseAngle - angleOffset + flex, ribLength);
    drawSideBone(ctx, segment.x, segment.y, baseAngle + Math.PI + angleOffset + flex, ribLength);
  };

  const drawLeg = (ctx: CanvasRenderingContext2D, parentSegment: Segment, leg: LegState) => {
    ctx.lineWidth = 1.8;
    const attachX = parentSegment.x;
    const attachY = parentSegment.y;
    let kneeX, kneeY, footX, footY;

    if (leg.isPowerStroke && leg.footPlantedWorldPos) {
        footX = leg.footPlantedWorldPos.x;
        footY = leg.footPlantedWorldPos.y;

        const dx = footX - attachX;
        const dy = footY - attachY;
        const distToFoot = Math.hypot(dx, dy);
        const angleToFoot = Math.atan2(dy, dx);

        const L1 = THIGH_LENGTH;
        const L2 = CALF_LENGTH;
        if (distToFoot >= L1 + L2 - 0.1) { 
            const ratio = L1 / (L1 + L2);
            kneeX = attachX + dx * ratio;
            kneeY = attachY + dy * ratio;
        } else if (distToFoot <= Math.abs(L1 - L2) + 0.1) { 
             const ratio = L1 / (L1 - L2 || L1); 
             kneeX = attachX + dx * ratio;
             kneeY = attachY + dy * ratio;
        }else {
            const angleOffsetVal = Math.acos(Math.min(1, Math.max(-1, (L1*L1 + distToFoot*distToFoot - L2*L2) / (2 * L1 * distToFoot))));
            const kneeAngle = angleToFoot + angleOffsetVal * leg.side; 
            kneeX = attachX + L1 * Math.cos(kneeAngle);
            kneeY = attachY + L1 * Math.sin(kneeAngle);
        }

    } else {
        const swingPhase = leg.recoverySwingProgress; 
        
        const lift = Math.sin(swingPhase * Math.PI) * LEG_RECOVERY_LIFT_HEIGHT; 
        const forwardReach = swingPhase * LEG_RECOVERY_SWING_FORWARD_FACTOR * (THIGH_LENGTH + CALF_LENGTH) * 0.6;
        
        const baseSwingAngle = parentSegment.angle + (leg.side * Math.PI / 4); 

        const footRelX = Math.cos(baseSwingAngle) * forwardReach;
        const footRelY = Math.sin(baseSwingAngle) * forwardReach - lift; 

        footX = attachX + footRelX;
        footY = attachY + footRelY;

        const angleToAirFoot = Math.atan2(footY - attachY, footX - attachX);
        const baseKneeAngle = angleToAirFoot + (Math.PI / 3 * leg.side * (1-swingPhase*0.5)); 
        
        kneeX = attachX + THIGH_LENGTH * Math.cos(baseKneeAngle);
        kneeY = attachY + THIGH_LENGTH * Math.sin(baseKneeAngle);
        
         const distKneeToFoot = Math.hypot(footX - kneeX, footY - kneeY);
         if (distKneeToFoot > CALF_LENGTH) {
            const scale = CALF_LENGTH / distKneeToFoot;
            footX = kneeX + (footX - kneeX) * scale;
            footY = kneeY + (footY - kneeY) * scale;
         }
    }

    ctx.beginPath();
    ctx.moveTo(attachX, attachY);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(footX, footY);
    ctx.stroke();

    ctx.lineWidth = 1;
    const calfAngle = Math.atan2(footY - kneeY, footX - kneeX);
    for (let t = -1; t <= 1; t+=1) { 
        const toeAngle = calfAngle + t * 0.5 * leg.side;
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
    
    const splayFactor = 0.2 + 0.8 * currentUndulationMagnitudeFactorRef.current;

    drawSideBone(ctx, segment.x, segment.y, baseAngle - (tipCurveAngle * 0.3 * splayFactor), boneLength, -tipCurveAngle * splayFactor, 1);
    drawSideBone(ctx, segment.x, segment.y, baseAngle + Math.PI + (tipCurveAngle * 0.3 * splayFactor), boneLength, tipCurveAngle * splayFactor, 1);
  };


  useEffect(() => {
    if (!isInitialized) return;

    const mainLoop = () => {
      // --- LOGIC UPDATES ---
      const segments = segmentsRef.current;
      if (segments.length === 0) { // Should not happen if isInitialized is true
        animationFrameIdRef.current = requestAnimationFrame(mainLoop);
        return;
      }

      const target = mousePositionRef.current;
      const headSegment = segments[0];
      const prevHeadX = headSegment.x;
      const prevHeadY = headSegment.y;

      headSegment.x = target.x;
      headSegment.y = target.y;
      
      const dxHeadMove = headSegment.x - prevHeadX;
      const dyHeadMove = headSegment.y - prevHeadY;
      headSpeed.current = Math.hypot(dxHeadMove, dyHeadMove);

      if (headSpeed.current > 0.1) { 
        headSegment.angle = Math.atan2(dyHeadMove, dxHeadMove);
      }

      const targetUndulationMagnitude = headSpeed.current > 0.5 ? 1.0 : 0.0;
      currentUndulationMagnitudeFactorRef.current += 
        (targetUndulationMagnitude - currentUndulationMagnitudeFactorRef.current) * UNDULATION_SETTLE_SPEED;
      
      if (Math.abs(currentUndulationMagnitudeFactorRef.current) < 0.01) {
        currentUndulationMagnitudeFactorRef.current = 0;
      } else if (Math.abs(currentUndulationMagnitudeFactorRef.current - 1.0) < 0.01) {
        currentUndulationMagnitudeFactorRef.current = 1.0;
      }

      if (currentUndulationMagnitudeFactorRef.current > 0.05) {
        undulationTimeRef.current += UNDULATION_WAVE_SPEED;
        globalLegCycleTimeRef.current += (headSpeed.current / 15 + 0.01) * LEG_CYCLE_SPEED_SCALAR * currentUndulationMagnitudeFactorRef.current;
      }
      
      for (let i = 1; i < SEGMENT_COUNT; i++) {
        const prev = segments[i - 1];
        const current = segments[i];
        
        const followDx = prev.x - current.x;
        const followDy = prev.y - current.y;
        const followAngle = Math.atan2(followDy, followDx);
        
        let targetX = prev.x - Math.cos(followAngle) * current.length;
        let targetY = prev.y - Math.sin(followAngle) * current.length;

        const waveProgress = (i / SEGMENT_COUNT) * Math.PI * 2 * UNDULATION_FREQUENCY - undulationTimeRef.current;
        const undulationTaper = Math.sin(Math.PI * (i / (SEGMENT_COUNT -1 )) ); 
        const undulationOffset = UNDULATION_AMPLITUDE * Math.sin(waveProgress) * undulationTaper * currentUndulationMagnitudeFactorRef.current; 
        
        const perpAngle = prev.angle + Math.PI / 2;
        targetX += undulationOffset * Math.cos(perpAngle);
        targetY += undulationOffset * Math.sin(perpAngle);
        
        current.x = targetX;
        current.y = targetY;
        
        const actualDx = prev.x - current.x;
        const actualDy = prev.y - current.y;
        current.angle = Math.atan2(actualDy, actualDx);
      }

      for (const leg of legStatesRef.current) {
        const parentSegment = segments[leg.segmentAttachIndex];
        if (!parentSegment) continue;

        const phaseOffset = (leg.segmentAttachIndex / SEGMENT_COUNT) * METACHRONAL_WAVE_FACTOR;
        leg.cyclePhase = (globalLegCycleTimeRef.current + phaseOffset) % 1.0;

        const wasPowerStroke = leg.isPowerStroke;
        leg.isPowerStroke = leg.cyclePhase < POWER_STROKE_RATIO;

        if (leg.isPowerStroke) {
          leg.recoverySwingProgress = 0; 
          if (!wasPowerStroke) { 
            const plantAngle = parentSegment.angle + (Math.PI / 2 * leg.side * 0.6); 
            const plantDistForward = LEG_PLANT_FORWARD_OFFSET * (0.5 + headSpeed.current * 0.05); 
            
            leg.footPlantedWorldPos = {
              x: parentSegment.x + Math.cos(parentSegment.angle) * plantDistForward + Math.cos(plantAngle) * LEG_PLANT_SIDE_OFFSET,
              y: parentSegment.y + Math.sin(parentSegment.angle) * plantDistForward + Math.sin(plantAngle) * LEG_PLANT_SIDE_OFFSET,
            };
          }
        } else { 
          leg.footPlantedWorldPos = null;
          leg.recoverySwingProgress = (leg.cyclePhase - POWER_STROKE_RATIO) / (1.0 - POWER_STROKE_RATIO);
        }
      }
      
      // --- DRAWING ---
      const canvas = canvasRef.current;
      // Segments and legs refs are already updated by this point
      
      if (!canvas) { // No canvas available, try next frame
          animationFrameIdRef.current = requestAnimationFrame(mainLoop);
          return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) { // No context, try next frame
          animationFrameIdRef.current = requestAnimationFrame(mainLoop);
          return;
      }
    
      if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
      }

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 0; i < segments.length -1; i++) {
          const seg1 = segments[i];
          const seg2 = segments[i+1];
          ctx.beginPath();
          ctx.moveTo(seg1.x, seg1.y);
          ctx.lineTo(seg2.x, seg2.y);
          ctx.lineWidth = Math.max(1, seg1.width); 
          ctx.stroke();
      }
    
      for (let i = 0; i < segments.length; i++) {
          const seg = segments[i];
          const prevSeg = i > 0 ? segments[i-1] : null;
        
          if (i === 0) {
              drawHead(ctx, seg);
          } else if (i >= TAIL_BONE_START_INDEX) {
              drawTailBones(ctx, seg, i);
          } else {
               drawDynamicRibs(ctx, seg, prevSeg, i);
          }
      }
      for (const leg of legStatesRef.current) {
          const parentSegment = segments[leg.segmentAttachIndex];
          if (parentSegment) {
              drawLeg(ctx, parentSegment, leg);
          }
      }
      
      animationFrameIdRef.current = requestAnimationFrame(mainLoop);
    };

    animationFrameIdRef.current = requestAnimationFrame(mainLoop);
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [isInitialized]); // Removed drawing helpers from deps as they are stable in this scope or use refs

  return (
    <canvas ref={canvasRef} width={window.innerWidth} height={window.innerHeight} className="w-full h-full block" aria-label="Animated centipede cursor" role="img"/>
  );
};

export default ReptileCursor;
