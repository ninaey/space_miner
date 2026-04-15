import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router';
import { useGame } from '../../context/GameContext';

const formatNum = (n: number): string => {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return Math.floor(n).toString();
};

// ── Responsive hook ───────────────────────────────────────────
function useScreenWidth() {
  const [width, setWidth] = React.useState(() => window.innerWidth);
  React.useEffect(() => {
    const h = () => setWidth(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return width;
}

// ── Nav items ────────────────────────────────────────────────
const NAV_ITEMS = [
  {
    to: '/game/mine', label: 'Mine',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>,
  },
  {
    to: '/game/upgrades', label: 'Upgrades',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>,
  },
  {
    to: '/game/achievements', label: 'Awards',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" /></svg>,
  },
  {
    to: '/game/store', label: 'Store',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" /></svg>,
  },
  {
    to: '/game/settings', label: 'Settings',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>,
  },
];

export function GameLayout() {
  const { state } = useGame();
  const navigate = useNavigate();
  const screenWidth = useScreenWidth();

  const isDesktop = screenWidth >= 1024;
  const isTablet  = screenWidth >= 768 && screenWidth < 1024;

  React.useEffect(() => {
    if (!state.isAuthenticated) navigate('/');
  }, [state.isAuthenticated, navigate]);

  // ── DESKTOP LAYOUT ────────────────────────────────────────
  if (isDesktop) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', background: '#050810', overflow: 'hidden' }}>

        {/* ── Left Sidebar ── */}
        <div style={{
          width: 230, flexShrink: 0,
          background: 'linear-gradient(180deg,#090C14 0%,#0B0E1A 100%)',
          borderRight: '1px solid rgba(0,242,255,0.13)',
          display: 'flex', flexDirection: 'column',
          zIndex: 50,
        }}>
          {/* Logo + Commander */}
          <div style={{ padding: '22px 18px 18px', borderBottom: '1px solid rgba(0,242,255,0.08)' }}>
            <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#FFFFFF90', fontSize: 9, letterSpacing: '0.18em', marginBottom: 2 }}>
              SPACE COLONY
            </div>
            <div style={{
              fontFamily: 'Orbitron, sans-serif', color: '#00F2FF', fontSize: 18,
              letterSpacing: '0.1em', textShadow: '0 0 16px #00F2FF70', marginBottom: 18,
            }}>
              MINER
            </div>
            {/* Commander card */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(0,242,255,0.05)', border: '1px solid rgba(0,242,255,0.12)' }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg,#1A3A4A,#0D2030)',
                border: '2px solid #00F2FF60', boxShadow: '0 0 10px #00F2FF30',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              }}>👨‍🚀</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#FFFFFF', fontSize: 10, letterSpacing: '0.06em', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {state.playerName || 'COMMANDER'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00D26A', boxShadow: '0 0 5px #00D26A', flexShrink: 0 }} />
                  <span style={{ fontFamily: 'Inter, sans-serif', color: '#00D26A', fontSize: 9 }}>ONLINE</span>
                </div>
              </div>
            </div>
          </div>

          {/* Nav links */}
          <nav style={{ flex: 1, paddingTop: 8, paddingBottom: 8 }}>
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 13,
                  padding: '12px 20px',
                  color: isActive ? '#00F2FF' : '#FFFFFF55',
                  background: isActive ? 'rgba(0,242,255,0.08)' : 'transparent',
                  borderLeft: isActive ? '3px solid #00F2FF' : '3px solid transparent',
                  boxShadow: isActive ? 'inset 0 0 20px rgba(0,242,255,0.04)' : 'none',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                })}
              >
                {({ isActive }) => (
                  <>
                    <span style={{ color: isActive ? '#00F2FF' : '#FFFFFF40', filter: isActive ? 'drop-shadow(0 0 5px #00F2FF)' : 'none', flexShrink: 0 }}>
                      {item.icon}
                    </span>
                    <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, letterSpacing: '0.08em' }}>
                      {item.label.toUpperCase()}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Currency panel */}
          <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(0,242,255,0.08)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.16)' }}>
              <span style={{ fontSize: 18 }}>💰</span>
              <div>
                <div style={{ fontFamily: 'Inter, sans-serif', color: '#FFD700', fontSize: 15, fontWeight: 700, lineHeight: '1.1' }}>{formatNum(state.resources.gold)}</div>
                <div style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFF30', fontSize: 9 }}>Gold</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: 'rgba(0,242,255,0.06)', border: '1px solid rgba(0,242,255,0.16)' }}>
              <span style={{ fontSize: 18 }}>💎</span>
              <div>
                <div style={{ fontFamily: 'Inter, sans-serif', color: '#00F2FF', fontSize: 15, fontWeight: 700, lineHeight: '1.1' }}>{formatNum(state.resources.gems)}</div>
                <div style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFF30', fontSize: 9 }}>Gems</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Main Content Area ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0B0E14' }}>
          {/* Desktop resource HUD strip */}
          <div style={{
            padding: '10px 28px',
            borderBottom: '1px solid rgba(0,242,255,0.10)',
            background: 'rgba(9,12,20,0.96)',
            backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexShrink: 0, zIndex: 40,
          }}>
            <div style={{ display: 'flex', gap: 22 }}>
              {[
                { emoji: '🪨', key: 'iron',     label: 'Iron',     color: '#C0C0C0' },
                { emoji: '🟠', key: 'copper',   label: 'Copper',   color: '#B87333' },
                { emoji: '⚪', key: 'silver',   label: 'Silver',   color: '#E8E8FF' },
                { emoji: '💎', key: 'diamonds', label: 'Diamonds', color: '#00F2FF' },
              ].map(r => (
                <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 16 }}>{r.emoji}</span>
                  <div>
                    <div style={{ fontFamily: 'Inter, sans-serif', color: r.color, fontSize: 14, fontWeight: 700, lineHeight: '1.1' }}>
                      {formatNum(state.resources[r.key as keyof typeof state.resources])}
                    </div>
                    <div style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFF30', fontSize: 9 }}>{r.label}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#FFFFFF40', fontSize: 9, letterSpacing: '0.06em' }}>DEPTH</div>
                <div style={{ fontFamily: 'Inter, sans-serif', color: '#00F2FF', fontSize: 14, fontWeight: 700 }}>{Math.floor(state.depth)}m</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#FFFFFF40', fontSize: 9, letterSpacing: '0.06em' }}>STORAGE</div>
                <div style={{ fontFamily: 'Inter, sans-serif', color: '#FF8C00', fontSize: 14, fontWeight: 700 }}>
                  {Math.round((state.storageUsed / state.storageMax) * 100)}%
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#FFFFFF40', fontSize: 9, letterSpacing: '0.06em' }}>DRONES</div>
                <div style={{ fontFamily: 'Inter, sans-serif', color: '#C0C0C0', fontSize: 14, fontWeight: 700 }}>
                  {state.upgrades.droneFactory + 2}
                </div>
              </div>
            </div>
          </div>

          {/* Screen content */}
          <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
            <Outlet />
          </div>
        </div>
      </div>
    );
  }

  // ── TABLET / MOBILE LAYOUT ────────────────────────────────
  const maxW = isTablet ? 800 : 430;

  return (
    <div style={{
      height: '100vh', background: '#0B0E14',
      maxWidth: maxW, margin: '0 auto',
      display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* HUD Top Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isTablet ? '10px 20px' : '8px 16px',
        background: 'rgba(11,14,20,0.95)',
        borderBottom: '1px solid rgba(0,242,255,0.15)',
        backdropFilter: 'blur(10px)',
        zIndex: 50, flexShrink: 0, minHeight: isTablet ? 60 : 54,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: isTablet ? 40 : 36, height: isTablet ? 40 : 36, borderRadius: '50%',
            background: 'linear-gradient(135deg,#1A2A3A,#0D1B2A)',
            border: '2px solid #00F2FF60', boxShadow: '0 0 8px #00F2FF40',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            fontSize: isTablet ? 18 : 16,
          }}>👨‍🚀</div>
          <div>
            <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#FFFFFF', fontSize: isTablet ? 12 : 11, letterSpacing: '0.05em', lineHeight: '1.2' }}>
              {state.playerName || 'COMMANDER'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00D26A', boxShadow: '0 0 4px #00D26A' }} />
              <span style={{ fontFamily: 'Inter, sans-serif', color: '#00D26A80', fontSize: 9 }}>SYNCED</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 9, background: 'rgba(255,140,0,0.1)', border: '1px solid rgba(255,140,0,0.25)' }}>
            <span style={{ fontSize: 13 }}>💰</span>
            <span style={{ fontFamily: 'Inter, sans-serif', color: '#FFD700', fontSize: isTablet ? 13 : 12 }}>{formatNum(state.resources.gold)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 9, background: 'rgba(0,242,255,0.08)', border: '1px solid rgba(0,242,255,0.2)' }}>
            <span style={{ fontSize: 13 }}>💎</span>
            <span style={{ fontFamily: 'Inter, sans-serif', color: '#00F2FF', fontSize: isTablet ? 13 : 12 }}>{formatNum(state.resources.gems)}</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
        <Outlet />
      </div>

      {/* Bottom Navigation */}
      <div style={{
        background: 'rgba(11,14,20,0.98)',
        borderTop: '1px solid rgba(0,242,255,0.15)',
        backdropFilter: 'blur(10px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        zIndex: 50, flexShrink: 0,
      }}>
        <div style={{ display: 'flex' }}>
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              style={({ isActive }) => ({
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', padding: isTablet ? '10px 4px' : '8px 4px', gap: 3,
                color: isActive ? '#00F2FF' : '#FFFFFF40',
                background: isActive ? 'rgba(0,242,255,0.06)' : 'transparent',
                borderTop: isActive ? '2px solid #00F2FF' : '2px solid transparent',
                fontFamily: 'Inter, sans-serif', textDecoration: 'none',
                transition: 'all 0.2s',
              })}
            >
              {({ isActive }) => (
                <>
                  <span style={{ color: isActive ? '#00F2FF' : '#FFFFFF40', filter: isActive ? 'drop-shadow(0 0 4px #00F2FF)' : 'none' }}>
                    {item.icon}
                  </span>
                  <span style={{ fontSize: isTablet ? 10 : 8, letterSpacing: '0.06em', color: isActive ? '#00F2FF' : '#FFFFFF30', fontFamily: 'Orbitron, sans-serif' }}>
                    {item.label.toUpperCase()}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}
