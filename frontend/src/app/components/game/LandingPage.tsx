import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion, useScroll, useTransform } from 'motion/react';
import { ImageWithFallback } from '../figma/ImageWithFallback';

/* ── Animated starfield canvas ───────────────────────────────── */
function StarCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const stars = Array.from({ length: 220 }, () => ({
      x:       Math.random() * canvas.width,
      y:       Math.random() * canvas.height,
      r:       Math.random() * 1.6 + 0.2,
      speed:   Math.random() * 0.012 + 0.003,
      phase:   Math.random() * Math.PI * 2,
      opacity: Math.random() * 0.6 + 0.2,
    }));

    let raf: number;
    let t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      t += 0.008;
      stars.forEach(s => {
        const a = s.opacity * (0.5 + 0.5 * Math.sin(t * s.speed * 40 + s.phase));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }} />;
}

/* ── Floating ore particle ───────────────────────────────────── */
function OreParticle({ emoji, x, delay, duration }: { emoji: string; x: number; delay: number; duration: number; key?: React.Key }) {
  return (
    <motion.div
      className="absolute pointer-events-none select-none"
      style={{ left: `${x}%`, bottom: '-10%', fontSize: 22, zIndex: 2 }}
      animate={{ y: [0, -500], opacity: [0, 0.9, 0.9, 0] }}
      transition={{ duration, delay, repeat: Infinity, ease: 'easeOut' }}
    >
      {emoji}
    </motion.div>
  );
}

/* ── Feature card ────────────────────────────────────────────── */
function FeatureCard({
  icon, title, desc, color, delay,
}: { icon: string; title: string; desc: string; color: string; delay: number; key?: React.Key }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay, ease: 'easeOut' }}
      whileHover={{ y: -6, transition: { duration: 0.2 } }}
      className="relative rounded-2xl p-6 flex flex-col gap-4 cursor-default"
      style={{
        background: `linear-gradient(135deg, rgba(11,14,20,0.9), rgba(13,20,32,0.85))`,
        border: `1px solid ${color}30`,
        boxShadow: `0 0 40px ${color}10, 0 8px 32px rgba(0,0,0,0.4)`,
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Glow corner */}
      <div className="absolute top-0 left-0 w-24 h-24 rounded-tl-2xl pointer-events-none"
        style={{ background: `radial-gradient(circle at 0% 0%, ${color}14, transparent 70%)` }} />

      <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl flex-shrink-0"
        style={{ background: `${color}15`, border: `1px solid ${color}35`, boxShadow: `0 0 20px ${color}20` }}>
        {icon}
      </div>
      <div>
        <h3 className="mb-2" style={{ fontFamily: 'Orbitron, sans-serif', color: '#FFFFFF', fontSize: 14, letterSpacing: '0.10em' }}>
          {title}
        </h3>
        <p style={{ fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,0.52)', fontSize: 13, lineHeight: 1.65 }}>
          {desc}
        </p>
      </div>
      <div className="mt-auto h-px" style={{ background: `linear-gradient(90deg, ${color}40, transparent)` }} />
    </motion.div>
  );
}

/* ── Stat counter ────────────────────────────────────────────── */
function StatBadge({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div style={{ fontFamily: 'Orbitron, sans-serif', color, fontSize: 28, letterSpacing: '0.06em',
        textShadow: `0 0 20px ${color}80` }}>
        {value}
      </div>
      <div style={{ fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,0.38)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  );
}

/* ── Step card ───────────────────────────────────────────────── */
function StepCard({ num, title, desc, delay }: { num: string; title: string; desc: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay }}
      className="flex items-start gap-5"
    >
      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: 'rgba(0,242,255,0.10)', border: '1px solid rgba(0,242,255,0.35)',
          fontFamily: 'Orbitron, sans-serif', color: '#00F2FF', fontSize: 13,
          boxShadow: '0 0 14px rgba(0,242,255,0.25)' }}>
        {num}
      </div>
      <div>
        <div className="mb-1" style={{ fontFamily: 'Orbitron, sans-serif', color: '#FFFFFF', fontSize: 12, letterSpacing: '0.09em' }}>
          {title}
        </div>
        <div style={{ fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,0.45)', fontSize: 13, lineHeight: 1.6 }}>
          {desc}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Main LandingPage ────────────────────────────────────────── */
export function LandingPage() {
  const navigate = useNavigate();
  const heroRef  = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  // Navbar scroll shadow
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const ores = [
    { emoji: '🪨', x: 8,  delay: 0,   duration: 7  },
    { emoji: '🟠', x: 18, delay: 2.5, duration: 9  },
    { emoji: '⚪', x: 33, delay: 1,   duration: 11 },
    { emoji: '💎', x: 58, delay: 3.8, duration: 8  },
    { emoji: '💰', x: 74, delay: 0.6, duration: 10 },
    { emoji: '🪨', x: 86, delay: 4.5, duration: 7.5},
    { emoji: '⚙️', x: 44, delay: 2,   duration: 12 },
  ];

  const features = [
    {
      icon: '⛏️', color: '#FF8C00',
      title: 'TAP TO MINE',
      desc: 'Drill through geological layers — Iron, Copper, Silver, Diamond — each with increasing depth and richer rewards. Every tap counts.',
    },
    {
      icon: '🤖', color: '#00F2FF',
      title: 'DEPLOY DRONES',
      desc: 'Unlock and upgrade autonomous mining drones that harvest ore 24/7 even when you\'re offline. Build your robotic fleet.',
    },
    {
      icon: '🚀', color: '#FFD700',
      title: 'UPGRADE & DOMINATE',
      desc: 'Invest gold into the Upgrades Workshop — boost drill power, battery efficiency, drone speed, and cargo capacity.',
    },
    {
      icon: '🏆', color: '#9B59B6',
      title: 'EARN ACHIEVEMENTS',
      desc: 'Complete depth milestones, mining quotas, and fleet challenges. Claim gold rewards and showcase your colony status.',
    },
    {
      icon: '💎', color: '#00F2FF',
      title: 'GEM STORE',
      desc: 'Use Gems to trigger Turbo Drills, Depth Dives, Drone Overclocks and more. Powerful boosts for when you need an edge.',
    },
    {
      icon: '🌌', color: '#FF8C00',
      title: 'ENDLESS DEPTH',
      desc: 'The colony descends to 5,000 metres. Each layer shifts the ore distribution. How deep can you push your operation?',
    },
  ];

  return (
    <div style={{ background: '#050810', minHeight: '100vh', overflowX: 'hidden', position: 'relative' }}>

      {/* ── Sticky Navbar ─────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 flex items-center justify-between px-6 py-4"
        style={{
          zIndex: 100,
          background: scrolled ? 'rgba(5,8,16,0.92)' : 'transparent',
          backdropFilter: scrolled ? 'blur(14px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(0,242,255,0.10)' : 'none',
          transition: 'all 0.3s ease',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
            style={{ background: 'linear-gradient(135deg,#1A2A3A,#0D1B2A)', border: '1px solid rgba(0,242,255,0.4)' }}>
            ⛏️
          </div>
          <div>
            <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#FFFFFF', fontSize: 10, letterSpacing: '0.16em', lineHeight: 1 }}>SPACE COLONY</div>
            <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#00F2FF', fontSize: 13, letterSpacing: '0.12em', lineHeight: 1.2, textShadow: '0 0 10px #00F2FF80' }}>MINER</div>
          </div>
        </div>

        {/* CTA */}
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/auth')}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl"
          style={{
            background: 'linear-gradient(135deg, #FF8C00, #FF5A00)',
            fontFamily: 'Orbitron, sans-serif',
            color: '#FFFFFF',
            fontSize: 10,
            letterSpacing: '0.12em',
            boxShadow: '0 0 18px rgba(255,140,0,0.45)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <span>LAUNCH MISSION</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </motion.button>
      </nav>

      {/* ══════════════════════════════════════════════════════════
          HERO SECTION
      ══════════════════════════════════════════════════════════ */}
      <section
        ref={heroRef}
        className="relative flex flex-col items-center justify-center text-center overflow-hidden"
        style={{ minHeight: '100vh', paddingTop: 80, paddingBottom: 60 }}
      >
        {/* Background image */}
        <div className="absolute inset-0" style={{ zIndex: 0 }}>
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1772672869101-7abc3637fb7e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzcGFjZSUyMGdhbGF4eSUyMG5lYnVsYSUyMGRhcmslMjBzdGFyc3xlbnwxfHx8fDE3NzYzMTg4OTZ8MA&ixlib=rb-4.1.0&q=80&w=1080"
            alt="Space galaxy background"
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.30 }}
          />
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to bottom, rgba(5,8,16,0.4) 0%, rgba(5,8,16,0.2) 40%, rgba(5,8,16,0.85) 85%, #050810 100%)'
          }} />
        </div>

        {/* Starfield canvas */}
        <StarCanvas />

        {/* Nebula colour blobs */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
          <div style={{
            position: 'absolute', top: '15%', left: '10%',
            width: 400, height: 400, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,242,255,0.07) 0%, transparent 70%)',
            filter: 'blur(30px)',
          }} />
          <div style={{
            position: 'absolute', bottom: '20%', right: '8%',
            width: 350, height: 350, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,140,0,0.08) 0%, transparent 70%)',
            filter: 'blur(30px)',
          }} />
        </div>

        {/* Floating ore particles */}
        {ores.map((o, i) => (
          <OreParticle key={i} {...o} />
        ))}

        {/* Hero content */}
        <div className="relative flex flex-col items-center gap-6 px-4" style={{ zIndex: 5, maxWidth: 760 }}>

          {/* Pre-title badge */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="flex items-center gap-2 px-4 py-2 rounded-full"
            style={{
              background: 'rgba(0,242,255,0.08)',
              border: '1px solid rgba(0,242,255,0.25)',
              boxShadow: '0 0 20px rgba(0,242,255,0.10)',
            }}
          >
            <div className="w-2 h-2 rounded-full" style={{ background: '#00D26A', boxShadow: '0 0 6px #00D26A', animation: 'scm__pulse--cyan 1.5s ease-in-out infinite' }} />
            <span style={{ fontFamily: 'Orbitron, sans-serif', color: '#00F2FF', fontSize: 9, letterSpacing: '0.18em' }}>
              COLONY COMMAND NETWORK — ONLINE
            </span>
          </motion.div>

          {/* Main title */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
          >
            <div style={{
              fontFamily: 'Orbitron, sans-serif',
              color: 'rgba(255,255,255,0.70)',
              fontSize: 'clamp(13px,2.5vw,18px)',
              letterSpacing: '0.35em',
              marginBottom: 8,
            }}>
              SPACE COLONY
            </div>
            <h1 style={{
              fontFamily: 'Orbitron, sans-serif',
              fontSize: 'clamp(48px,9vw,96px)',
              letterSpacing: '0.08em',
              color: '#FFFFFF',
              lineHeight: 0.95,
              textShadow: '0 0 40px rgba(0,242,255,0.45), 0 0 80px rgba(0,242,255,0.20)',
              margin: 0,
            }}>
              MINER
            </h1>
            <div style={{
              fontFamily: 'Orbitron, sans-serif',
              color: '#00F2FF',
              fontSize: 'clamp(11px,2vw,15px)',
              letterSpacing: '0.32em',
              marginTop: 10,
              textShadow: '0 0 16px #00F2FF',
            }}>
              IDLE CLICKER · SPACE EXPLORATION
            </div>
          </motion.div>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            style={{
              fontFamily: 'Inter, sans-serif',
              color: 'rgba(255,255,255,0.50)',
              fontSize: 'clamp(14px,2.2vw,18px)',
              lineHeight: 1.65,
              maxWidth: 520,
              margin: 0,
            }}
          >
            Drill through alien rock layers, deploy autonomous drones, and build the most powerful mining colony in the galaxy.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55 }}
            className="flex items-center gap-4 flex-wrap justify-center mt-2"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/auth')}
              className="relative flex items-center gap-3 px-8 py-4 rounded-2xl overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #FF8C00, #FF4D00)',
                fontFamily: 'Orbitron, sans-serif',
                color: '#FFFFFF',
                fontSize: 13,
                letterSpacing: '0.14em',
                boxShadow: '0 0 30px rgba(255,140,0,0.55), 0 8px 30px rgba(255,140,0,0.30)',
                border: 'none',
                cursor: 'pointer',
                animation: 'scm__glow--orange 2.5s ease-in-out infinite',
              }}
            >
              <span>⚡</span>
              <span>LAUNCH MISSION</span>
            </motion.button>

            <motion.a
              href="#features"
              whileHover={{ scale: 1.03 }}
              className="flex items-center gap-2 px-7 py-4 rounded-2xl"
              style={{
                background: 'rgba(0,242,255,0.07)',
                border: '1px solid rgba(0,242,255,0.30)',
                fontFamily: 'Orbitron, sans-serif',
                color: '#00F2FF',
                fontSize: 11,
                letterSpacing: '0.12em',
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              <span>EXPLORE</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </motion.a>
          </motion.div>

          {/* Stats row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.75 }}
            className="flex items-center gap-8 mt-6 flex-wrap justify-center"
          >
            <StatBadge value="5,000M" label="Max Depth"       color="#00F2FF" />
            <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.10)' }} />
            <StatBadge value="6"      label="Ore Types"       color="#FF8C00" />
            <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.10)' }} />
            <StatBadge value="8"      label="Drone Classes"    color="#FFD700" />
            <div style={{ width: 1, height: 36, background: 'rgba(255,255,255,0.10)' }} />
            <StatBadge value="FREE"   label="To Play"          color="#00D26A" />
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          style={{ zIndex: 5 }}
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div style={{ fontFamily: 'Orbitron, sans-serif', color: 'rgba(255,255,255,0.22)', fontSize: 7, letterSpacing: '0.20em' }}>
            SCROLL
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </motion.div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          PREVIEW IMAGE BAND
      ══════════════════════════════════════════════════════════ */}
      <section className="relative py-16 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'linear-gradient(135deg, rgba(0,242,255,0.03), rgba(255,140,0,0.03))',
          borderTop: '1px solid rgba(0,242,255,0.07)',
          borderBottom: '1px solid rgba(255,140,0,0.07)',
        }} />
        <div className="relative flex gap-6 items-stretch justify-center px-6 flex-wrap" style={{ zIndex: 2, maxWidth: 1100, margin: '0 auto' }}>
          {/* Left image */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65 }}
            className="relative rounded-2xl overflow-hidden flex-1"
            style={{ minWidth: 260, maxWidth: 440, minHeight: 220, border: '1px solid rgba(255,140,0,0.22)', boxShadow: '0 0 40px rgba(255,140,0,0.08)' }}
          >
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1667841686893-4a0b40e178b7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmdXR1cmlzdGljJTIwbWluaW5nJTIwcm9ib3QlMjBpbmR1c3RyaWFsJTIwc3BhY2V8ZW58MXx8fHwxNzc2MzE4ODk2fDA&ixlib=rb-4.1.0&q=80&w=1080"
              alt="Mining robot"
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }}
            />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(5,8,16,0.9) 0%, transparent 60%)' }} />
            <div className="absolute bottom-4 left-4 right-4">
              <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#FF8C00', fontSize: 10, letterSpacing: '0.14em' }}>DRILL FLEET</div>
              <div style={{ fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 3 }}>Industrial-grade autonomous robots</div>
            </div>
          </motion.div>

          {/* Right image */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, delay: 0.12 }}
            className="relative rounded-2xl overflow-hidden flex-1"
            style={{ minWidth: 260, maxWidth: 440, minHeight: 220, border: '1px solid rgba(0,242,255,0.18)', boxShadow: '0 0 40px rgba(0,242,255,0.06)' }}
          >
            <ImageWithFallback
              src="https://images.unsplash.com/photo-1742884857582-758c99f2f5cd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhc3Rlcm9pZCUyMG1pbmluZyUyMGNvbG9ueSUyMHNjaS1maSUyMHBsYW5ldHxlbnwxfHx8fDE3NzYzMTg4OTZ8MA&ixlib=rb-4.1.0&q=80&w=1080"
              alt="Space colony"
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.65 }}
            />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(5,8,16,0.9) 0%, transparent 60%)' }} />
            <div className="absolute bottom-4 left-4 right-4">
              <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#00F2FF', fontSize: 10, letterSpacing: '0.14em' }}>COLONY HUB</div>
              <div style={{ fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 3 }}>Your command centre in the void</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          FEATURES GRID
      ══════════════════════════════════════════════════════════ */}
      <section id="features" className="py-20 px-6" style={{ maxWidth: 1100, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#00F2FF', fontSize: 9, letterSpacing: '0.28em', marginBottom: 12 }}>
            CORE SYSTEMS
          </div>
          <h2 style={{ fontFamily: 'Orbitron, sans-serif', color: '#FFFFFF', fontSize: 'clamp(22px,4vw,36px)', letterSpacing: '0.10em', margin: 0 }}>
            WHAT AWAITS YOU
          </h2>
          <div className="mx-auto mt-5" style={{ height: 2, width: 80, background: 'linear-gradient(90deg, transparent, #00F2FF, transparent)' }} />
        </motion.div>

        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {features.map((f, i) => (
            <FeatureCard key={f.title} {...f} delay={i * 0.08} />
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════════════════════ */}
      <section className="py-20 px-6" style={{ maxWidth: 900, margin: '0 auto' }}>
        <div className="flex flex-col lg:flex-row gap-16 items-center">

          {/* Left — steps */}
          <div className="flex-1 min-w-0">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="mb-12"
            >
              <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#FF8C00', fontSize: 9, letterSpacing: '0.28em', marginBottom: 10 }}>
                MISSION BRIEFING
              </div>
              <h2 style={{ fontFamily: 'Orbitron, sans-serif', color: '#FFFFFF', fontSize: 'clamp(20px,3.5vw,30px)', letterSpacing: '0.10em', margin: 0 }}>
                HOW TO COLONISE
              </h2>
            </motion.div>

            <div className="flex flex-col gap-8">
              <StepCard num="01" title="CREATE YOUR ACCOUNT" desc="Sign up securely through Xsolla — your colony data is saved across all devices." delay={0} />
              <StepCard num="02" title="START DRILLING" desc="Tap the mining core to extract ore. The deeper you drill, the rarer the minerals." delay={0.1} />
              <StepCard num="03" title="DEPLOY YOUR FLEET" desc="Unlock drones that mine autonomously. Idle income runs even when you're offline." delay={0.2} />
              <StepCard num="04" title="UPGRADE & SELL" desc="Invest in Workshop upgrades, sell your haul for gold, and push toward 5,000m." delay={0.3} />
            </div>
          </div>

          {/* Right — decorative panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex-shrink-0 rounded-2xl p-6 flex flex-col gap-4"
            style={{
              width: 280,
              background: 'rgba(11,14,20,0.80)',
              border: '1px solid rgba(0,242,255,0.18)',
              boxShadow: '0 0 50px rgba(0,242,255,0.07)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {/* Mini HUD mockup */}
            <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#00F2FF', fontSize: 8, letterSpacing: '0.16em', marginBottom: 4 }}>
              MISSION STATUS
            </div>
            {[
              { emoji: '🪨', label: 'Iron',     val: '12,840',  color: '#C0C0C0' },
              { emoji: '🟠', label: 'Copper',   val: '3,210',   color: '#B87333' },
              { emoji: '⚪', label: 'Silver',   val: '482',     color: '#E8E8FF' },
              { emoji: '💎', label: 'Diamond',  val: '29',      color: '#00F2FF' },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center gap-2">
                  <span>{r.emoji}</span>
                  <span style={{ fontFamily: 'Orbitron, sans-serif', color: 'rgba(255,255,255,0.40)', fontSize: 9, letterSpacing: '0.08em' }}>{r.label}</span>
                </div>
                <span style={{ fontFamily: 'Inter, sans-serif', color: r.color, fontSize: 13, fontWeight: 700 }}>{r.val}</span>
              </div>
            ))}

            <div className="h-px my-1" style={{ background: 'rgba(0,242,255,0.12)' }} />

            <div className="flex justify-between items-center px-1">
              <div>
                <div style={{ fontFamily: 'Orbitron, sans-serif', color: 'rgba(255,255,255,0.30)', fontSize: 7, letterSpacing: '0.10em' }}>DEPTH</div>
                <div style={{ fontFamily: 'Inter, sans-serif', color: '#00F2FF', fontSize: 20, fontWeight: 700 }}>2,184m</div>
              </div>
              <div>
                <div style={{ fontFamily: 'Orbitron, sans-serif', color: 'rgba(255,255,255,0.30)', fontSize: 7, letterSpacing: '0.10em' }}>GOLD</div>
                <div style={{ fontFamily: 'Inter, sans-serif', color: '#FFD700', fontSize: 20, fontWeight: 700 }}>48.2K</div>
              </div>
              <div>
                <div style={{ fontFamily: 'Orbitron, sans-serif', color: 'rgba(255,255,255,0.30)', fontSize: 7, letterSpacing: '0.10em' }}>DRONES</div>
                <div style={{ fontFamily: 'Inter, sans-serif', color: '#FF8C00', fontSize: 20, fontWeight: 700 }}>7</div>
              </div>
            </div>

            {/* Depth bar */}
            <div>
              <div className="flex justify-between mb-1">
                <span style={{ fontFamily: 'Orbitron, sans-serif', color: 'rgba(255,255,255,0.25)', fontSize: 7, letterSpacing: '0.08em' }}>LAYER PROGRESS</span>
                <span style={{ fontFamily: 'Inter, sans-serif', color: '#00F2FF', fontSize: 9 }}>43%</span>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: 6, background: 'rgba(255,255,255,0.07)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #00F2FF, #00B8CC)' }}
                  initial={{ width: '0%' }}
                  whileInView={{ width: '43%' }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.2, ease: 'easeOut', delay: 0.4 }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 rounded-lg mt-1"
              style={{ background: 'rgba(0,242,255,0.06)', border: '1px solid rgba(0,242,255,0.18)' }}>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#00D26A', boxShadow: '0 0 5px #00D26A', animation: 'scm__pulse--cyan 1.5s ease-in-out infinite' }} />
              <span style={{ fontFamily: 'Orbitron, sans-serif', color: '#00D26A', fontSize: 8, letterSpacing: '0.10em' }}>
                ALL DRONES ACTIVE
              </span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          FINAL CTA BANNER
      ══════════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse at 50% 50%, rgba(0,242,255,0.06) 0%, transparent 70%)',
          borderTop: '1px solid rgba(0,242,255,0.08)',
          borderBottom: '1px solid rgba(0,242,255,0.08)',
        }} />

        <div className="relative flex flex-col items-center gap-8 text-center" style={{ zIndex: 1, maxWidth: 680, margin: '0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
          >
            <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#FF8C00', fontSize: 9, letterSpacing: '0.26em', marginBottom: 14 }}>
              READY, COMMANDER?
            </div>
            <h2 style={{ fontFamily: 'Orbitron, sans-serif', color: '#FFFFFF', fontSize: 'clamp(24px,5vw,44px)', letterSpacing: '0.08em', margin: 0, textShadow: '0 0 40px rgba(0,242,255,0.30)' }}>
              YOUR COLONY<br />AWAITS
            </h2>
            <p className="mt-5" style={{ fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,0.42)', fontSize: 15, lineHeight: 1.7, maxWidth: 480, margin: '20px auto 0' }}>
              Sign in with Xsolla to save your progress, unlock the full experience, and compete with commanders across the galaxy.
            </p>
          </motion.div>

          <motion.button
            initial={{ opacity: 0, scale: 0.92 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/auth')}
            className="flex items-center gap-4 px-10 py-5 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, #FF8C00, #FF4500)',
              fontFamily: 'Orbitron, sans-serif',
              color: '#FFFFFF',
              fontSize: 15,
              letterSpacing: '0.16em',
              boxShadow: '0 0 40px rgba(255,140,0,0.55), 0 12px 40px rgba(255,140,0,0.25)',
              border: 'none',
              cursor: 'pointer',
              animation: 'scm__glow--orange 2.5s ease-in-out infinite',
            }}
          >
            <span>🚀</span>
            <span>LOGIN / SIGN UP</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </motion.button>

          {/* Trust badges */}
          <div className="flex items-center gap-6 flex-wrap justify-center mt-2">
            {[
              { icon: '🔒', text: 'Secure via Xsolla' },
              { icon: '⚡', text: 'Instant Access'   },
              { icon: '🌍', text: 'All Regions'       },
            ].map(b => (
              <div key={b.text} className="flex items-center gap-2">
                <span style={{ fontSize: 15 }}>{b.icon}</span>
                <span style={{ fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{b.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════════ */}
      <footer className="py-8 px-6" style={{ borderTop: '1px solid rgba(0,242,255,0.07)' }}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4" style={{ maxWidth: 1100, margin: '0 auto' }}>
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(0,242,255,0.08)', border: '1px solid rgba(0,242,255,0.25)', fontSize: 14 }}>
              ⛏️
            </div>
            <span style={{ fontFamily: 'Orbitron, sans-serif', color: 'rgba(255,255,255,0.30)', fontSize: 9, letterSpacing: '0.14em' }}>
              SPACE COLONY MINER © 2026
            </span>
          </div>

          {/* Xsolla credit */}
          <div className="flex items-center gap-2">
            <span style={{ fontFamily: 'Inter, sans-serif', color: 'rgba(255,255,255,0.22)', fontSize: 11 }}>
              Authentication &amp; payments powered by
            </span>
            <span style={{ fontFamily: 'Orbitron, sans-serif', color: 'rgba(255,140,0,0.55)', fontSize: 10, letterSpacing: '0.08em' }}>
              XSOLLA
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
