import React, { useState } from 'react';
import { useGame, ACHIEVEMENTS_CONFIG } from '../../context/GameContext';

const formatNum = (n: number): string => {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return Math.floor(n).toString();
};

function useScreenWidth() {
  const [w, setW] = React.useState(() => window.innerWidth);
  React.useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

export function Achievements() {
  const { state, dispatch } = useGame();
  const [claimAnim, setClaimAnim] = useState<string | null>(null);
  const screenWidth = useScreenWidth();
  const isWide = screenWidth >= 768;

  const handleClaim = (id: string, reward: number) => {
    setClaimAnim(id);
    setTimeout(() => {
      dispatch({ type: 'CLAIM_ACHIEVEMENT', id, reward });
      setClaimAnim(null);
    }, 700);
  };

  const totalCompleted = ACHIEVEMENTS_CONFIG.filter(a => state.achievements[a.id]?.completed).length;
  const total = ACHIEVEMENTS_CONFIG.length;
  const overallPct = Math.round((totalCompleted / total) * 100);

  return (
    <div style={{ height: '100%', background: '#0B0E14', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Fixed Header ── */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid rgba(0,242,255,0.14)', flexShrink: 0, background: '#0B0E14' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#FFFFFF', fontSize: 16, letterSpacing: '0.1em', marginBottom: 3 }}>
              ACHIEVEMENTS
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', color: '#00F2FF80', fontSize: 11 }}>
              Mission Milestones &amp; Exploration Records
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#FFD700', fontSize: 22, lineHeight: '1.1' }}>
              {totalCompleted}/{total}
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFF40', fontSize: 9, letterSpacing: '0.08em', marginTop: 2 }}>
              UNLOCKED
            </div>
          </div>
        </div>

        {/* Overall progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 6, background: 'rgba(0,242,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${overallPct}%`,
              background: 'linear-gradient(90deg,#00F2FF60,#00F2FF)',
              borderRadius: 3, boxShadow: '0 0 6px #00F2FF', transition: 'width 0.8s ease',
            }} />
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', color: '#00F2FF80', fontSize: 10, flexShrink: 0 }}>{overallPct}%</div>
        </div>
      </div>

      {/* ── Scrollable List ── */}
      <div style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 14px 20px',
        display: isWide ? 'grid' : 'block',
        gridTemplateColumns: isWide ? 'repeat(2,1fr)' : undefined,
        gap: isWide ? 10 : undefined,
        alignItems: 'start',
      }}>
        {ACHIEVEMENTS_CONFIG.map((ach) => {
          const achState = state.achievements[ach.id];
          const progress = achState?.progress ?? 0;
          const completed = achState?.completed ?? false;
          const claimed = achState?.claimed ?? false;
          const progressPct = Math.min((progress / ach.target) * 100, 100);
          const isLocked = !completed && progress === 0;

          const cardBg     = claimed   ? 'rgba(0,242,255,0.05)'   : completed ? 'rgba(255,140,0,0.07)'    : 'rgba(255,255,255,0.03)';
          const cardBorder = claimed   ? 'rgba(0,242,255,0.22)'   : completed ? 'rgba(255,140,0,0.45)'    : isLocked ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)';
          const iconBg     = claimed   ? 'rgba(0,242,255,0.12)'   : completed ? 'rgba(255,140,0,0.14)'    : 'rgba(255,255,255,0.06)';
          const iconBorder = claimed   ? '#00F2FF55'              : completed ? '#FF8C0085'               : 'rgba(255,255,255,0.12)';
          const barColor   = completed ? 'linear-gradient(90deg,#FF8C00,#FFD700)' : 'linear-gradient(90deg,#00F2FF40,#00F2FF)';

          return (
            <div
              key={ach.id}
              style={{
                borderRadius: 16,
                background: cardBg,
                border: `1px solid ${cardBorder}`,
                padding: '13px 14px',
                marginBottom: 10,
                opacity: isLocked ? 0.5 : 1,
              }}
            >
              {/* Row 1: Icon + Title + Status */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 7 }}>
                <div style={{
                  width: 46, height: 46, borderRadius: 12, flexShrink: 0,
                  background: iconBg, border: `2px solid ${iconBorder}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                }}>
                  {isLocked ? '🔒' : ach.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <div style={{ fontFamily: 'Orbitron, sans-serif', color: isLocked ? '#FFFFFF40' : '#FFFFFF', fontSize: 11, letterSpacing: '0.05em' }}>
                      {ach.name}
                    </div>
                    {claimed && (
                      <div style={{ flexShrink: 0, fontFamily: 'Orbitron, sans-serif', color: '#00F2FF', fontSize: 8, background: 'rgba(0,242,255,0.1)', border: '1px solid #00F2FF30', padding: '2px 7px', borderRadius: 8, letterSpacing: '0.06em' }}>
                        ✓ DONE
                      </div>
                    )}
                    {isLocked && (
                      <div style={{ flexShrink: 0, fontFamily: 'Inter, sans-serif', color: '#FFFFFF30', fontSize: 9 }}>LOCKED</div>
                    )}
                  </div>
                  <div style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFF55', fontSize: 10, lineHeight: '1.4' }}>
                    {ach.description}
                  </div>
                </div>
              </div>

              {/* Row 2: Progress bar */}
              {!claimed && (
                <div style={{ marginBottom: completed ? 10 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <div style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFF45', fontSize: 10 }}>
                      {formatNum(progress)} / {formatNum(ach.target)}
                    </div>
                    <div style={{ fontFamily: 'Inter, sans-serif', color: completed ? '#FF8C00' : '#00F2FF80', fontSize: 10, fontWeight: 600 }}>
                      {Math.floor(progressPct)}%
                    </div>
                  </div>
                  <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4 }}>
                    <div style={{
                      height: '100%',
                      width: `${progressPct}%`,
                      minWidth: progressPct > 0 ? 4 : 0,
                      background: barColor,
                      borderRadius: 4,
                      boxShadow: completed ? '0 0 8px #FF8C00' : '0 0 4px #00F2FF60',
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>
              )}

              {/* Row 3: Claim button */}
              {completed && !claimed && (
                <button
                  onClick={() => handleClaim(ach.id, ach.reward)}
                  style={{
                    display: 'block', width: '100%', padding: '10px 16px',
                    borderRadius: 11, border: 'none', cursor: 'pointer',
                    background: claimAnim === ach.id ? '#00F2FF' : 'linear-gradient(135deg,#FF8C00,#FFD700)',
                    color: claimAnim === ach.id ? '#0B0E14' : '#000000',
                    fontFamily: 'Orbitron, sans-serif', fontSize: 11, letterSpacing: '0.08em',
                    boxShadow: claimAnim === ach.id ? '0 0 18px #00F2FF60' : '0 0 20px #FF8C0060',
                    lineHeight: '1.4',
                  }}
                >
                  {claimAnim === ach.id ? '✓ CLAIMED!' : `🎁 CLAIM REWARD — +${formatNum(ach.reward)} GOLD`}
                </button>
              )}

              {/* Claimed note */}
              {claimed && (
                <div style={{ fontFamily: 'Inter, sans-serif', color: '#FFD70065', fontSize: 10, marginTop: 4 }}>
                  Reward collected: +{formatNum(ach.reward)} Gold
                </div>
              )}
            </div>
          );
        })}

        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}
