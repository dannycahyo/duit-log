export default function Offline() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center bg-white px-6 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-900">
        <span className="text-2xl font-bold text-white">DL</span>
      </div>
      <h1 className="text-xl font-bold text-slate-900">You're offline</h1>
      <p className="mt-2 text-sm text-slate-500">
        Please reconnect to the internet to log expenses.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-6 rounded-xl bg-slate-900 px-8 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Try again
      </button>
    </main>
  );
}
