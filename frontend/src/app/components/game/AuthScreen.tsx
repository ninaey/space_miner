import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { saveBackendSession, useGame } from '../../context/GameContext';
import { loginOrRegisterPlayer, getGameItems } from '../../lib/backendApi';

/* ── Xsolla config ──────────────────────────────────────────────
   IMPORTANT: There are TWO different IDs in Xsolla — do not mix them up:
   
   1. Numeric Project ID (e.g. 304856) — used for Store/Pay Station API calls
   2. Login Project UUID — used ONLY for the Login Widget below
      Find it: Publisher Account → Players → Login → your project → Copy ID
      It looks like: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

   The Widget MUST use the Login Project UUID (option 2).
   callbackUrl must be whitelisted in Login project → Callback URLs.
   ──────────────────────────────────────────────────────────────── */
// ⚠️  This must be the Login Project UUID (not the numeric project ID 304856).
// Find it: Publisher Account → Players → Login → your project → Copy ID (the UUID).
const XSOLLA_LOGIN_PROJECT_ID = '4e609fab-2ce3-4711-a2a6-bf46d1f6f775';
const XSOLLA_SDK_URL          = 'https://login-sdk.xsolla.com/latest/';
const XSOLLA_LOCALE           = 'en_US';

// Xsolla JWT payload claims — see https://developers.xsolla.com/api/login/#jwt-structure
type JwtClaims = {
  sub?: string;       // User ID (UUID) — always present
  username?: string;  // Username — Xsolla's standard claim name
  email?: string;     // Email address
  // NOTE: Xsolla uses "username", not "preferred_username"
  // preferred_username is kept below only as a legacy fallback
  preferred_username?: string;
};


/* Extend Window so TypeScript knows about the Xsolla global */
declare global {
  interface Window {
    XsollaLogin: {
      Widget: new (config: {
        projectId: string;
        callbackUrl: string;
        preferredLocale: string;
      }) => {
        mount: (elementId: string) => void;
        open:  () => void;
      };
    };
  }
}

/* ── Star field background ───────────────────────────────────── */
const StarField = () => {
  const stars = Array.from({ length: 80 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2.5 + 0.5,
    delay: Math.random() * 3,
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      {stars.map(s => (
        <div
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{
            left:            `${s.x}%`,
            top:             `${s.y}%`,
            width:           s.size,
            height:          s.size,
            animation:       `scm-star__dot--twinkle ${2 + s.delay}s ease-in-out infinite`,
            animationDelay:  `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
};

function decodeJwtClaims(token: string): JwtClaims {
  const base64Url = token.split('.')[1];
  if (!base64Url) throw new Error('Invalid login token');
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padded  = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return JSON.parse(atob(padded)) as JwtClaims;
}

/* ── Auth Screen ─────────────────────────────────────────────── */
export function AuthScreen() {
  const { dispatch } = useGame();
  const navigate     = useNavigate();
  const [authError,   setAuthError]   = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    // After login, Xsolla redirects to callbackUrl with ?token=<JWT>
    const params = new URLSearchParams(window.location.search);
    const token  = params.get('token') || params.get('access_token');

    if (token) {
      // Strip the token from the URL so back-navigation is clean
      window.history.replaceState({}, '', window.location.pathname);

      void (async () => {
        setAuthLoading(true);
        setAuthError(null);
        try {
          const claims = decodeJwtClaims(token);
          const userId = claims.sub;
          if (!userId) throw new Error('Missing `sub` claim in login token');

          // Xsolla JWT uses "username" as the claim name
          const playerName = claims.username || claims.preferred_username || 'COMMANDER';

          const loginRes = await loginOrRegisterPlayer({ userId, username: playerName, email: claims.email });
          saveBackendSession(token, userId);
          dispatch({ type: 'LOGIN', playerName });

          // Restore depth + gems from backend so returning players resume at their
          // correct depth and gem balance; new players get zeros (matching DB defaults).
          const bs = loginRes.state as Record<string, any> | null | undefined;
          if (bs) {
            dispatch({
              type: 'MERGE_BACKEND_STATE',
              depth: (bs.game_state?.current_depth as number) ?? 0,
              gems: (bs.player?.gem_balance as number) ?? 0,
              storageMax: (bs.game_state?.storage_capacity_kg as number) ?? undefined,
            });
          }

          // Fetch player's purchased items from the JWT-protected API
          try {
            const { items } = await getGameItems(token);
            dispatch({ type: 'SET_PURCHASED_ITEMS', items });
          } catch {
            // Non-fatal: items panel will just be empty on first login
          }

          navigate('/game/mine', { replace: true });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unexpected login error';
          setAuthError(`Login failed: ${message}`);
        } finally {
          setAuthLoading(false);
        }
      })();
      return;
    }

    /* ── Step 2: load the Xsolla Login SDK and mount the widget ── */
    function mountWidget() {
      const xl = new window.XsollaLogin.Widget({
        projectId:       XSOLLA_LOGIN_PROJECT_ID,
        /*
         * Set callbackUrl to your app's root (or a dedicated /auth/callback
         * route) so Xsolla redirects back here after successful auth.
         * Make sure this URL is whitelisted in Xsolla Publisher Account →
         * your Login project → Callback URLs.
         */
        // Must end with /auth — whitelisted in Publisher Account → Login → Callback URLs
        callbackUrl:     `${window.location.origin}/auth`,
        preferredLocale: XSOLLA_LOCALE,
      });
      xl.mount('xl_auth');
    }

    // Avoid loading the SDK twice (React Strict Mode double-invoke safe)
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${XSOLLA_SDK_URL}"]`
    );

    if (existingScript) {
      // SDK already present — mount immediately if ready, else wait
      if (window.XsollaLogin) {
        mountWidget();
      } else {
        existingScript.addEventListener('load', mountWidget, { once: true });
      }
      return;
    }

    const script    = document.createElement('script');
    script.type     = 'text/javascript';
    script.async    = true;
    script.src      = XSOLLA_SDK_URL;
    document.head.appendChild(script);
    script.addEventListener('load', mountWidget, { once: true });
  }, [dispatch, navigate]);

  return (
    <div className="scm-auth__page">

      {/* Fixed decorative layer */}
      <StarField />
      <div className="scm-auth__nebula"            aria-hidden="true" />
      <div className="scm-auth__planet--top-right"  aria-hidden="true" />
      <div className="scm-auth__planet--bottom-left" aria-hidden="true" />

      {/* Back to landing */}
      <motion.button
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        onClick={() => navigate('/')}
        className="flex items-center gap-2 px-4 py-2 rounded-xl mb-4"
        style={{
          position: 'relative',
          zIndex: 10,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(0,242,255,0.15)',
          color: 'rgba(255,255,255,0.40)',
          fontFamily: 'Orbitron, sans-serif',
          fontSize: 9,
          letterSpacing: '0.12em',
          cursor: 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        <span>BACK TO BASE</span>
      </motion.button>

      {/* Main modal card */}
      <motion.div
        className="scm-auth__container"
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
      >
        {/* ── Game branding header ─────────────────────────────── */}
        <div className="scm-auth__header">
          <p className="scm-auth__tagline">Colony Command Network</p>
          <h1 className="scm-auth__title">SPACE COLONY</h1>
          <h2 className="scm-auth__subtitle">MINER</h2>
          <div className="scm-auth__divider" />
        </div>

        {/* ── Xsolla Login Widget mount point ──────────────────── */}
        {/*
          The Xsolla SDK will inject its full login / register / password-reset
          UI into this div. All visual overrides live in auth.css §6.
          If the widget appears unstyled, Xsolla may be rendering inside an
          <iframe> — in that case request a Custom CSS override file from
          Xsolla support and paste those rules into auth.css §6 instead.
        */}
        <div className="scm-auth__widget-wrapper">
          <div id="xl_auth" />
        </div>
        {authLoading && (
          <p style={{ marginTop: 12, color: '#00F2FF', fontFamily: 'Inter, sans-serif', fontSize: 12 }}>
            Connecting to colony backend...
          </p>
        )}
        {authError && (
          <p style={{ marginTop: 12, color: '#FF6666', fontFamily: 'Inter, sans-serif', fontSize: 12 }}>
            {authError}
          </p>
        )}

        {/* ── Footer ───────────────────────────────────────────── */}
        <div className="scm-auth__footer">
          <span className="scm-auth__footer-lock">🔒</span>
          Secure authentication powered by <strong>Xsolla</strong>
        </div>
      </motion.div>
    </div>
  );
}