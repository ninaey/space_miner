import React from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router';
import { GameProvider } from './context/GameContext';
import { LandingPage } from './components/game/LandingPage';
import { AuthScreen } from './components/game/AuthScreen';
import { GameLayout } from './components/game/GameLayout';
import { MainHub } from './components/game/MainHub';
import { Achievements } from './components/game/Achievements';
import { Store } from './components/game/Store';
import { Upgrades } from './components/game/Upgrades';
import { Settings } from './components/game/Settings';


// Root wrapper that provides GameContext to all routes
function Root() {
  return (
    <GameProvider children={<Outlet />} />
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    children: [
      // Landing page — first thing players see
      { index: true, element: <LandingPage /> },

      // Xsolla auth gateway — reached by clicking Login on landing
      { path: 'auth', element: <AuthScreen /> },

      // Game screens — accessible only after authentication
      {
        path: 'game',
        element: <GameLayout />,
        children: [
          { index: true, element: <Navigate to="/game/mine" replace /> },
          { path: 'mine',         element: <MainHub />      },
          { path: 'upgrades',     element: <Upgrades />     },
          { path: 'achievements', element: <Achievements /> },
          { path: 'store',        element: <Store />        },
          { path: 'settings',     element: <Settings />     },
        ],
      },

      // Fallback — redirect unknown paths to landing
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
