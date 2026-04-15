import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useGame } from '../../context/GameContext';

const formatNum = (n: number): string => {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return Math.floor(n).toString();
};

// ── Toggle switch ────────────────────────────────────────────────
function ToggleSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      onClick={() => onChange(!value)}
      style={{
        width: 48, height: 28, borderRadius: 14, flexShrink: 0, cursor: 'pointer', position: 'relative',
        background: value ? 'linear-gradient(135deg,#00F2FF,#0090B0)' : 'rgba(255,255,255,0.12)',
        border: `1.5px solid ${value ? '#00F2FF60' : 'rgba(255,255,255,0.18)'}`,
        boxShadow: value ? '0 0 10px #00F2FF40' : 'none',
        transition: 'background 0.25s, border 0.25s, box-shadow 0.25s',
      }}
    >
      <div style={{
        position: 'absolute', top: 3, width: 20, height: 20, borderRadius: '50%',
        background: value ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
        boxShadow: value ? '0 1px 4px rgba(0,0,0,0.4)' : 'none',
        left: value ? 23 : 3,
        transition: 'left 0.22s ease, background 0.22s',
      }} />
    </div>
  );
}

// ── Section heading ───────────────────────────────────────────────
function SectionHeading({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px 8px' }}>
      <span style={{ fontSize: 15 }}>{icon}</span>
      <div style={{ fontFamily: 'Orbitron, sans-serif', color, fontSize: 10, letterSpacing: '0.1em' }}>{label}</div>
    </div>
  );
}

// ── Toggle row ────────────────────────────────────────────────────
function ToggleRow({
  title, subtitle, value, onChange, last = false,
}: {
  title: string; subtitle: string; value: boolean; onChange: (v: boolean) => void; last?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 14px',
      borderTop: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ flex: 1, paddingRight: 12 }}>
        <div style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFFCC', fontSize: 13, marginBottom: 3, lineHeight: '1.3' }}>{title}</div>
        <div style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFF50', fontSize: 10, lineHeight: '1.3' }}>{subtitle}</div>
      </div>
      <ToggleSwitch value={value} onChange={onChange} />
    </div>
  );
}

// ── Account list item ─────────────────────────────────────────────
function AccountRow({ icon, label, subtitle, danger = false, last = false }: {
  icon: string; label: string; subtitle: string; danger?: boolean; last?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 14px',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: danger ? 'rgba(235,87,87,0.1)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${danger ? 'rgba(235,87,87,0.28)' : 'rgba(255,255,255,0.1)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
        }}>
          {icon}
        </div>
        <div>
          <div style={{ fontFamily: 'Inter, sans-serif', color: danger ? '#EB5757' : '#FFFFFFCC', fontSize: 13, lineHeight: '1.3', marginBottom: 3 }}>{label}</div>
          <div style={{ fontFamily: 'Inter, sans-serif', color: danger ? '#EB575765' : '#FFFFFF40', fontSize: 10, lineHeight: '1.3' }}>{subtitle}</div>
        </div>
      </div>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={danger ? '#EB575755' : '#FFFFFF25'} strokeWidth="2">
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────
export function Settings() {
  const { state, dispatch } = useGame();
  const navigate = useNavigate();

  const [sound, setSound] = useState(true);
  const [music, setMusic] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [haptics, setHaptics] = useState(true);
  const [showLogout, setShowLogout] = useState(false);

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
    navigate('/');
  };

  const droneCount = state.upgrades.droneFactory + 2;
  const completedCount = Object.values(state.achievements).filter(a => a.completed).length;
  const totalAchs = Object.values(state.achievements).length;

  const stats = [
    { label: 'Depth', value: `${Math.floor(state.depth)}m`, color: '#00F2FF' },
    { label: 'Drones', value: String(droneCount), color: '#FF8C00' },
    { label: 'Awards', value: `${completedCount}/${totalAchs}`, color: '#FFD700' },
    { label: 'Iron', value: formatNum(state.totalMined.iron), color: '#C0C0C0' },
    { label: 'Gold', value: formatNum(state.resources.gold), color: '#FFD700' },
    { label: 'Gems', value: formatNum(state.resources.gems), color: '#00F2FF' },
  ];

  return (
    <div style={{ height: '100%', background: '#0B0E14', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

      {/* ── Fixed Header ── */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid rgba(0,242,255,0.12)', flexShrink: 0, background: '#0B0E14' }}>
        <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#FFFFFF', fontSize: 16, letterSpacing: '0.1em', marginBottom: 3 }}>
          SETTINGS
        </div>
        <div style={{ fontFamily: 'Inter, sans-serif', color: '#00F2FF60', fontSize: 11 }}>
          Commander Configuration Panel
        </div>
      </div>

      {/* ── Scrollable ── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '14px 14px 24px' }}>

        {/* ── Profile Card ── */}
        <div style={{ borderRadius: 18, padding: 16, background: 'linear-gradient(135deg,#0D1B2A,#111820)', border: '1px solid rgba(0,242,255,0.22)', boxShadow: '0 0 22px rgba(0,242,255,0.05)', marginBottom: 12 }}>
          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'linear-gradient(135deg,#1A3A4A,#0A2030)', border: '3px solid #00F2FF70', boxShadow: '0 0 18px #00F2FF35', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0 }}>
              👨‍🚀
            </div>
            <div>
              <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#FFFFFF', fontSize: 15, letterSpacing: '0.07em', marginBottom: 5 }}>
                {state.playerName || 'COMMANDER'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00D26A', boxShadow: '0 0 7px #00D26A' }} />
                <span style={{ fontFamily: 'Inter, sans-serif', color: '#00D26A', fontSize: 10, letterSpacing: '0.06em' }}>SESSION ACTIVE</span>
              </div>
            </div>
          </div>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {stats.map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 11, padding: '9px 6px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Inter, sans-serif', color: s.color, fontSize: 13, fontWeight: 700, lineHeight: '1.2', marginBottom: 3 }}>{s.value}</div>
                <div style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFF35', fontSize: 9, letterSpacing: '0.04em' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Cloud Sync ── */}
        <div style={{ borderRadius: 14, padding: '14px', background: 'rgba(0,210,106,0.06)', border: '1px solid rgba(0,210,106,0.25)', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(0,210,106,0.12)', border: '1px solid rgba(0,210,106,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>☁️</div>
              <div>
                <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#00D26A', fontSize: 11, letterSpacing: '0.07em', marginBottom: 4 }}>CLOUD STATUS</div>
                <div style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFF55', fontSize: 10 }}>Progress synced to colony server</div>
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end', marginBottom: 4 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00D26A', boxShadow: '0 0 6px #00D26A' }} />
                <span style={{ fontFamily: 'Inter, sans-serif', color: '#00D26A', fontSize: 10, fontWeight: 600 }}>ONLINE</span>
              </div>
              <div style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFF30', fontSize: 9 }}>
                {new Date(state.lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Audio Section ── */}
        <div style={{ borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: 12 }}>
          <SectionHeading icon="🔊" label="AUDIO" color="#00F2FF90" />
          <ToggleRow title="Sound Effects" subtitle="Drilling, clicks, and UI sounds" value={sound} onChange={setSound} />
          <ToggleRow title="Background Music" subtitle="Ambient space colony soundtrack" value={music} onChange={setMusic} last />
        </div>

        {/* ── System Section ── */}
        <div style={{ borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: 12 }}>
          <SectionHeading icon="⚙️" label="SYSTEM" color="#FF8C0090" />
          <ToggleRow title="Push Notifications" subtitle="Storage full, milestone alerts" value={notifications} onChange={setNotifications} />
          <ToggleRow title="Haptic Feedback" subtitle="Vibration on mining clicks" value={haptics} onChange={setHaptics} last />
        </div>

        {/* ── Account Section ── */}
        <div style={{ borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: 12 }}>
          <SectionHeading icon="👤" label="ACCOUNT" color="#FFFFFF70" />
          <AccountRow icon="🔒" label="Privacy Policy" subtitle="Data handling and privacy" />
          <AccountRow icon="📋" label="Terms of Service" subtitle="Usage rules and conditions" />
          <AccountRow icon="💬" label="Support & Help" subtitle="Contact our mission control" />
          <AccountRow icon="⚠️" label="Reset Progress" subtitle="Permanently erase all data" danger last />
        </div>

        {/* ── Xsolla branding ── */}
        <div style={{ borderRadius: 14, padding: 14, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: 'linear-gradient(135deg,#FF5C00,#CC3A00)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: 'white', fontFamily: 'Orbitron, sans-serif', fontSize: 12, fontWeight: 700 }}>X</span>
          </div>
          <div>
            <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#FFFFFF45', fontSize: 9, letterSpacing: '0.08em', marginBottom: 2 }}>SPACE COLONY MINER v1.0.0</div>
            <div style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFF28', fontSize: 9 }}>Powered by Xsolla Authentication</div>
          </div>
        </div>

        {/* ── Log Out ── */}
        <button
          onClick={() => setShowLogout(true)}
          style={{
            display: 'block', width: '100%', padding: '14px', borderRadius: 14,
            border: '1px solid rgba(235,87,87,0.3)', background: 'rgba(235,87,87,0.07)',
            color: '#EB5757', fontFamily: 'Orbitron, sans-serif', fontSize: 12,
            letterSpacing: '0.1em', cursor: 'pointer', lineHeight: '1.4',
          }}
        >
          ⎋ LOG OUT
        </button>

        <div style={{ height: 8 }} />
      </div>

      {/* ── Logout Confirmation Overlay ── */}
      {showLogout && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,8,12,0.93)', backdropFilter: 'blur(10px)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: '100%', maxWidth: 320, borderRadius: 22, background: '#0D1018', border: '1px solid rgba(235,87,87,0.35)', padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 44, marginBottom: 14 }}>🚀</div>
            <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#FFFFFF', fontSize: 15, letterSpacing: '0.08em', marginBottom: 10 }}>
              ABANDON MISSION?
            </div>
            <div style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFF65', fontSize: 12, lineHeight: '1.6', marginBottom: 22 }}>
              Your progress is cloud-saved. You can resume your mission any time, Commander.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowLogout(false)}
                style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#FFFFFF80', fontFamily: 'Orbitron, sans-serif', fontSize: 10, letterSpacing: '0.06em', cursor: 'pointer', lineHeight: '1.4' }}
              >
                CANCEL
              </button>
              <button
                onClick={handleLogout}
                style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'linear-gradient(135deg,#EB5757,#C04040)', border: 'none', color: '#FFFFFF', fontFamily: 'Orbitron, sans-serif', fontSize: 10, letterSpacing: '0.06em', cursor: 'pointer', boxShadow: '0 0 18px rgba(235,87,87,0.45)', lineHeight: '1.4' }}
              >
                LOG OUT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
