import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { saveBackendSession, useGame } from '../../context/GameContext';
import { loginOrRegisterPlayer } from '../../lib/backendApi';

/* ── Xsolla config ──────────────────────────────────────────────
   Replace XSOLLA_PROJECT_ID with your real project ID from the
   Xsolla Publisher Account → Login → Settings page.
   callbackUrl must also be whitelisted in the same settings panel.
   ──────────────────────────────────────────────────────────────── */
const XSOLLA_PROJECT_ID  = '4e609fab-2ce3-4711-a2a6-bf46d1f6f775';
const XSOLLA_SDK_URL     = 'https://login-sdk.xsolla.com/latest/';
const XSOLLA_LOCALE      = 'en_XX';

type JwtClaims = {
  sub?: string;
  preferred_username?: string;
  username?: string;
  name?: string;
  email?: string;
};

function decodeJwtClaims(token: string): JwtClaims {
  const base64Url = token.split('.')[1];
  if (!base64Url) throw new Error('Invalid login token');
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const payload = atob(padded);
  return JSON.parse(payload) as JwtClaims;
}

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

/* ── Auth Screen ─────────────────────────────────────────────── */
export function AuthScreen() {
  const { dispatch } = useGame();
  const navigate     = useNavigate();
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    /* ── Step 1: handle redirect back from Xsolla with ?token=xxx ──
       After the user logs in / registers, Xsolla redirects to the
       callbackUrl with a `token` query parameter.  We pick that up
       here, dispatch LOGIN, then navigate into the game.

       TODO (backend): exchange `token` with your API:
         POST /api/auth/xsolla  { token }
         → { playerName, userId, ... }
       Then dispatch LOGIN with the real playerName.
    ─────────────────────────────────────────────────────────────── */
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
          if (!userId) {
            throw new Error('Missing `sub` claim in login token');
          }

          const playerName = claims.preferred_username || claims.username || claims.name || 'COMMANDER';
          const email = claims.email;

          await loginOrRegisterPlayer({
            userId,
            username: playerName,
            email,
          });
          saveBackendSession(token, userId);
          dispatch({ type: 'LOGIN', playerName });
          navigate('/game/mine', { replace: true });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unexpected login error';
          setAuthError(`Unable to connect to backend: ${message}`);
        } finally {
          setAuthLoading(false);
        }
      })();

      return;
    }

    /* ── Step 2: load the Xsolla Login SDK and mount the widget ── */
    function mountWidget() {
      const xl = new window.XsollaLogin.Widget({
        projectId:       XSOLLA_PROJECT_ID,
        /*
         * Set callbackUrl to your app's root (or a dedicated /auth/callback
         * route) so Xsolla redirects back here after successful auth.
         * Make sure this URL is whitelisted in Xsolla Publisher Account →
         * your Login project → Callback URLs.
         */
        callbackUrl:     window.location.origin,
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
