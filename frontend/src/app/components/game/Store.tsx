import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGame, STORE_ITEMS as FALLBACK_STORE, GEM_ITEMS as FALLBACK_GEM } from '../../context/GameContext';
import { fetchStoreCatalog, buyGemItem, createPayment, type CatalogItem } from '../../lib/backendApi';
import { getBackendSession } from '../../context/GameContext';

const formatNum = (n: number): string => {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return Math.floor(n).toString();
};

const TABS = ['FEATURED', 'EQUIPMENT', 'GEM SHOP', 'GEM PACKS'];

function BoostTimer({ endsAt }: { endsAt: number }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
  useEffect(() => {
    const t = setInterval(() => setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))), 500);
    return () => clearInterval(t);
  }, [endsAt]);
  if (remaining <= 0) return <span style={{ color: '#FFFFFF40' }}>EXPIRED</span>;
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return <span style={{ color: '#00F2FF', fontFamily: 'Inter, sans-serif' }}>{m > 0 ? `${m}m ` : ''}{s}s</span>;
}

const CATEGORY_STYLE: Record<string, { bg: string; border: string; color: string; label: string }> = {
  boost:     { bg: 'rgba(255,140,0,0.12)',   border: 'rgba(255,140,0,0.35)',   color: '#FF8C00', label: 'BOOST'     },
  cosmetic:  { bg: 'rgba(155,89,182,0.12)',  border: 'rgba(155,89,182,0.35)', color: '#9B59B6', label: 'COSMETIC'  },
};

const ICON_MAP: Record<string, string> = {
  super_drill: '🔩', inventory_expander: '📦',
  gem_pack_s: '💎', gem_pack_m: '💎', gem_pack_l: '💎',
  turbo_drill_boost: '⚡', depth_dive: '🌀', drone_overclock: '🚀',
  mega_mine_burst: '💥', auto_sell_module: '🤖', storage_purge: '💰',
  neon_commander_frame: '🎖️', vip: '⭐',
};

function itemIcon(item: CatalogItem): string {
  return ICON_MAP[item.sku] || '📦';
}

// DB categories → UI categories (DB uses granular names like 'drill', 'storage')
const CATEGORY_MAP: Record<string, string> = {
  drill: 'equipment', storage: 'equipment',
  booster: 'boost', gems: 'gems', cosmetic: 'cosmetic',
};
function normalizeCategory(raw: string): string {
  return CATEGORY_MAP[raw] || raw;
}

// Fallback descriptions keyed by SKU (DB store_catalog has no description column)
const DESCRIPTION_MAP: Record<string, string> = {
  super_drill: 'Increases mining speed by 3x forever.',
  inventory_expander: 'Double your mineral storage capacity.',
  gem_pack_s: '100 Gems for your colony.',
  gem_pack_m: '500 Gems + 50 bonus gems!',
  gem_pack_l: '1,200 Gems + 300 bonus. Best Value!',
  turbo_drill_boost: 'Triples click power for the next 100 manual taps.',
  depth_dive: 'Skip ahead +250m instantly.',
  drone_overclock: 'All drones mine at 4x speed for 60 seconds.',
  mega_mine_burst: 'Mine 500x your click power in one explosion.',
  auto_sell_module: 'Auto-sells minerals every 30s for 5 minutes.',
  storage_purge: 'Sell everything at 2x market value instantly.',
  neon_commander_frame: 'Exclusive Neon Commander avatar frame.',
};

export function Store() {
  const { state, dispatch } = useGame();
  const [activeTab, setActiveTab] = useState('FEATURED');
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [justBought, setJustBought] = useState<string | null>(null);
  const [gemActivated, setGemActivated] = useState<string | null>(null);
  const [flashMsg, setFlashMsg] = useState<{ text: string; color: string } | null>(null);

  const [catalogSource, setCatalogSource] = useState<string>('local');
  const [realItems, setRealItems] = useState<CatalogItem[]>([]);
  const [gemItems, setGemItems] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  // Fetch catalog from backend (which tries Xsolla first, then DB fallback)
  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);

    fetchStoreCatalog()
      .then((res) => {
        if (cancelled) return;
        setCatalogSource(res.source);

        if (res.source === 'xsolla') {
          const normalized = res.items.map((i: CatalogItem) => ({
            ...i,
            category: normalizeCategory(i.category),
            description: i.description || DESCRIPTION_MAP[i.sku] || '',
          }));
          setRealItems(normalized.filter((i: CatalogItem) => i.currency === 'real'));
          setGemItems(normalized.filter((i: CatalogItem) => i.currency === 'gem'));
        } else {
          const mapped: CatalogItem[] = (res.items as any[]).map((i: any) => ({
            sku: i.sku,
            name: i.name,
            description: DESCRIPTION_MAP[i.sku] || '',
            category: normalizeCategory(i.category),
            currency: i.currency_type,
            price: i.base_price,
            price_str: i.currency_type === 'real' ? `$${Number(i.base_price).toFixed(2)}` : `${Math.floor(i.base_price)} Gems`,
            gems_granted: i.gems_granted || 0,
            featured: i.featured,
            one_time: i.one_time_purchase,
            effect_type: i.effect_type || undefined,
            effect_value: i.effect_value || undefined,
            effect_duration: i.effect_duration_sec || undefined,
          }));
          setRealItems(mapped.filter(i => i.currency === 'real'));
          setGemItems(mapped.filter(i => i.currency === 'gem'));
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Catalog fetch failed, using local fallback:', err);
        setCatalogSource('local');
      })
      .finally(() => { if (!cancelled) setCatalogLoading(false); });

    return () => { cancelled = true; };
  }, []);

  // When catalog source is local (fallback hardcoded), map the existing arrays
  const effectiveRealItems: CatalogItem[] = catalogSource === 'local'
    ? FALLBACK_STORE.map(i => ({
        sku: i.id, name: i.name, description: i.description,
        category: i.category, currency: 'real', price: i.price,
        price_str: `$${i.price.toFixed(2)}`,
        gems_granted: (i as any).gems || 0, featured: i.featured,
        one_time: false,
        effect_type: undefined, effect_value: undefined, effect_duration: undefined,
      }))
    : realItems;

  const effectiveGemItems: CatalogItem[] = catalogSource === 'local'
    ? FALLBACK_GEM.map(i => ({
        sku: i.id, name: i.name, description: i.description,
        category: i.category, currency: 'gem', price: i.gemCost,
        price_str: `${i.gemCost} Gems`,
        gems_granted: 0, featured: false,
        one_time: i.oneTime || false,
        effect_type: i.effect, effect_value: i.effectValue,
        effect_duration: i.effectDuration,
      }))
    : gemItems;

  // ── PayStation widget loader ──
  const paystationLoadedRef = useRef(false);

  const ensurePayStationSDK = useCallback((): Promise<void> => {
    if ((window as any).XPayStationWidget) return Promise.resolve();
    if (paystationLoadedRef.current) {
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if ((window as any).XPayStationWidget) { clearInterval(check); resolve(); }
        }, 100);
        setTimeout(() => { clearInterval(check); resolve(); }, 5000);
      });
    }
    paystationLoadedRef.current = true;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.xsolla.net/embed/paystation/1.2.7/widget.min.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load PayStation SDK'));
      document.head.appendChild(script);
    });
  }, []);

  const openPayStationInNewTab = useCallback((token: string) => {
    const paystationUrl = `https://sandbox-secure.xsolla.com/paystation4/?token=${encodeURIComponent(token)}`;
    const popup = window.open(paystationUrl, '_blank', 'noopener,noreferrer');
    if (!popup) {
      window.location.href = paystationUrl;
    }
  }, []);

  // ── USD item purchase via Xsolla PayStation ──
  const handlePurchase = async (item: CatalogItem) => {
    if (purchasing) return;
    const session = getBackendSession();
    if (!session?.token) {
      setFlashMsg({ text: 'Please log in to make purchases.', color: '#FF4444' });
      setTimeout(() => setFlashMsg(null), 2500);
      return;
    }

    setPurchasing(item.sku);

    try {
      const { token } = await createPayment(session.token, item.sku);
      try {
        await ensurePayStationSDK();

        const XPayStationWidget = (window as any).XPayStationWidget;
        if (!XPayStationWidget) throw new Error('PayStation SDK not available');

        XPayStationWidget.init({
          access_token: token,
          sandbox: true,
          lightbox: {
            width: '740px',
            height: '760px',
            spinner: 'round',
            spinnerColor: '#00F2FF',
          },
        });

        const handleStatus = ((_event: any, data: any) => {
          if (data?.paymentInfo?.status === 'done' || data?.status === 'done') {
            dispatch({ type: 'PURCHASE', itemId: item.sku, gems: item.gems_granted || undefined });
            setJustBought(item.sku);
            setFlashMsg({ text: `${item.name} purchased!`, color: '#00F2FF' });
            setTimeout(() => { setJustBought(null); setFlashMsg(null); }, 3000);
          }
        });

        const handleClose = () => {
          setPurchasing(null);
          try {
            XPayStationWidget.off(XPayStationWidget.eventTypes.STATUS, handleStatus);
            XPayStationWidget.off(XPayStationWidget.eventTypes.CLOSE, handleClose);
          } catch { /* widget may already be cleaned up */ }
        };

        XPayStationWidget.on(XPayStationWidget.eventTypes.STATUS, handleStatus);
        XPayStationWidget.on(XPayStationWidget.eventTypes.CLOSE, handleClose);
        XPayStationWidget.open();
      } catch (embedErr) {
        console.warn('PayStation embed unavailable, opening in new tab:', embedErr);
        openPayStationInNewTab(token);
        setPurchasing(null);
        setFlashMsg({ text: 'Payment opened in new tab.', color: '#00F2FF' });
        setTimeout(() => setFlashMsg(null), 3000);
      }
    } catch (err: any) {
      console.error('PayStation error:', err);
      setPurchasing(null);
      setFlashMsg({
        text: err?.message?.includes('not configured')
          ? 'PayStation not configured yet. Add API key to backend.'
          : `Payment failed: ${err?.message || 'Unknown error'}`,
        color: '#FF4444',
      });
      setTimeout(() => setFlashMsg(null), 4000);
    }
  };

  // ── Gem item purchase — calls backend API
  const handleGemBuy = async (item: CatalogItem) => {
    if (state.resources.gems < item.price) {
      setFlashMsg({ text: 'Not enough Gems! Buy a Gem Pack first.', color: '#FF4444' });
      setTimeout(() => setFlashMsg(null), 2500);
      return;
    }
    if (item.one_time && state.gemPurchases?.includes(item.sku)) {
      setFlashMsg({ text: 'Already unlocked!', color: '#00F2FF' });
      setTimeout(() => setFlashMsg(null), 2000);
      return;
    }

    setGemActivated(item.sku);

    const session = getBackendSession();
    if (session?.token) {
      try {
        await buyGemItem(session.token, item.sku);
      } catch (err) {
        console.error('Backend gem purchase failed:', err);
      }
    }

    dispatch({
      type: 'SPEND_GEMS',
      itemId: item.sku,
      gemCost: item.price,
      effect: item.effect_type || '',
      effectValue: item.effect_value,
      effectDuration: item.effect_duration,
    });
    setGemActivated(null);
    setFlashMsg({ text: `${item.name} activated!`, color: '#00F2FF' });
    setTimeout(() => setFlashMsg(null), 2500);
  };

  const getItems = (): CatalogItem[] => {
    if (activeTab === 'EQUIPMENT')  return effectiveRealItems.filter(i => i.category === 'equipment');
    if (activeTab === 'GEM PACKS')  return effectiveRealItems.filter(i => i.category === 'gems');
    return effectiveRealItems.filter(i => i.category !== 'subscription');
  };

  const featuredItems  = effectiveRealItems.filter(i => i.featured);
  const activeBoosts   = (state.activeBoosts || []).filter(b => b.endsAt > Date.now());
  const isGemTab       = activeTab === 'GEM SHOP';

  return (
    <div style={{ height: '100%', background: '#0B0E14', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Fixed Header ── */}
      <div style={{ padding: '12px 16px 10px', background: '#0D1420', borderBottom: '1px solid rgba(0,242,255,0.12)', flexShrink: 0 }}>
        {/* Xsolla badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(0,242,255,0.1)', border: '1px solid #00F2FF40', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9 }}>🔒</div>
          <div style={{ fontFamily: 'Inter, sans-serif', color: '#00F2FF70', fontSize: 9, letterSpacing: '0.07em' }}>
            COLONY REVENUE & SUPPLIES — {catalogLoading ? 'LOADING...' : `SOURCE: ${catalogSource.toUpperCase()}`} — SECURED BY XSOLLA
          </div>
        </div>

        {/* Title + balances */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#FFFFFF', fontSize: 15, letterSpacing: '0.08em' }}>
            SUPPLY DEPOT
          </div>
          <div style={{ display: 'flex', gap: 7 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 8, background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.22)' }}>
              <span style={{ fontSize: 12 }}>💰</span>
              <span style={{ fontFamily: 'Inter, sans-serif', color: '#FFD700', fontSize: 12, fontWeight: 600 }}>{formatNum(state.resources.gold)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 8, background: 'rgba(0,242,255,0.08)', border: '1px solid rgba(0,242,255,0.22)' }}>
              <span style={{ fontSize: 12 }}>💎</span>
              <span style={{ fontFamily: 'Inter, sans-serif', color: '#00F2FF', fontSize: 12, fontWeight: 600 }}>{formatNum(state.resources.gems)}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          {TABS.map(tab => {
            const isGem = tab === 'GEM SHOP';
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flexShrink: 0, padding: '5px 12px', borderRadius: 20,
                  border: `1px solid ${isActive ? (isGem ? '#00F2FF' : '#00F2FF') : isGem ? 'rgba(0,242,255,0.3)' : 'rgba(0,242,255,0.15)'}`,
                  background: isActive ? (isGem ? 'rgba(0,242,255,0.15)' : 'rgba(0,242,255,0.12)') : isGem ? 'rgba(0,242,255,0.05)' : 'transparent',
                  color: isActive ? '#00F2FF' : isGem ? '#00F2FFAA' : '#FFFFFF55',
                  fontFamily: 'Orbitron, sans-serif', fontSize: 8, letterSpacing: '0.06em',
                  cursor: 'pointer',
                  boxShadow: isActive ? '0 0 8px #00F2FF30' : 'none',
                  lineHeight: '1.4',
                  position: 'relative',
                }}
              >
                {isGem && <span style={{ marginRight: 3 }}>💎</span>}
                {tab}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Flash message ── */}
      <AnimatePresence>
        {flashMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{
              margin: '8px 14px 0', padding: '9px 14px', borderRadius: 10,
              background: flashMsg.color === '#00F2FF' ? 'rgba(0,242,255,0.1)' : 'rgba(255,68,68,0.1)',
              border: `1px solid ${flashMsg.color}40`,
              fontFamily: 'Orbitron, sans-serif', color: flashMsg.color, fontSize: 10,
              letterSpacing: '0.06em', textAlign: 'center', flexShrink: 0,
            }}
          >
            {flashMsg.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Scrollable Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 14px 20px' }}>

        {/* ════════════════════════════════════════════════════
            GEM SHOP TAB
        ════════════════════════════════════════════════════ */}
        {isGemTab && (
          <>
            {/* Gem balance callout */}
            <div style={{ borderRadius: 16, padding: '14px 16px', background: 'linear-gradient(135deg,#0A1828,#071220)', border: '1px solid rgba(0,242,255,0.25)', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#00F2FF', fontSize: 10, letterSpacing: '0.1em', marginBottom: 4 }}>YOUR GEM BALANCE</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 28 }}>💎</span>
                    <span style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFF', fontSize: 28, fontWeight: 700 }}>{formatNum(state.resources.gems)}</span>
                    <span style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFF40', fontSize: 11 }}>gems</span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('GEM PACKS')}
                  style={{ padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#00F2FF,#00C8D8)', color: '#0B0E14', fontFamily: 'Orbitron, sans-serif', fontSize: 9, letterSpacing: '0.06em', boxShadow: '0 0 14px #00F2FF50', lineHeight: '1.4' }}
                >
                  + TOP UP
                </button>
              </div>
              <div style={{ marginTop: 10, fontFamily: 'Inter, sans-serif', color: '#FFFFFF45', fontSize: 10, lineHeight: '1.5' }}>
                Gems are the premium currency. Spend them on instant boosts, special abilities, and exclusive cosmetics below.
              </div>
            </div>

            {/* Active boosts panel */}
            {activeBoosts.length > 0 && (
              <div style={{ borderRadius: 14, padding: '12px 14px', background: 'rgba(0,242,255,0.04)', border: '1px solid rgba(0,242,255,0.18)', marginBottom: 14 }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#00F2FF', fontSize: 9, letterSpacing: '0.1em', marginBottom: 10 }}>⚡ ACTIVE BOOSTS</div>
                {activeBoosts.map(boost => {
                  const def = effectiveGemItems.find(g => g.sku === boost.id);
                  if (!def) return null;
                  return (
                    <div key={boost.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{def.image_url ? '' : itemIcon(def)}</span>
                        <span style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFF80', fontSize: 10 }}>{def.name}</span>
                      </div>
                      <div style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, letterSpacing: '0.04em' }}>
                        <BoostTimer endsAt={boost.endsAt} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Gem item cards */}
            {effectiveGemItems.map(item => {
              const canAffordGem = state.resources.gems >= item.price;
              const isOwned = item.one_time && state.gemPurchases?.includes(item.sku);
              const isActivating = gemActivated === item.sku;
              const isActive = activeBoosts.some(b => b.id === item.sku);
              const cat = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE.boost;

              return (
                <div
                  key={item.sku}
                  style={{
                    borderRadius: 16,
                    background: isOwned ? 'rgba(0,242,255,0.04)' : isActive ? 'rgba(255,140,0,0.05)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isOwned ? 'rgba(0,242,255,0.2)' : isActive ? 'rgba(255,140,0,0.25)' : 'rgba(255,255,255,0.08)'}`,
                    padding: '14px',
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{
                      width: 54, height: 54, borderRadius: 14, flexShrink: 0,
                      background: `radial-gradient(circle at 35% 35%,${cat.bg},rgba(0,0,0,0.3))`,
                      border: `2px solid ${cat.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
                      boxShadow: `0 0 12px ${cat.border}`,
                    }}>
                      {item.image_url
                        ? <img src={item.image_url} alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} />
                        : itemIcon(item)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#FFFFFF', fontSize: 11, letterSpacing: '0.04em' }}>
                          {item.name}
                        </div>
                        <div style={{ padding: '2px 7px', borderRadius: 6, background: cat.bg, border: `1px solid ${cat.border}` }}>
                          <span style={{ fontFamily: 'Orbitron, sans-serif', color: cat.color, fontSize: 7, letterSpacing: '0.06em' }}>{cat.label}</span>
                        </div>
                      </div>
                      <div style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFF55', fontSize: 10, lineHeight: '1.5' }}>
                        {item.description}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {item.effect_value ? (
                      <div style={{ padding: '3px 9px', borderRadius: 8, background: 'rgba(255,140,0,0.1)', border: '1px solid rgba(255,140,0,0.25)' }}>
                        <span style={{ fontFamily: 'Inter, sans-serif', color: '#FF8C00', fontSize: 10 }}>x{item.effect_value} effect</span>
                      </div>
                    ) : null}
                    {item.effect_duration ? (
                      <div style={{ padding: '3px 9px', borderRadius: 8, background: 'rgba(0,242,255,0.08)', border: '1px solid rgba(0,242,255,0.2)' }}>
                        <span style={{ fontFamily: 'Inter, sans-serif', color: '#00F2FF', fontSize: 10 }}>
                          {item.effect_duration >= 60 ? `${item.effect_duration / 60}m` : `${item.effect_duration}s`} duration
                        </span>
                      </div>
                    ) : null}
                    {item.one_time && (
                      <div style={{ padding: '3px 9px', borderRadius: 8, background: 'rgba(155,89,182,0.1)', border: '1px solid rgba(155,89,182,0.25)' }}>
                        <span style={{ fontFamily: 'Inter, sans-serif', color: '#9B59B6', fontSize: 10 }}>permanent</span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '7px 12px', borderRadius: 10, flexShrink: 0,
                      background: canAffordGem ? 'rgba(0,242,255,0.08)' : 'rgba(255,68,68,0.08)',
                      border: `1px solid ${canAffordGem ? 'rgba(0,242,255,0.3)' : 'rgba(255,68,68,0.3)'}`,
                    }}>
                      <span style={{ fontSize: 14 }}>💎</span>
                      <span style={{ fontFamily: 'Inter, sans-serif', color: canAffordGem ? '#00F2FF' : '#FF6666', fontSize: 15, fontWeight: 700 }}>
                        {item.price}
                      </span>
                    </div>

                    {isOwned ? (
                      <div style={{ flex: 1, padding: '10px', borderRadius: 11, background: 'rgba(0,242,255,0.08)', border: '1px solid #00F2FF30', textAlign: 'center' }}>
                        <span style={{ fontFamily: 'Orbitron, sans-serif', color: '#00F2FF80', fontSize: 10, letterSpacing: '0.06em' }}>UNLOCKED</span>
                      </div>
                    ) : isActive ? (
                      <div style={{ flex: 1, padding: '10px', borderRadius: 11, background: 'rgba(255,140,0,0.1)', border: '1px solid rgba(255,140,0,0.3)', textAlign: 'center' }}>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#FF8C00', fontSize: 10, letterSpacing: '0.06em' }}>ACTIVE</div>
                        <div style={{ marginTop: 2 }}><BoostTimer endsAt={activeBoosts.find(b => b.id === item.sku)!.endsAt} /></div>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleGemBuy(item)}
                        disabled={!!isActivating}
                        style={{
                          flex: 1, padding: '10px 16px', borderRadius: 11, border: 'none', cursor: 'pointer',
                          background: isActivating
                            ? 'rgba(0,242,255,0.2)'
                            : canAffordGem
                            ? 'linear-gradient(135deg,#00F2FF,#00B8CC)'
                            : 'rgba(255,255,255,0.06)',
                          color: canAffordGem ? '#0B0E14' : '#FFFFFF30',
                          fontFamily: 'Orbitron, sans-serif', fontSize: 11, letterSpacing: '0.07em',
                          boxShadow: canAffordGem && !isActivating ? '0 0 18px #00F2FF40' : 'none',
                          lineHeight: '1.4',
                          transition: 'all 0.2s',
                        }}
                      >
                        {isActivating ? 'ACTIVATING...' : canAffordGem ? 'ACTIVATE' : 'NEED MORE GEMS'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ════════════════════════════════════════════════════
            ALL OTHER TABS (FEATURED / EQUIPMENT / GEM PACKS / PASSES)
        ════════════════════════════════════════════════════ */}
        {!isGemTab && (
          <>
            {/* Featured quick-buy banner */}
            {activeTab === 'FEATURED' && (
              <div style={{ borderRadius: 16, padding: 14, background: 'linear-gradient(135deg,#0D1B2A,#142030)', border: '1px solid rgba(0,242,255,0.22)', marginBottom: 12 }}>
                <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#00F2FF', fontSize: 10, letterSpacing: '0.12em', marginBottom: 12 }}>
                  ⭐ FEATURED DEALS
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {featuredItems.map(item => {
                    // Gem packs are consumable — they can be bought multiple times
                    const owned = item.category !== 'gems' && state.purchases.includes(item.sku);
                    return (
                      <div key={item.sku} style={{ flex: 1, background: 'rgba(255,140,0,0.06)', border: '1px solid rgba(255,140,0,0.2)', borderRadius: 14, padding: '12px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: 32, marginBottom: 6 }}>
                          {item.image_url
                            ? <img src={item.image_url} alt="" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                            : itemIcon(item)}
                        </div>
                        <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#FFFFFF', fontSize: 10, letterSpacing: '0.04em', lineHeight: '1.3', marginBottom: 5 }}>{item.name}</div>
                        <div style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFF55', fontSize: 9, lineHeight: '1.4', marginBottom: 10 }}>{item.description}</div>
                        <button
                          onClick={() => !owned && handlePurchase(item)}
                          style={{
                            display: 'block', width: '100%', padding: '8px 6px', borderRadius: 9, border: 'none',
                            cursor: owned ? 'default' : 'pointer',
                            background: owned ? 'rgba(0,242,255,0.1)' : 'linear-gradient(135deg,#22C55E,#16A34A)',
                            color: owned ? '#00F2FF80' : '#FFFFFF',
                            fontFamily: 'Orbitron, sans-serif', fontSize: 11, letterSpacing: '0.06em',
                            boxShadow: owned ? 'none' : '0 0 14px rgba(34,197,94,0.35)', lineHeight: '1.4',
                          }}
                        >
                          {owned ? 'OWNED' : item.price_str}
                        </button>
                      </div>
                    );
                  })}
                </div>
                {/* GEM SHOP call-to-action */}
                <button
                  onClick={() => setActiveTab('GEM SHOP')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginTop: 12, padding: '10px', borderRadius: 12, border: '1px solid rgba(0,242,255,0.25)', background: 'rgba(0,242,255,0.06)', cursor: 'pointer', lineHeight: '1.4' }}
                >
                  <span style={{ fontSize: 16 }}>💎</span>
                  <span style={{ fontFamily: 'Orbitron, sans-serif', color: '#00F2FF', fontSize: 9, letterSpacing: '0.08em' }}>SPEND YOUR GEMS → BOOSTS & COSMETICS</span>
                </button>
              </div>
            )}

            {/* Full item cards */}
            {getItems().map(item => {
              // Gem packs are consumable — they can be bought multiple times
              const owned = item.category !== 'gems' && state.purchases.includes(item.sku);
              const isProcessing = purchasing === item.sku;
              const didBuy = justBought === item.sku;
              const isBestValue = item.sku === 'gem_pack_l';

              const iconBg = item.category === 'gems'
                ? 'radial-gradient(circle at 35% 35%,#1A3A4A,#0A1A28)'
                : item.category === 'subscription'
                ? 'radial-gradient(circle at 35% 35%,#2A1A00,#1A1000)'
                : 'radial-gradient(circle at 35% 35%,#1A2A3A,#0A1520)';
              const iconBorder = item.category === 'gems' ? '2px solid #00F2FF40' : item.category === 'subscription' ? '2px solid rgba(255,215,0,0.5)' : '2px solid rgba(255,140,0,0.4)';
              const cardBorder = isBestValue ? 'rgba(255,215,0,0.35)' : item.category === 'gems' ? 'rgba(0,242,255,0.18)' : item.category === 'subscription' ? 'rgba(255,215,0,0.28)' : 'rgba(255,255,255,0.09)';
              const btnBg = item.category === 'subscription' ? 'linear-gradient(135deg,#FFD700,#FF8C00)' : 'linear-gradient(135deg,#22C55E,#16A34A)';

              return (
                <div
                  key={item.sku}
                  style={{ borderRadius: 16, background: isBestValue ? 'rgba(255,215,0,0.04)' : 'rgba(255,255,255,0.03)', border: `1px solid ${cardBorder}`, padding: '14px', marginBottom: 10 }}
                >
                  {isBestValue && (
                    <div style={{ textAlign: 'right', marginBottom: 8 }}>
                      <span style={{ display: 'inline-block', background: 'linear-gradient(135deg,#FFD700,#FF8C00)', borderRadius: 8, padding: '2px 10px', fontFamily: 'Orbitron, sans-serif', color: '#000', fontSize: 8, fontWeight: 700 }}>
                        BEST VALUE
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 14, flexShrink: 0, background: iconBg, border: iconBorder, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
                      {item.image_url
                        ? <img src={item.image_url} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                        : itemIcon(item)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#FFFFFF', fontSize: 12, letterSpacing: '0.05em', marginBottom: 4 }}>{item.name}</div>
                      <div style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFF55', fontSize: 10, lineHeight: '1.45' }}>{item.description}</div>
                    </div>
                  </div>
                  {item.gems_granted > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10, padding: '5px 12px', borderRadius: 20, background: 'rgba(0,242,255,0.08)', border: '1px solid #00F2FF30', width: 'fit-content' }}>
                      <span style={{ fontSize: 14 }}>💎</span>
                      <span style={{ fontFamily: 'Inter, sans-serif', color: '#00F2FF', fontSize: 13, fontWeight: 700 }}>+{formatNum(item.gems_granted)} Gems</span>
                    </div>
                  )}
                  {didBuy ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderRadius: 11, background: 'rgba(0,242,255,0.1)', border: '1px solid #00F2FF40' }}>
                      <span style={{ fontFamily: 'Orbitron, sans-serif', color: '#00F2FF', fontSize: 10, letterSpacing: '0.06em' }}>PURCHASE COMPLETE</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => !owned && !isProcessing && handlePurchase(item)}
                      disabled={isProcessing || owned}
                      style={{
                        display: 'block', width: '100%', padding: '10px 16px', borderRadius: 11, border: 'none',
                        cursor: owned ? 'default' : 'pointer',
                        background: owned ? 'rgba(0,242,255,0.08)' : isProcessing ? 'rgba(34,197,94,0.45)' : btnBg,
                        color: owned ? '#00F2FF80' : '#FFFFFF',
                        fontFamily: 'Orbitron, sans-serif', fontSize: 12, letterSpacing: '0.08em',
                        boxShadow: owned ? 'none' : isProcessing ? 'none' : '0 0 18px rgba(34,197,94,0.32)', lineHeight: '1.4',
                      }}
                    >
                      {owned ? 'OWNED' : isProcessing ? 'PROCESSING...' : `BUY — ${item.price_str}`}
                    </button>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* Xsolla branding */}
        <div style={{ borderRadius: 16, padding: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center', marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#FF5C00,#CC3A00)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 12px rgba(255,92,0,0.4)' }}>
              <span style={{ color: 'white', fontFamily: 'Orbitron, sans-serif', fontSize: 14, fontWeight: 700 }}>X</span>
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontFamily: 'Orbitron, sans-serif', color: '#FFFFFF90', fontSize: 11, letterSpacing: '0.08em', marginBottom: 2 }}>XSOLLA PAY STATION</div>
              <div style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFF35', fontSize: 9 }}>Secure Checkout Infrastructure</div>
            </div>
          </div>
          <div style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFF30', fontSize: 9, lineHeight: '1.6', marginBottom: 10 }}>
            All transactions processed securely by Xsolla.<br />
            Supports 700+ payment methods across 200+ countries.
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
            {['VISA', 'MASTERCARD', 'PAYPAL', 'CRYPTO', 'STEAM'].map(brand => (
              <div key={brand} style={{ padding: '3px 9px', borderRadius: 5, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)' }}>
                <span style={{ fontFamily: 'Inter, sans-serif', color: '#FFFFFF35', fontSize: 8, letterSpacing: '0.04em' }}>{brand}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}
