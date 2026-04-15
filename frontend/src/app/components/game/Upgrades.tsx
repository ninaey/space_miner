import React from 'react';
import { motion } from 'motion/react';
import { useGame, UPGRADES_CONFIG, getUpgradeCost } from '../../context/GameContext';

const formatNum = (n: number): string => {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return Math.floor(n).toString();
};

const RESOURCE_ICONS: Record<string, string> = { iron: '🪨', copper: '🟠' };
const RESOURCE_COLORS: Record<string, string> = { iron: '#C0C0C0', copper: '#B87333' };

function useScreenWidth() {
  const [w, setW] = React.useState(() => window.innerWidth);
  React.useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

export function Upgrades() {
  const { state, dispatch, canAfford } = useGame();
  const screenWidth = useScreenWidth();
  const isWide = screenWidth >= 768;

  const droneCount = state.upgrades.droneFactory + 2;
  const passivePerSec = Math.floor(state.passiveRate * (1 + state.upgrades.batteryEfficiency * 0.25) * droneCount);

  const stats = [
    { label: 'Click Power', value: `${Math.floor(state.clickPower)}`, unit: '/tap', color: '#FF8C00' },
    { label: 'Passive Rate', value: formatNum(passivePerSec), unit: '/sec', color: '#00F2FF' },
    { label: 'Active Drones', value: String(droneCount), unit: '', color: '#C0C0C0' },
    { label: 'Storage Max', value: formatNum(state.storageMax), unit: 'kg', color: '#B87333' },
  ];

  return (
    <div
      style={{
        height: '100%',
        background: '#0B0E14',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── Fixed Header ── */}
      <div
        style={{
          padding: '14px 16px 12px',
          borderBottom: '1px solid rgba(0,242,255,0.12)',
          flexShrink: 0,
          background: '#0B0E14',
        }}
      >
        <h2
          style={{
            fontFamily: 'Orbitron, sans-serif',
            color: '#FFFFFF',
            fontSize: 16,
            letterSpacing: '0.1em',
            margin: '0 0 2px',
          }}
        >
          UPGRADE WORKSHOP
        </h2>
        <p
          style={{
            fontFamily: 'Inter, sans-serif',
            color: '#FF8C00',
            fontSize: 11,
            margin: '0 0 12px',
          }}
        >
          Enhance your mining rig with industrial upgrades
        </p>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
          {stats.map(s => (
            <div
              key={s.label}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 10,
                padding: '8px 6px',
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  fontFamily: 'Inter, sans-serif',
                  color: s.color,
                  fontSize: 13,
                  fontWeight: 700,
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                {s.value}
                <span style={{ fontSize: 9, color: s.color + '80' }}>{s.unit}</span>
              </p>
              <p
                style={{
                  fontFamily: 'Inter, sans-serif',
                  color: '#FFFFFF40',
                  fontSize: 8,
                  margin: '3px 0 0',
                }}
              >
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Resources Row ── */}
      <div
        style={{
          padding: '9px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(0,0,0,0.25)',
          flexShrink: 0,
          display: 'flex',
          gap: 10,
        }}
      >
        {[
          { key: 'iron', label: 'Iron', emoji: '🪨', color: '#C0C0C0' },
          { key: 'copper', label: 'Copper', emoji: '🟠', color: '#B87333' },
          { key: 'silver', label: 'Silver', emoji: '⚪', color: '#E8E8FF' },
        ].map(r => (
          <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1 }}>
            <span style={{ fontSize: 15 }}>{r.emoji}</span>
            <div>
              <p
                style={{
                  fontFamily: 'Inter, sans-serif',
                  color: r.color,
                  fontSize: 12,
                  fontWeight: 700,
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                {formatNum(state.resources[r.key as 'iron' | 'copper' | 'silver'])}
              </p>
              <p
                style={{
                  fontFamily: 'Inter, sans-serif',
                  color: '#FFFFFF35',
                  fontSize: 9,
                  margin: 0,
                }}
              >
                {r.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Scrollable Upgrade Cards ── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '12px 14px 16px',
          display: isWide ? 'grid' : 'flex',
          gridTemplateColumns: isWide ? 'repeat(2,1fr)' : undefined,
          flexDirection: isWide ? undefined : 'column',
          gap: 12,
          alignItems: 'start',
        }}
      >
        {UPGRADES_CONFIG.map((upgrade, idx) => {
          const level = state.upgrades[upgrade.id];
          const maxed = level >= upgrade.maxLevel;
          const cost = getUpgradeCost(upgrade, level);
          const affordable = canAfford(upgrade.id);
          const progressPct = (level / upgrade.maxLevel) * 100;

          return (
            <motion.div
              key={upgrade.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.07, duration: 0.35 }}
              style={{
                borderRadius: 16,
                background: maxed
                  ? 'rgba(0,242,255,0.05)'
                  : affordable
                  ? 'rgba(255,140,0,0.05)'
                  : 'rgba(255,255,255,0.03)',
                border: `1px solid ${
                  maxed
                    ? 'rgba(0,242,255,0.25)'
                    : affordable
                    ? 'rgba(255,140,0,0.35)'
                    : 'rgba(255,255,255,0.08)'
                }`,
                padding: '14px',
                boxShadow: maxed
                  ? '0 0 12px rgba(0,242,255,0.06)'
                  : affordable
                  ? '0 0 14px rgba(255,140,0,0.08)'
                  : 'none',
              }}
            >
              {/* Top row: icon + text + level badge */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                {/* Icon */}
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    flexShrink: 0,
                    background: maxed
                      ? 'rgba(0,242,255,0.1)'
                      : affordable
                      ? 'rgba(255,140,0,0.12)'
                      : 'rgba(255,255,255,0.05)',
                    border: `2px solid ${
                      maxed
                        ? '#00F2FF50'
                        : affordable
                        ? '#FF8C0070'
                        : 'rgba(255,255,255,0.09)'
                    }`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                    boxShadow: maxed
                      ? '0 0 14px #00F2FF30'
                      : affordable
                      ? '0 0 14px #FF8C0035'
                      : 'none',
                  }}
                >
                  {upgrade.icon}
                </div>

                {/* Name + description + effect */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 3,
                    }}
                  >
                    <p
                      style={{
                        fontFamily: 'Orbitron, sans-serif',
                        color: '#FFFFFF',
                        fontSize: 12,
                        letterSpacing: '0.05em',
                        margin: 0,
                      }}
                    >
                      {upgrade.name}
                    </p>
                    {/* Level badge */}
                    <div
                      style={{
                        flexShrink: 0,
                        background: 'rgba(255,255,255,0.07)',
                        borderRadius: 6,
                        padding: '2px 8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: 'Orbitron, sans-serif',
                          color: maxed ? '#00F2FF' : '#FFFFFF90',
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        {maxed ? 'MAX' : `Lv.${level}`}
                      </span>
                      {!maxed && (
                        <span
                          style={{
                            fontFamily: 'Inter, sans-serif',
                            color: '#FFFFFF30',
                            fontSize: 9,
                          }}
                        >
                          /{upgrade.maxLevel}
                        </span>
                      )}
                    </div>
                  </div>

                  <p
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      color: '#FFFFFF55',
                      fontSize: 10,
                      margin: '0 0 4px',
                      lineHeight: 1.45,
                    }}
                  >
                    {upgrade.description}
                  </p>
                  <p
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      color: '#FF8C0090',
                      fontSize: 9,
                      margin: 0,
                    }}
                  >
                    ⚡ {upgrade.effect}
                  </p>
                </div>
              </div>

              {/* Level progress bar */}
              <div style={{ marginTop: 12, marginBottom: 12 }}>
                <div
                  style={{
                    height: 5,
                    background: 'rgba(255,255,255,0.07)',
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}
                >
                  <motion.div
                    animate={{ width: `${progressPct}%` }}
                    style={{
                      height: '100%',
                      background: maxed
                        ? 'linear-gradient(90deg,#00F2FF60,#00F2FF)'
                        : 'linear-gradient(90deg,#FF8C0060,#FF8C00)',
                      borderRadius: 3,
                      boxShadow: maxed ? '0 0 5px #00F2FF' : '0 0 5px #FF8C00',
                    }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: 4,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      color: '#FFFFFF30',
                      fontSize: 9,
                    }}
                  >
                    {level} / {upgrade.maxLevel} levels
                  </span>
                  <span
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      color: maxed ? '#00F2FF80' : '#FF8C0080',
                      fontSize: 9,
                    }}
                  >
                    {Math.round(progressPct)}%
                  </span>
                </div>
              </div>

              {/* Action row */}
              {maxed ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '9px',
                    borderRadius: 10,
                    background: 'rgba(0,242,255,0.07)',
                    border: '1px solid #00F2FF30',
                  }}
                >
                  <span style={{ color: '#00F2FF', fontSize: 13 }}>✓</span>
                  <span
                    style={{
                      fontFamily: 'Orbitron, sans-serif',
                      color: '#00F2FF',
                      fontSize: 10,
                      letterSpacing: '0.06em',
                    }}
                  >
                    FULLY UPGRADED
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Upgrade button */}
                  <motion.button
                    onClick={() => dispatch({ type: 'UPGRADE', upgradeId: upgrade.id })}
                    disabled={!affordable}
                    whileHover={affordable ? { scale: 1.04 } : {}}
                    whileTap={affordable ? { scale: 0.96 } : {}}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: 11,
                      border: 'none',
                      cursor: affordable ? 'pointer' : 'not-allowed',
                      background: affordable
                        ? 'linear-gradient(135deg,#FF8C00,#FF6600)'
                        : '#1A1C24',
                      color: affordable ? '#FFFFFF' : '#FF444480',
                      fontFamily: 'Orbitron, sans-serif',
                      fontSize: 11,
                      letterSpacing: '0.08em',
                      boxShadow: affordable ? '0 0 18px #FF8C0055' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 13 }}>{affordable ? '⬆' : '⛔'}</span>
                    UPGRADE
                  </motion.button>

                  {/* Cost badge */}
                  <div
                    style={{
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '8px 10px',
                      borderRadius: 10,
                      background: affordable
                        ? 'rgba(255,140,0,0.08)'
                        : 'rgba(255,68,68,0.07)',
                      border: `1px solid ${
                        affordable ? 'rgba(255,140,0,0.25)' : 'rgba(255,68,68,0.2)'
                      }`,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{RESOURCE_ICONS[upgrade.costResource]}</span>
                    <div>
                      <p
                        style={{
                          fontFamily: 'Inter, sans-serif',
                          color: affordable
                            ? RESOURCE_COLORS[upgrade.costResource]
                            : '#FF4444',
                          fontSize: 13,
                          fontWeight: 700,
                          margin: 0,
                          lineHeight: 1.1,
                        }}
                      >
                        {formatNum(cost)}
                      </p>
                      <p
                        style={{
                          fontFamily: 'Inter, sans-serif',
                          color: '#FFFFFF30',
                          fontSize: 8,
                          margin: 0,
                          textTransform: 'capitalize',
                        }}
                      >
                        {upgrade.costResource}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}

        {/* Tip */}
        <div
          style={{
            borderRadius: 12,
            padding: '11px 14px',
            background: 'rgba(0,242,255,0.03)',
            border: '1px solid rgba(0,242,255,0.1)',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              color: '#FFFFFF40',
              fontSize: 10,
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            💡 Orange glowing buttons are affordable. Red means{' '}
            <span style={{ color: '#FF444470' }}>OFFLINE</span> (insufficient resources).
          </p>
        </div>

        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}