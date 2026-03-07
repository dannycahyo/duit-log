import { useEffect, useState, useCallback } from 'react';
import {
  isRouteErrorResponse,
  Links,
  Meta,
  NavLink,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteError,
} from 'react-router';

import type { Route } from './+types/root';
import './app.css';
import { Toaster } from '~/components/ui/sonner';
import { isAuthenticated } from '~/lib/auth.server';

export const links: Route.LinksFunction = () => [
  { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap',
  },
];

export async function loader({ request }: Route.LoaderArgs) {
  return { isAuthenticated: await isAuthenticated(request) };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [swUpdate, setSwUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] =
    useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              setWaitingWorker(newWorker);
              setSwUpdate(true);
            }
          });
        });

        if (
          registration.waiting &&
          navigator.serviceWorker.controller
        ) {
          setWaitingWorker(registration.waiting);
          setSwUpdate(true);
        }
      });
  }, []);

  const handleUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      setSwUpdate(false);

      if ('serviceWorker' in navigator && navigator.serviceWorker) {
        navigator.serviceWorker.addEventListener(
          'controllerchange',
          () => {
            window.location.reload();
          },
          { once: true },
        );
      } else {
        window.location.reload();
      }
    }
  }, [waitingWorker]);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#0f172a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="DuitLog" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <Meta />
        <Links />
      </head>
      <body>
        {swUpdate && (
          <button
            onClick={handleUpdate}
            className="fixed top-4 left-1/2 z-[100] -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-lg"
          >
            Update available — tap to refresh
          </button>
        )}
        {children}
        <Toaster />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const { isAuthenticated } = useLoaderData<typeof loader>();

  return (
    <>
      <div
        style={
          isAuthenticated
            ? {
                paddingBottom:
                  'max(6rem, calc(4rem + env(safe-area-inset-bottom)))',
              }
            : undefined
        }
      >
        <Outlet />
      </div>
      {isAuthenticated && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex max-w-md items-center justify-around border-t border-slate-200 bg-white py-3"
          style={{
            paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-4 py-2 text-xs ${isActive ? 'font-bold text-slate-900' : 'text-slate-400'}`
            }
          >
            {({ isActive }) => (
              <>
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={isActive ? 2.5 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="16" />
                  <line x1="8" y1="12" x2="16" y2="12" />
                </svg>
                <span>Add</span>
              </>
            )}
          </NavLink>
          <NavLink
            to="/history"
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-4 py-2 text-xs ${isActive ? 'font-bold text-slate-900' : 'text-slate-400'}`
            }
          >
            {({ isActive }) => (
              <>
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={isActive ? 2.5 : 2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span>History</span>
              </>
            )}
          </NavLink>
        </nav>
      )}
    </>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  let message = 'Something went wrong';
  let details = 'An unexpected error occurred. Please try again.';

  if (isRouteErrorResponse(error)) {
    message =
      error.status === 404
        ? 'Page not found'
        : `Error ${error.status}`;
    details =
      error.status === 404
        ? 'The page you were looking for could not be found.'
        : error.statusText || details;
  } else if (error instanceof Error) {
    if (import.meta.env.DEV) {
      details = error.message;
    }
    console.error('Root ErrorBoundary caught:', error);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center bg-white px-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ef4444"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-slate-900">{message}</h1>
      <p className="mt-2 text-sm text-slate-500">{details}</p>
      <div className="mt-6 flex gap-3">
        <a
          href="/"
          className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Go home
        </a>
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl border-2 border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
