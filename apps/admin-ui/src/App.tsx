import { useQuery } from '@tanstack/react-query';
import { getAdminPing } from '@api/health/health.api';

export default function App() {
  const { data, error, isPending } = useQuery({
    queryKey: ['admin', 'ping'],
    queryFn: getAdminPing,
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Pinstripe Admin</h1>
        <p className="text-sm text-slate-500">
          Billing control plane — phase 0 foundation
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-500">API status</h2>
        {isPending ? <p className="mt-2 text-slate-600">Checking…</p> : null}
        {error ? <p className="mt-2 text-red-600">{error.message}</p> : null}
        {data ? <p className="mt-2 font-mono text-slate-800">{data.object}</p> : null}
      </section>
    </main>
  );
}
