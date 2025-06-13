import React, { useRef, useEffect, useState } from 'react';
import { Point, Segment, Leg, LegTip } from '../types';

const NUM_SEGMENTS = 25;
const SEGMENT_LENGTH = 10;
const HEAD_SIZE = 5;
const RIB_LENGTH = 4;

const SPRING_CONSTANT = 0.25;
const DAMPING_FACTOR = 0.65;

const LEG_SPRING_CONSTANT = 0.3;
const LEG_DAMPING_FACTOR = 0.6;

const NUM_LEG_PAIRS = 7;
const LEG_ATTACH_INTERVAL = 3; // Attach legs to every Nth segment starting from segment 1
const LEG_BASE_LENGTH = 20; // Length of the main leg segment
const LEG_FOOT_LENGTH = 5; // Small extension for the "foot"

const ReptileCursor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number | undefined>(undefined);
  
  const mousePositionRef = useRef<Point>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

  const segmentsRef = useRef<Segment[]>([]);
  const legsRef = useRef<Leg[]>([]);

  // State for triggering re-draws
  const [drawableSegments, setDrawableSegments] = useState<Segment[]>([]);
  const [drawableLegs, setDrawableLegs] = useState<Leg[]>([]);

  useEffect(() => { // Manages mouse position listener
    const handleMouseMove = (event: MouseEvent) => {
      mousePositionRef.current = { x: event.clientX, y: event.clientY };
    };
    // Initialize mouse position, important if mouse doesn't move on load
    mousePositionRef.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => { // Initialize segments and legs
    const initialSegments: Segment[] = [];
    const startX = window.innerWidth / 2;
    const startY = window.innerHeight / 2;
    for (let i = 0; i < NUM_SEGMENTS; i++) {
      initialSegments.push({
        x: startX - i * SEGMENT_LENGTH,
        y: startY,
        vx: 0,
        vy: 0,
      });
    }
    segmentsRef.current = initialSegments;
    setDrawableSegments([...initialSegments]);

    const initialLegs: Leg[] = [];
    for (let i = 0; i < NUM_LEG_PAIRS; i++) {
      const attachSegmentIndex = 1 + i * LEG_ATTACH_INTERVAL; // Start from 2nd segment (index 1)
      if (attachSegmentIndex < NUM_SEGMENTS) {
        const attachPoint = initialSegments[attachSegmentIndex];
        // Left Leg
        initialLegs.push({
          attachSegmentIndex,
          side: 'left',
          length: LEG_BASE_LENGTH,
          angleFromSegment: Math.PI / 3, // Approx 60 degrees outward
          tip: { x: attachPoint.x, y: attachPoint.y - LEG_BASE_LENGTH, vx: 0, vy: 0 },
          phase: Math.random() * Math.PI * 2,
        });
        // Right Leg
        initialLegs.push({
          attachSegmentIndex,
          side: 'right',
          length: LEG_BASE_LENGTH,
          angleFromSegment: Math.PI / 3, // Same angle, side modifier will flip it
          tip: { x: attachPoint.x, y: attachPoint.y + LEG_BASE_LENGTH, vx: 0, vy: 0 },
          phase: Math.random() * Math.PI * 2 + Math.PI, // Offset phase
        });
      }
    }
    legsRef.current = initialLegs;
    setDrawableLegs([...initialLegs]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { // Physics and animation loop
    const physicsLoop = () => {
      const currentSegments = segmentsRef.current;
      const currentLegs = legsRef.current;
      const mousePos = mousePositionRef.current;

      if (currentSegments.length === 0) {
        animationFrameId.current = requestAnimationFrame(physicsLoop);
        return;
      }

      const newCalculatedSegments: Segment[] = currentSegments.map(s => ({ ...s }));
      
      // 1. Update Head
      const head = newCalculatedSegments[0];
      let targetX = mousePos.x;
      let targetY = mousePos.y;
      let ax = (targetX - head.x) * SPRING_CONSTANT;
      let ay = (targetY - head.y) * SPRING_CONSTANT;
      head.vx = (head.vx + ax) * DAMPING_FACTOR;
      head.vy = (head.vy + ay) * DAMPING_FACTOR;
      head.x += head.vx;
      head.y += head.vy;

      // 2. Update Body Segments
      for (let i = 1; i < NUM_SEGMENTS; i++) {
        const seg = newCalculatedSegments[i];
        const prevSeg = newCalculatedSegments[i-1];
        const dxChain = prevSeg.x - seg.x;
        const dyChain = prevSeg.y - seg.y;
        const angleChain = Math.atan2(dyChain, dxChain);
        
        targetX = prevSeg.x - Math.cos(angleChain) * SEGMENT_LENGTH;
        targetY = prevSeg.y - Math.sin(angleChain) * SEGMENT_LENGTH;
        
        ax = (targetX - seg.x) * SPRING_CONSTANT;
        ay = (targetY - seg.y) * SPRING_CONSTANT;
        seg.vx = (seg.vx + ax) * DAMPING_FACTOR;
        seg.vy = (seg.vy + ay) * DAMPING_FACTOR;
        seg.x += seg.vx;
        seg.y += seg.vy;
      }
      
      // 3. Update Legs
      const newCalculatedLegs: Leg[] = currentLegs.map(leg => {
        const newLeg: Leg = { ...leg, tip: { ...leg.tip } };
        const bodySegment = newCalculatedSegments[leg.attachSegmentIndex];
        if (!bodySegment) return newLeg;

        let segmentAngle = 0; // Angle of the body segment itself
        if (leg.attachSegmentIndex > 0 && leg.attachSegmentIndex < newCalculatedSegments.length) {
            const prevBodySegmentForLeg = newCalculatedSegments[leg.attachSegmentIndex - 1];
            segmentAngle = Math.atan2(bodySegment.y - prevBodySegmentForLeg.y, bodySegment.x - prevBodySegmentForLeg.x);
        } else if (newCalculatedSegments.length > 0) { // For head segment if legs attached there
            segmentAngle = Math.atan2(bodySegment.vy, bodySegment.vx) || 0;
        }
        
        newLeg.phase = (newLeg.phase + 0.12 + Math.random() * 0.03) % (Math.PI * 2) ; // Leg animation speed & randomness
        
        // Angle of the leg relative to the world, based on segment angle and leg's resting angle
        const legWorldAngle = segmentAngle + leg.angleFromSegment * (leg.side === 'left' ? -1 : 1); // Adjust multiplier for desired outward direction
        
        // Dynamic length for "stepping" motion
        const dynamicLength = leg.length + Math.sin(newLeg.phase) * (leg.length * 0.4);

        const targetTipX = bodySegment.x + Math.cos(legWorldAngle) * dynamicLength;
        const targetTipY = bodySegment.y + Math.sin(legWorldAngle) * dynamicLength;
        
        const tipAx = (targetTipX - newLeg.tip.x) * LEG_SPRING_CONSTANT;
        const tipAy = (targetTipY - newLeg.tip.y) * LEG_SPRING_CONSTANT;
        newLeg.tip.vx = (newLeg.tip.vx + tipAx) * LEG_DAMPING_FACTOR;
        newLeg.tip.vy = (newLeg.tip.vy + tipAy) * LEG_DAMPING_FACTOR;
        newLeg.tip.x += newLeg.tip.vx;
        newLeg.tip.y += newLeg.tip.vy;
        return newLeg;
      });

      segmentsRef.current = newCalculatedSegments;
      legsRef.current = newCalculatedLegs;

      setDrawableSegments([...newCalculatedSegments]);
      setDrawableLegs([...newCalculatedLegs]);
      
      animationFrameId.current = requestAnimationFrame(physicsLoop);
    };

    animationFrameId.current = requestAnimationFrame(physicsLoop);
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, []); // Empty dependency array: loop runs independently after mount

  useEffect(() => { // Drawing logic
    const canvas = canvasRef.current;
    if (!canvas || drawableSegments.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw spine
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(drawableSegments[0].x, drawableSegments[0].y);
    for (let i = 1; i < drawableSegments.length; i++) {
      ctx.lineTo(drawableSegments[i].x, drawableSegments[i].y);
    }
    ctx.stroke();

    // Draw head
    ctx.beginPath();
    ctx.arc(drawableSegments[0].x, drawableSegments[0].y, HEAD_SIZE, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    // Draw ribs
    ctx.lineWidth = 1.5;
    drawableSegments.forEach((seg, i) => {
      if (i === 0 || i % 2 !== 0) return; // Ribs on every other segment, not head
      const prevSeg = drawableSegments[i-1];
      const dx = seg.x - prevSeg.x;
      const dy = seg.y - prevSeg.y;
      const angle = Math.atan2(dy, dx); // Angle of the segment

      ctx.beginPath();
      // Rib pointing "up" relative to segment
      ctx.moveTo(seg.x, seg.y);
      ctx.lineTo(seg.x - Math.sin(angle) * RIB_LENGTH, seg.y + Math.cos(angle) * RIB_LENGTH);
      // Rib pointing "down" relative to segment
      ctx.moveTo(seg.x, seg.y);
      ctx.lineTo(seg.x + Math.sin(angle) * RIB_LENGTH, seg.y - Math.cos(angle) * RIB_LENGTH);
      ctx.stroke();
    });
    
    // Draw Legs
    ctx.lineWidth = 2;
    drawableLegs.forEach(leg => {
      const attachSeg = drawableSegments[leg.attachSegmentIndex];
      if (!attachSeg) return;

      // Main leg segment
      ctx.beginPath();
      ctx.moveTo(attachSeg.x, attachSeg.y);
      ctx.lineTo(leg.tip.x, leg.tip.y);
      ctx.stroke();

      // Simple "foot" perpendicular to the leg's end
      const legDx = leg.tip.x - attachSeg.x;
      const legDy = leg.tip.y - attachSeg.y;
      const legAngle = Math.atan2(legDy, legDx);
      
      ctx.beginPath();
      ctx.moveTo(leg.tip.x - Math.sin(legAngle) * LEG_FOOT_LENGTH, leg.tip.y + Math.cos(legAngle) * LEG_FOOT_LENGTH);
      ctx.lineTo(leg.tip.x + Math.sin(legAngle) * LEG_FOOT_LENGTH, leg.tip.y - Math.cos(legAngle) * LEG_FOOT_LENGTH);
      ctx.stroke();
    });

  }, [drawableSegments, drawableLegs]);

  return (
    <canvas ref={canvasRef} className="w-full h-full" />
  );
};

export default ReptileCursor;
