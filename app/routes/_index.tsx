import { redirect } from 'react-router';
import { getAuth } from '@clerk/react-router/server';
import { SignInButton, useAuth } from '@clerk/react-router';
import type { Route } from './+types/_index';

export async function loader(args: Route.LoaderArgs) {
  const { userId } = await getAuth(args);
  if (userId) {
    throw redirect('/dashboard');
  }
  return null;
}

export default function LandingPage() {
  const { isSignedIn } = useAuth();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center bg-white px-6 text-center">
      <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-900">
        <span className="text-2xl font-bold text-white">DL</span>
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        DuitLog
      </h1>
      <p className="mt-3 text-base text-slate-500">
        Log expenses in 10 seconds. Analyze in Google Sheets.
      </p>

      {isSignedIn ? (
        <a
          href="/dashboard"
          className="mt-8 rounded-xl bg-slate-900 px-8 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Go to Dashboard
        </a>
      ) : (
        <SignInButton mode="redirect">
          <button className="mt-8 flex w-full max-w-xs items-center justify-center gap-3 rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </button>
        </SignInButton>
      )}
    </main>
  );
}
