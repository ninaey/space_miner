import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGame } from '../../context/GameContext';

const formatNum = (n: number): string => {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return Math.floor(n).toString();
};

interface FloatingText { id: number; text: string; x: number; y: number; color: string; }

const RESOURCE_COLORS: Record<string, string> = {
  iron: '#C0C0C0', copper: '#B87333', silver: '#E8E8E8', diamonds: '#00F2FF',
};

const LAYERS = [
  { name: 'REGOLITH',    color: '#2D2010', accent: '#3D2F1A', depth: '0–200m',     resource: 'Iron',     resourceColor: '#C0C0C0' },
  { name: 'CLAY BED',    color: '#1E1A12', accent: '#2E2418', depth: '200–500m',   resource: 'Copper',   resourceColor: '#B87333' },
  { name: 'IRON SEAM',   color: '#181818', accent: '#1C2030', depth: '500–1000m',  resource: 'Silver',   resourceColor: '#E8E8E8' },
  { name: 'GRANITE CORE',color: '#111418', accent: '#151A20', depth: '1000–2000m', resource: 'Diamonds', resourceColor: '#00F2FF' },
];

const MILESTONE = 1000;

// ── Star field ────────────────────────────────────────────────
const Stars = () => {
  const stars = React.useMemo(() => Array.from({ length: 60 }, (_, i) => ({
    id: i, x: (i * 37.3) % 100, y: (i * 21.7) % 100,
    size: 0.5 + (i % 3) * 0.7, delay: (i * 0.19) % 4,
  })), []);
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {stars.map(s => (
        <div key={s.id} style={{
          position: 'absolute', left: `${s.x}%`, top: `${s.y}%`,
          width: s.size, height: s.size, borderRadius: '50%',
          background: 'white', opacity: 0.5,
          animation: `scm-star__dot--twinkle ${3 + s.delay}s ease-in-out infinite`,
          animationDelay: `${s.delay}s`,
        }} />
      ))}
    </div>
  );
};

// ── Mining Robot ──────────────────────────────────────────────
const MiningRobot = ({ drilling }: { drilling: boolean }) => (
  <div style={{ width: 56, height: 82, position: 'relative', animation: drilling ? 'scm-robot__body--drilling 0.15s ease-in-out 3' : 'none' }}>
    {/* Head */}
    <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 28, height: 18, borderRadius: 5, background: 'linear-gradient(135deg,#1A2A3A,#0D1B2A)', border: '1.5px solid #00F2FF', boxShadow: '0 0 8px #00F2FF50' }}>
      <div style={{ position: 'absolute', top: 5, left: 5, width: 7, height: 7, borderRadius: '50%', background: '#00F2FF', boxShadow: '0 0 6px #00F2FF', animation: 'scm__pulse--cyan 1.5s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', top: 5, right: 5, width: 7, height: 7, borderRadius: '50%', background: '#00F2FF', boxShadow: '0 0 6px #00F2FF', animation: 'scm__pulse--cyan 1.5s ease-in-out infinite 0.3s' }} />
    </div>
    {/* Body */}
    <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', width: 36, height: 26, borderRadius: 5, background: 'linear-gradient(135deg,#1E2D3E,#152030)', border: '1.5px solid #00F2FF80' }}>
      <div style={{ position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)', width: 18, height: 12, borderRadius: 2, background: '#FF8C0020', border: '1px solid #FF8C0060' }}>
        <div style={{ position: 'absolute', top: 3, left: '50%', transform: 'translateX(-50%)', width: 10, height: 4, borderRadius: 1, background: '#FF8C00', boxShadow: '0 0 4px #FF8C00', animation: 'scm__glow--orange 1s ease-in-out infinite' }} />
      </div>
    </div>
    {/* Arms */}
    <div style={{ position: 'absolute', top: 22, left: 1, width: 10, height: 6, borderRadius: 3, background: '#1A2A3A', border: '1px solid #00F2FF60' }} />
    <div style={{ position: 'absolute', top: 22, right: 1, width: 10, height: 6, borderRadius: 3, background: '#1A2A3A', border: '1px solid #00F2FF60' }} />
    {/* Legs */}
    <div style={{ position: 'absolute', top: 47, left: 10, width: 10, height: 14, borderRadius: 3, background: '#1A2A3A', border: '1px solid #00F2FF60' }} />
    <div style={{ position: 'absolute', top: 47, right: 10, width: 10, height: 14, borderRadius: 3, background: '#1A2A3A', border: '1px solid #00F2FF60' }} />
    {/* Drill */}
    <div style={{ position: 'absolute', top: 61, left: '50%', transform: 'translateX(-50%)', width: 8, height: 12, borderRadius: 2, background: '#FF8C00', boxShadow: '0 0 8px #FF8C00' }} />
    <div style={{ position: 'absolute', top: 72, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '10px solid #FF6B00', filter: 'drop-shadow(0 2px 4px #FF8C00)' }} />
    {drilling && (
      <div style={{ position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)', width: 24, height: 24, borderRadius: '50%', background: 'radial-gradient(circle,#FF8C0070 0%,transparent 70%)', animation: 'scm__glow--orange 0.1s ease-in-out' }} />
    )}
  </div>
);

// ══════════════════════════════════════════════════════════════
// IMPROVED DRONE SYSTEM
// ══════════════════════════════════════════════════════════════
//
// Each drone has a unique role, body shape, color, and motion path:
//
//  Scout Alpha (α)  — Fast cyan pathfinder. Sweeps diagonally across
//                     the mining area hunting for ore veins. Banks into
//                     turns (rotation follows velocity direction).
//
//  Excavator (EX)   — Orange helper drone. Orbits the main robot in a
//                     slow ellipse, its spinning drill assisting the
//                     manual mining operation.
//
//  Hauler (HL)      — Amber freight drone. Shuttles vertically between
//                     the active layer and the surface, pausing at each
//                     end to "load" and "unload" ore. Cargo pod glows
//                     brighter when descending (loaded state).
//
//  Scout Beta (β)   — Second scout, mirror-pathing Alpha on the
//                     opposite side of the area. Together they form a
//                     coordinated pincer sweep.
//
//  Patrol (PT)      — Silver sentinel. Performs a slow, systematic
//                     horizontal scan across all layers, flipping 180°
//                     at each wall for a continuous back-and-forth pass.
//
//  Deep Probe (DP)  — Purple sensor drone. Anchored deep in the
//                     Granite Core layer, it hovers with micro-movements
//                     while emitting a pulsing sensor field to reveal
//                     diamond deposits.
//
// All motion is driven by Motion (Framer Motion) animate keyframe
// arrays with custom `times` for easing control and `repeat: Infinity`.
// ══════════════════════════════════════════════════════════════

// Scout drone body (slim arrowhead)
const ScoutBody = ({ color, size }: { color: string; size: number }) => (
  <div style={{ position: 'relative', width: size * 1.6, height: size * 0.85, flexShrink: 0 }}>
    {/* Main hull – swept-back oval */}
    <div style={{ position: 'absolute', top: '15%', left: '20%', width: '55%', height: '65%', borderRadius: '6px 12px 6px 10px', background: `linear-gradient(135deg,${color}30,${color}18)`, border: `1px solid ${color}90`, boxShadow: `0 0 7px ${color}50` }} />
    {/* Left swept wing */}
    <div style={{ position: 'absolute', top: '38%', left: '0%', width: '28%', height: 3, background: `${color}70`, borderRadius: 2, transform: 'rotate(-12deg)', transformOrigin: 'right center' }} />
    {/* Right swept wing */}
    <div style={{ position: 'absolute', top: '38%', right: '0%', width: '28%', height: 3, background: `${color}70`, borderRadius: 2, transform: 'rotate(12deg)', transformOrigin: 'left center' }} />
    {/* Engine glow */}
    <div style={{ position: 'absolute', bottom: '8%', left: '50%', transform: 'translateX(-50%)', width: size * 0.35, height: size * 0.35, borderRadius: '50%', background: color, boxShadow: `0 0 9px ${color}, 0 0 18px ${color}60`, animation: 'scm__pulse--cyan 0.8s ease-in-out infinite' }} />
    {/* Cockpit dot */}
    <div style={{ position: 'absolute', top: '22%', left: '42%', width: 4, height: 4, borderRadius: '50%', background: '#FFFFFF80' }} />
  </div>
);

// Excavator drone body (round with spinning drill)
const ExcavatorBody = ({ color, size }: { color: string; size: number }) => (
  <div style={{ position: 'relative', width: size, height: size * 1.2, flexShrink: 0 }}>
    {/* Round hull */}
    <div style={{ position: 'absolute', top: '5%', left: '10%', width: '80%', height: '60%', borderRadius: '50%', background: `radial-gradient(circle at 40% 38%,${color}35,${color}15)`, border: `1.5px solid ${color}80`, boxShadow: `0 0 12px ${color}50` }} />
    {/* Left rotor arm */}
    <div style={{ position: 'absolute', top: '10%', left: '-15%', width: '45%', height: 3, background: `${color}50`, borderRadius: 2 }}>
      {/* Rotor blur */}
      <div style={{ position: 'absolute', left: 0, top: -3, width: '100%', height: 9, borderRadius: 4, background: `${color}25`, animation: 'scm-drone__rotor--spin 0.12s linear infinite' }} />
    </div>
    {/* Right rotor arm */}
    <div style={{ position: 'absolute', top: '10%', right: '-15%', width: '45%', height: 3, background: `${color}50`, borderRadius: 2 }}>
      <div style={{ position: 'absolute', right: 0, top: -3, width: '100%', height: 9, borderRadius: 4, background: `${color}25`, animation: 'scm-drone__rotor--spin 0.12s linear infinite reverse' }} />
    </div>
    {/* Drill bit */}
    <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 6, height: 12, background: color, borderRadius: '1px 1px 4px 4px', boxShadow: `0 0 6px ${color}`, animation: 'scm-drone__bit--spin-raw 0.3s linear infinite' }} />
    {/* Chest indicator */}
    <div style={{ position: 'absolute', top: '30%', left: '42%', width: 5, height: 5, borderRadius: '50%', background: '#FFFFFF60', animation: 'scm__pulse--orange 1s ease-in-out infinite' }} />
  </div>
);

// Hauler drone body (boxy freighter + cargo pod)
const HaulerBody = ({ color, loaded, size }: { color: string; loaded: boolean; size: number }) => (
  <div style={{ position: 'relative', width: size, height: size * 1.6, flexShrink: 0 }}>
    {/* Main box hull */}
    <div style={{ position: 'absolute', top: '5%', left: '10%', width: '80%', height: '45%', borderRadius: 5, background: `linear-gradient(135deg,${color}30,${color}15)`, border: `1.5px solid ${color}70`, boxShadow: `0 0 8px ${color}40` }}>
      {/* Cockpit strip */}
      <div style={{ position: 'absolute', top: 3, left: '20%', width: '60%', height: 3, borderRadius: 2, background: `${color}60` }} />
    </div>
    {/* Left thruster */}
    <div style={{ position: 'absolute', top: '12%', left: '-10%', width: '25%', height: 4, borderRadius: 2, background: `${color}50` }} />
    {/* Right thruster */}
    <div style={{ position: 'absolute', top: '12%', right: '-10%', width: '25%', height: 4, borderRadius: 2, background: `${color}50` }} />
    {/* Tether to cargo */}
    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translateX(-50%)', width: 1, height: '20%', background: `${color}50` }} />
    {/* Cargo pod */}
    <div style={{
      position: 'absolute', bottom: '2%', left: '20%', width: '60%', height: '35%',
      borderRadius: 4,
      background: loaded ? `${color}60` : `${color}20`,
      border: `1px solid ${color}80`,
      boxShadow: loaded ? `0 0 12px ${color}, 0 0 24px ${color}60` : `0 0 4px ${color}30`,
      animation: loaded ? 'scm-drone__cargo--glow 1.2s ease-in-out infinite' : 'none',
    }}>
      <div style={{ position: 'absolute', top: 3, left: '50%', transform: 'translateX(-50%)', width: '50%', height: 2, borderRadius: 1, background: loaded ? '#FFFFFF90' : '#FFFFFF30' }} />
    </div>
    {/* Engine glow bottom */}
    <div style={{ position: 'absolute', top: '48%', left: '20%', right: '20%', height: 3, borderRadius: 2, background: `${color}`, boxShadow: `0 0 8px ${color}`, animation: 'scm__pulse--orange 0.9s ease-in-out infinite' }} />
  </div>
);

// Patrol drone body (long flat sentinel)
const PatrolBody = ({ color, size }: { color: string; size: number }) => (
  <div style={{ position: 'relative', width: size * 2.2, height: size * 0.6, flexShrink: 0 }}>
    {/* Long flat body */}
    <div style={{ position: 'absolute', top: '20%', left: '10%', width: '80%', height: '55%', borderRadius: 3, background: `linear-gradient(90deg,${color}20,${color}35,${color}20)`, border: `1px solid ${color}60`, boxShadow: `0 0 6px ${color}30` }} />
    {/* Left sensor wing */}
    <div style={{ position: 'absolute', top: '30%', left: '0%', width: '15%', height: 2, background: `${color}60`, borderRadius: 1 }} />
    {/* Right sensor wing */}
    <div style={{ position: 'absolute', top: '30%', right: '0%', width: '15%', height: 2, background: `${color}60`, borderRadius: 1 }} />
    {/* Engine dots */}
    {[0.3, 0.5, 0.7].map(pos => (
      <div key={pos} style={{ position: 'absolute', bottom: '15%', left: `${pos * 100}%`, transform: 'translateX(-50%)', width: 3, height: 3, borderRadius: '50%', background: color, boxShadow: `0 0 5px ${color}`, animation: `scm__pulse--cyan ${1 + pos}s ease-in-out infinite` }} />
    ))}
  </div>
);

// Deep Probe body (sensor sphere with antenna)
const DeepProbeBody = ({ color, size }: { color: string; size: number }) => (
  <div style={{ position: 'relative', width: size, height: size * 1.3, flexShrink: 0 }}>
    {/* Sphere hull */}
    <div style={{ position: 'absolute', top: '20%', left: '10%', width: '80%', height: '62%', borderRadius: '50%', background: `radial-gradient(circle at 40% 38%,${color}45,${color}20)`, border: `1.5px solid ${color}`, boxShadow: `0 0 14px ${color}60`, animation: 'scm__pulse--purple 2s ease-in-out infinite' }} />
    {/* Antenna */}
    <div style={{ position: 'absolute', top: '0%', left: '47%', width: 2, height: '22%', background: `${color}80`, borderRadius: 1 }}>
      <div style={{ position: 'absolute', top: -4, left: -3, width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}`, animation: 'scm__pulse--purple 1.2s ease-in-out infinite' }} />
    </div>
    {/* Scanner ring */}
    <div style={{ position: 'absolute', top: '35%', left: '-10%', right: '-10%', height: 2, borderRadius: 1, background: `${color}40`, animation: 'scm__pulse--purple 1.8s ease-in-out infinite 0.5s' }} />
    {/* Bottom thruster */}
    <div style={{ position: 'absolute', bottom: 0, left: '40%', width: 8, height: 4, borderRadius: 2, background: `${color}60`, boxShadow: `0 0 6px ${color}` }} />
  </div>
);

// ── Drone fleet config ────────────────────────────────────────
interface DroneDef {
  id: string;
  label: string;
  type: 'scout' | 'excavator' | 'hauler' | 'patrol' | 'deepprobe';
  color: string;
  size: number;
  position: { left: string; top: string };
  animX: number[];
  animY: number[];
  animR: number[];
  times?: number[];
  duration: number;
  delay: number;
  minDrones: number;
}

const DRONE_DEFS: DroneDef[] = [
  // ── Scout Alpha ──────────────────────────────────────────
  {
    id: 'scout-a', label: 'α', type: 'scout', color: '#00F2FF', size: 22,
    position: { left: '10%', top: '16%' },
    animX: [-55, 35,  115,  25, -20, -55],
    animY: [  0, -20,   10, -14,   8,   0],
    animR: [ -8,   7,   16,  -5, -12,  -8],
    times: [0, 0.18, 0.44, 0.64, 0.84, 1],
    duration: 4.5, delay: 0, minDrones: 1,
  },
  // ── Excavator ────────────────────────────────────────────
  {
    id: 'excavator', label: 'EX', type: 'excavator', color: '#FF8C00', size: 26,
    position: { left: '46%', top: '30%' },
    animX: [ 44,  10, -44,  10,  44],
    animY: [  0, -32,   0,  32,   0],
    animR: [  0, -10,   0,  10,   0],
    duration: 5.8, delay: 0.4, minDrones: 1,
  },
  // ── Hauler ───────────────────────────────────────────────
  {
    id: 'hauler', label: 'HL', type: 'hauler', color: '#FFB347', size: 24,
    position: { left: '70%', top: '12%' },
    animX: [  0,   4,   4,  -3,   0,   0],
    animY: [  0, -10, -95, -95,   0,   5],
    animR: [  0,   2,   0,   0,  -2,   0],
    times: [0, 0.05, 0.3, 0.55, 0.82, 1],
    duration: 7.5, delay: 1.2, minDrones: 2,
  },
  // ── Scout Beta ───────────────────────────────────────────
  {
    id: 'scout-b', label: 'β', type: 'scout', color: '#00D8FF', size: 19,
    position: { left: '62%', top: '44%' },
    animX: [ 72, -12, -65,  18,  72],
    animY: [  0, -16,  14,  -9,   0],
    animR: [ 12,  -7, -16,   5,  12],
    duration: 5.3, delay: 1.9, minDrones: 3,
  },
  // ── Patrol ───────────────────────────────────────────────
  {
    id: 'patrol', label: 'PT', type: 'patrol', color: '#C8DEFF', size: 18,
    position: { left: '5%', top: '62%' },
    animX: [-60, 145, 145, -60, -60],
    animY: [  0,   0,   0,   0,   0],
    animR: [  0,   0, 180, 180,   0],
    times: [0, 0.46, 0.52, 0.98, 1],
    duration: 10.5, delay: 0.8, minDrones: 4,
  },
  // ── Deep Probe ───────────────────────────────────────────
  {
    id: 'deep-probe', label: 'DP', type: 'deepprobe', color: '#9B59B6', size: 22,
    position: { left: '38%', top: '80%' },
    animX: [  0,  10,  -6,  12,  -9,   0],
    animY: [  0,  -7,   5,  -4,   6,   0],
    animR: [  0,   5,  -3,   7,  -5,   0],
    times: [0, 0.2, 0.4, 0.6, 0.8, 1],
    duration: 3.8, delay: 0.3, minDrones: 5,
  },
];

// ── DroneFleet component ──────────────────────────────────────
const DroneFleet = ({ droneCount, droneSpeed }: { droneCount: number; droneSpeed: number }) => {
  // Hauler is "loaded" (going down) every other trip
  const haulerLoaded = true; // Simplified: always show cargo loaded state

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
      {DRONE_DEFS.filter(d => droneCount >= d.minDrones).map(drone => {
        const isLoaded = drone.id === 'hauler' && haulerLoaded;
        const speedFactor = droneSpeed || 1;

        const body = drone.type === 'scout' ? (
          <ScoutBody color={drone.color} size={drone.size} />
        ) : drone.type === 'excavator' ? (
          <ExcavatorBody color={drone.color} size={drone.size} />
        ) : drone.type === 'hauler' ? (
          <HaulerBody color={drone.color} loaded={isLoaded} size={drone.size} />
        ) : drone.type === 'patrol' ? (
          <PatrolBody color={drone.color} size={drone.size} />
        ) : (
          <DeepProbeBody color={drone.color} size={drone.size} />
        );

        return (
          <div
            key={drone.id}
            style={{ position: 'absolute', left: drone.position.left, top: drone.position.top }}
          >
            {/* Drone label */}
            <div style={{
              position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)',
              fontFamily: 'Orbitron, sans-serif', color: `${drone.color}90`, fontSize: 7,
              letterSpacing: '0.06em', whiteSpace: 'nowrap',
              textShadow: `0 0 6px ${drone.color}`,
            }}>
              {drone.label}
            </div>

            {/* Motion wrapper */}
            <motion.div
              animate={{
                x: drone.animX,
                y: drone.animY,
                rotate: drone.animR,
              }}
              transition={{
                duration: drone.duration / speedFactor,
                delay: drone.delay,
                repeat: Infinity,
                ease: 'easeInOut',
                times: drone.times,
              }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              {/* Motion trail glow */}
              <div style={{
                position: 'absolute',
                width: '120%', height: '120%',
                borderRadius: '50%',
                background: `radial-gradient(circle,${drone.color}18 0%,transparent 70%)`,
                filter: 'blur(3px)',
              }} />
              {body}
            </motion.div>
          </div>
        );
      })}
    </div>
  );
};

// ── Main Hub ──────────────────────────────────────────────────
export function MainHub() {
  const { state, dispatch, getResourceForDepth } = useGame();
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [drilling, setDrilling] = useState(false);
  const [showInventory, setShowInventory] = useState(false);
  const nextId = useRef(0);
  const miningAreaRef = useRef<HTMLDivElement>(null);

  const droneCount = state.upgrades.droneFactory + 2;
  const passivePerSec = Math.floor(state.passiveRate * (1 + state.upgrades.batteryEfficiency * 0.25) * droneCount);
  const currentLayer = state.depth < 200 ? 0 : state.depth < 500 ? 1 : state.depth < 1000 ? 2 : 3;
  const depthPercent = Math.min((state.depth / MILESTONE) * 100, 100);

  const handleMineClick = useCallback((e: React.MouseEvent) => {
    if (!miningAreaRef.current) return;
    const rect = miningAreaRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const resource = getResourceForDepth(state.depth);
    const amount = Math.max(1, Math.floor(state.clickPower * (1 + state.depth / 2000)));
    const depthGain = 0.1 * (1 + state.upgrades.serratedDrillBits * 0.5);
    dispatch({ type: 'MINE', resource, amount, depthGain });
    setDrilling(true);
    setTimeout(() => setDrilling(false), 200);
    const id = nextId.current++;
    setFloatingTexts(prev => [...prev, { id, text: `+${amount} ${resource.toUpperCase()}`, x, y, color: RESOURCE_COLORS[resource] }]);
    setTimeout(() => setFloatingTexts(prev => prev.filter(t => t.id !== id)), 1400);
  }, [state.depth, state.clickPower, state.upgrades.serratedDrillBits, dispatch, getResourceForDepth]);

  // Stable ore dots
  const oreDots = React.useMemo(() => Array.from({ length: 20 }, (_, i) => ({
    id: i, x: 10 + (i * 37 % 80), y: 5 + (i * 23 % 85),
    color: ['#C0C0C0', '#B87333', '#E0E0E0', '#00F2FF'][i % 4],
  })), []);

  return (
    <div style={{ height: '100%', background: '#0B0E14', overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>

      {/* ===== SURFACE AREA (top ~36%) ===== */}
      <div style={{ height: '36%', position: 'relative', overflow: 'hidden', background: 'linear-gradient(180deg,#020408 0%,#050C14 60%,#080F18 100%)', flexShrink: 0 }}>
        <Stars />
        {/* Planet glow */}
        <div style={{ position: 'absolute', top: -30, right: 20, width: 80, height: 80, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%,#3A4A5A,#1A2535 60%,#0A1020)', boxShadow: '0 0 30px rgba(0,242,255,0.15)', opacity: 0.7 }} />
        {/* Horizon */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, background: 'linear-gradient(to top,#1A1208,transparent)' }} />
        {/* Lunar terrain SVG */}
        <svg viewBox="0 0 430 60" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, width: '100%', height: 60 }}>
          <path d="M0 60 L0 40 Q30 25 60 35 Q90 45 120 30 Q150 15 180 28 Q210 40 240 25 Q270 10 300 22 Q330 34 360 18 Q395 5 430 20 L430 60 Z" fill="#1A1208" />
          <path d="M0 60 L0 50 Q40 38 80 45 Q120 52 160 40 Q200 28 240 38 Q280 48 320 35 Q360 22 400 32 L430 28 L430 60 Z" fill="#241910" opacity="0.7" />
        </svg>
        {/* Colony base */}
        <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 4 }}>
            <div style={{ width: 20, height: 14, background: '#1A2535', border: '1px solid #00F2FF30', borderRadius: '4px 4px 0 0' }}>
              <div style={{ margin: '3px auto', width: 6, height: 6, borderRadius: '50%', background: '#00F2FF20', border: '1px solid #00F2FF60' }} />
            </div>
            <div style={{ width: 36, height: 22, background: 'linear-gradient(to top,#0D1B2A,#152535)', border: '1px solid #00F2FF50', borderRadius: '50% 50% 0 0 / 30px 30px 0 0', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)', width: 12, height: 8, borderRadius: '50%', background: '#00F2FF15', border: '1px solid #00F2FF40' }} />
              <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 14, height: 3, background: '#00F2FF20', borderRadius: '2px 2px 0 0' }} />
            </div>
            <div style={{ width: 16, height: 12, background: '#1A2535', border: '1px solid #00F2FF30', borderRadius: '3px 3px 0 0' }}>
              <div style={{ margin: '2px auto', width: 5, height: 5, borderRadius: '50%', background: '#FF8C0030', border: '1px solid #FF8C0060' }} />
            </div>
          </div>
          <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', width: 1, height: 14, background: '#00F2FF80' }}>
            <div style={{ position: 'absolute', top: 0, left: -3, width: 7, height: 7, borderRadius: '50%', background: '#00F2FF', boxShadow: '0 0 6px #00F2FF', animation: 'scm__pulse--cyan 2s ease-in-out infinite', transform: 'translateX(-3px)' }} />
          </div>
        </div>
        {/* HUD overlays */}
        <div style={{ position: 'absolute', top: 8, left: 10 }}>
          <div style={{ padding: '5px 8px', borderRadius: 7, background: 'rgba(11,14,20,0.75)', border: '1px solid rgba(0,242,255,0.2)', backdropFilter: 'blur(4px)' }}>
            <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#00F2FF', fontSize: 8, letterSpacing: '0.1em' }}>SURFACE STATUS</div>
            <div style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFF80', fontSize: 9 }}>Colony: ACTIVE</div>
          </div>
        </div>
        <div style={{ position: 'absolute', top: 8, right: 10 }}>
          <div style={{ padding: '5px 8px', borderRadius: 7, textAlign: 'right', background: 'rgba(11,14,20,0.75)', border: '1px solid rgba(255,140,0,0.2)', backdropFilter: 'blur(4px)' }}>
            <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#FF8C00', fontSize: 8, letterSpacing: '0.1em' }}>PASSIVE RATE</div>
            <div style={{ fontFamily: 'Inter, sans-serif', color: '#FFD700', fontSize: 9 }}>{formatNum(passivePerSec)}/sec</div>
          </div>
        </div>
      </div>

      {/* ===== UNDERGROUND CROSS-SECTION (bottom 64%) ===== */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative', minHeight: 0 }}>

        {/* Depth gauge (left strip) */}
        <div style={{ width: 44, flexShrink: 0, background: '#080A0E', borderRight: '1px solid rgba(0,242,255,0.15)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '6px 0', position: 'relative', overflow: 'hidden' }}>
          <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#00F2FF80', fontSize: 7, letterSpacing: '0.08em', marginBottom: 4, writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>DEPTH</div>
          <div style={{ flex: 1, width: 4, borderRadius: 2, background: 'rgba(0,242,255,0.1)', border: '1px solid rgba(0,242,255,0.15)', position: 'relative', margin: '4px 0' }}>
            <motion.div
              style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top,#00F2FF,#00F2FF60)', borderRadius: 2 }}
              animate={{ height: `${Math.min(depthPercent, 100)}%` }}
              transition={{ duration: 0.5 }}
            />
            <div style={{ position: 'absolute', top: 0, left: -8, right: -8, height: 2, background: '#FF8C00', boxShadow: '0 0 6px #FF8C00', animation: 'scm__glow--orange 1.5s ease-in-out infinite' }}>
              <div style={{ position: 'absolute', right: -2, top: -3, width: 0, height: 0, borderLeft: '5px solid #FF8C00', borderTop: '4px solid transparent', borderBottom: '4px solid transparent' }} />
            </div>
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', color: '#00F2FF', fontSize: 8, fontWeight: 600 }}>{Math.floor(state.depth)}m</div>
          <div style={{ fontFamily: 'Inter, sans-serif', color: '#FF8C0080', fontSize: 7 }}>{MILESTONE}m★</div>
        </div>

        {/* Mining area */}
        <div
          ref={miningAreaRef}
          onClick={handleMineClick}
          style={{ flex: 1, position: 'relative', cursor: 'crosshair', overflow: 'hidden' }}
        >
          {/* Geological layers */}
          {LAYERS.map((layer, i) => (
            <div
              key={layer.name}
              style={{
                height: '25%',
                background: `linear-gradient(135deg,${layer.color} 0%,${layer.accent} 50%,${layer.color} 100%)`,
                borderBottom: '1px solid rgba(0,242,255,0.06)',
                position: 'relative',
                opacity: i === currentLayer ? 1 : 0.7,
              }}
            >
              {/* Layer label */}
              <div style={{ position: 'absolute', top: 3, right: 6, display: 'flex', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: layer.resourceColor, boxShadow: `0 0 4px ${layer.resourceColor}` }} />
                <span style={{ fontFamily: 'Orbitron, sans-serif', color: i === currentLayer ? '#FFFFFF80' : '#FFFFFF30', fontSize: 7, letterSpacing: '0.08em' }}>{layer.name}</span>
              </div>
              <div style={{ position: 'absolute', bottom: 3, right: 6 }}>
                <span style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFF20', fontSize: 8 }}>{layer.depth}</span>
              </div>
              {/* Rock texture */}
              {Array.from({ length: 8 }, (_, j) => (
                <div key={j} style={{ position: 'absolute', left: `${8 + j * 12}%`, top: `${20 + (j % 3) * 25}%`, width: 3 + (j % 2), height: 3 + (j % 2), borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
              ))}
              {/* Ore dots in current layer */}
              {i === currentLayer && oreDots.slice(0, 8).map(dot => (
                <div key={dot.id} style={{ position: 'absolute', left: `${dot.x}%`, top: `${dot.y}%`, width: 4, height: 4, borderRadius: '50%', background: dot.color, boxShadow: `0 0 5px ${dot.color}`, opacity: 0.7 }} />
              ))}
              {/* Mining robot in current layer */}
              {i === currentLayer && (
                <div style={{ position: 'absolute', top: '18%', left: '50%', transform: 'translateX(-50%)' }}>
                  <MiningRobot drilling={drilling} />
                  {drilling && (
                    <motion.div
                      initial={{ opacity: 0.8, scale: 0.5 }}
                      animate={{ opacity: 0, scale: 2.2 }}
                      transition={{ duration: 0.3 }}
                      style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', width: 32, height: 16, borderRadius: '50%', background: '#FF8C0050' }}
                    />
                  )}
                  <div style={{ textAlign: 'center', marginTop: 4 }}>
                    <span style={{ fontFamily: 'Orbitron, sans-serif', color: '#00F2FF20', fontSize: 7, letterSpacing: '0.1em' }}>TAP TO MINE</span>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* ── DRONE FLEET (absolutely positioned over all layers) ── */}
          <DroneFleet droneCount={droneCount} droneSpeed={state.droneSpeed} />

          {/* Floating resource texts */}
          <AnimatePresence>
            {floatingTexts.map(ft => (
              <motion.div
                key={ft.id}
                initial={{ opacity: 1, y: 0 }}
                animate={{ opacity: 0, y: -70 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.3, ease: 'easeOut' }}
                style={{
                  position: 'absolute', left: `${ft.x}%`, top: `${ft.y}%`,
                  transform: 'translateX(-50%)',
                  fontFamily: 'Orbitron, sans-serif', color: ft.color,
                  fontSize: 12, fontWeight: 700,
                  pointerEvents: 'none',
                  textShadow: `0 0 10px ${ft.color}`,
                  whiteSpace: 'nowrap', zIndex: 100,
                }}
              >
                {ft.text}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* CRT scan-line overlay */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', opacity: 0.03 }}>
            {Array.from({ length: 30 }, (_, i) => (
              <div key={i} style={{ position: 'absolute', top: `${i * 3.4}%`, left: 0, right: 0, height: 1, background: '#00F2FF' }} />
            ))}
          </div>
        </div>
      </div>

      {/* Depth progress bar */}
      <div style={{ position: 'absolute', bottom: 42, left: 44, right: 0, height: 3, background: 'rgba(0,242,255,0.1)' }}>
        <motion.div
          animate={{ width: `${Math.min((state.depth / MILESTONE) * 100, 100)}%` }}
          style={{ height: '100%', background: 'linear-gradient(90deg,#00F2FF60,#00F2FF)', boxShadow: '0 0 6px #00F2FF' }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Bottom resource bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 44, right: 0,
        background: 'rgba(8,10,14,0.97)', borderTop: '1px solid rgba(0,242,255,0.12)',
        backdropFilter: 'blur(8px)', padding: '5px 10px',
        display: 'flex', gap: 8, alignItems: 'center', zIndex: 10,
        height: 42,
      }}>
        {[
          { key: 'iron',     label: 'Fe', color: '#C0C0C0', emoji: '🪨' },
          { key: 'copper',   label: 'Cu', color: '#B87333', emoji: '🟠' },
          { key: 'silver',   label: 'Ag', color: '#E8E8FF', emoji: '⚪' },
          { key: 'diamonds', label: 'Di', color: '#00F2FF', emoji: '💎' },
        ].map(r => (
          <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
            <span style={{ fontSize: 12 }}>{r.emoji}</span>
            <div>
              <div style={{ fontFamily: 'Orbitron, sans-serif', color: r.color, fontSize: 8, lineHeight: '1' }}>{r.label}</div>
              <div style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFF', fontSize: 10, fontWeight: 600 }}>{formatNum(state.resources[r.key as keyof typeof state.resources])}</div>
            </div>
          </div>
        ))}
        <button
          onClick={(e) => { e.stopPropagation(); setShowInventory(true); }}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', borderRadius: 8, background: 'rgba(0,242,255,0.1)', border: '1px solid rgba(0,242,255,0.3)', color: '#00F2FF', cursor: 'pointer', flexShrink: 0 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 8 }}>BAG</span>
        </button>
      </div>

      {/* ===== INVENTORY OVERLAY ===== */}
      <AnimatePresence>
        {showInventory && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowInventory(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(5,8,12,0.88)', backdropFilter: 'blur(8px)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
          >
            <motion.div
              initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={e => e.stopPropagation()}
              style={{ width: '100%', background: '#0D1018', border: '1px solid rgba(0,242,255,0.2)', borderRadius: '20px 20px 0 0', padding: 18 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#00F2FF', fontSize: 14, letterSpacing: '0.1em' }}>INVENTORY</div>
                <button onClick={() => setShowInventory(false)} style={{ color: '#FFFFFF40', background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', lineHeight: '1' }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 14 }}>
                {[
                  { key: 'iron',     name: 'Iron Ore',  emoji: '🪨', color: '#C0C0C0', weight: 1 },
                  { key: 'copper',   name: 'Copper',    emoji: '🟤', color: '#B87333', weight: 2 },
                  { key: 'silver',   name: 'Silver',    emoji: '⚪', color: '#E8E8FF', weight: 5 },
                  { key: 'diamonds', name: 'Diamonds',  emoji: '💎', color: '#00F2FF', weight: 20 },
                ].map(r => (
                  <div key={r.key} style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${r.color}30`, borderRadius: 10, padding: 10, textAlign: 'center' }}>
                    <div style={{ fontSize: 22 }}>{r.emoji}</div>
                    <div style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFF', fontSize: 11, fontWeight: 600, marginTop: 4 }}>{formatNum(state.resources[r.key as keyof typeof state.resources])}</div>
                    <div style={{ fontFamily: 'Inter, sans-serif', color: r.color, fontSize: 9 }}>{r.name}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFF60', fontSize: 11 }}>Storage</span>
                  <span style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFF80', fontSize: 11 }}>{formatNum(state.storageUsed)} / {formatNum(state.storageMax)} kg</span>
                </div>
                <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                  <motion.div
                    animate={{ width: `${Math.min((state.storageUsed / state.storageMax) * 100, 100)}%` }}
                    style={{ height: '100%', background: state.storageUsed > state.storageMax * 0.8 ? 'linear-gradient(90deg,#FF4444,#FF8C00)' : 'linear-gradient(90deg,#00F2FF60,#00F2FF)', borderRadius: 4 }}
                  />
                </div>
              </div>
              {state.purchasedItems && state.purchasedItems.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#00F2FF80', fontSize: 10, letterSpacing: '0.1em', marginBottom: 8 }}>PURCHASED ITEMS</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {state.purchasedItems.map((item) => (
                      <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'rgba(0,242,255,0.05)', border: '1px solid rgba(0,242,255,0.15)', borderRadius: 8 }}>
                        <span style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFF90', fontSize: 11 }}>{item.name}</span>
                        <span style={{ fontFamily: 'Orbitron, sans-serif', color: '#00F2FF', fontSize: 11, fontWeight: 700 }}>×{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={() => { dispatch({ type: 'SELL_ALL' }); setShowInventory(false); }}
                style={{ display: 'block', width: '100%', padding: '13px', borderRadius: 13, background: 'linear-gradient(135deg,#FF8C00,#FF6B00)', border: 'none', color: '#FFFFFF', fontFamily: 'Orbitron, sans-serif', fontSize: 12, letterSpacing: '0.1em', cursor: 'pointer', boxShadow: '0 0 20px #FF8C0050', lineHeight: '1.4' }}
              >
                💰 SELL ALL MINERALS
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
