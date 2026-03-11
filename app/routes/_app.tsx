import { getAuth } from '@clerk/react-router/server';
import { redirect, Outlet, NavLink } from 'react-router';
import { clerkClient } from '~/lib/clerk.server';
import { getOrCreateUser } from '~/lib/user.server';

import type { Route } from './+types/_app';

export async function loader(args: Route.LoaderArgs) {
  const { userId: clerkUserId } = await getAuth(args);
  if (!clerkUserId) {
    throw redirect('/');
  }

  // Get Clerk user details
  const clerkUser = await clerkClient.users.getUser(clerkUserId);

  // Derive a primary email; fail fast if none is available
  const primaryEmail =
    clerkUser.emailAddresses.find(
      (email) =>
        email.id === clerkUser.primaryEmailAddressId &&
        email.verification?.status === 'verified',
    ) ??
    clerkUser.emailAddresses.find(
      (email) => email.id === clerkUser.primaryEmailAddressId,
    ) ??
    clerkUser.emailAddresses.find(
      (email) => email.verification?.status === 'verified',
    ) ??
    clerkUser.emailAddresses[0];

  if (!primaryEmail || !primaryEmail.emailAddress) {
    throw new Error(
      'Authenticated Clerk user has no email address; cannot sync to local user record.',
    );
  }

  // Sync to our database
  const user = await getOrCreateUser(
    clerkUserId,
    primaryEmail.emailAddress,
    `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim() ||
      undefined,
    clerkUser.imageUrl ?? undefined,
  );

  // Redirect to onboarding if not complete
  if (!user?.onboardingComplete) {
    const url = new URL(args.request.url);
    if (!url.pathname.startsWith('/onboarding')) {
      throw redirect('/onboarding');
    }
  }

  return { user };
}

export default function AppLayout() {
  return (
    <>
      <div
        style={{
          paddingBottom:
            'calc(4rem + env(safe-area-inset-bottom, 0.5rem))',
        }}
      >
        <Outlet />
      </div>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex max-w-md items-center justify-around border-t border-slate-200 bg-white py-3"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0.5rem)',
        }}
      >
        <NavLink
          to="/dashboard"
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
        <NavLink
          to="/settings"
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
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>Settings</span>
            </>
          )}
        </NavLink>
      </nav>
    </>
  );
}
