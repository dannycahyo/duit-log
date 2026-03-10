import { UserButton } from '@clerk/react-router';

export default function Settings() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-white">
      <header className="px-4 pt-[max(1.5rem,env(safe-area-inset-top))] pb-4">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Settings
        </h1>
      </header>

      <div className="px-4">
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 p-4">
          <UserButton
            appearance={{
              elements: {
                avatarBox: 'w-10 h-10',
              },
            }}
          />
          <div>
            <p className="text-sm font-medium text-slate-900">Account</p>
            <p className="text-xs text-slate-500">
              Manage your account settings
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 px-4">
        <p className="text-sm text-slate-400">
          More settings coming soon.
        </p>
      </div>
    </main>
  );
}
