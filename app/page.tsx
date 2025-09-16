import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center text-slate-200">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-50">Explo Embed</h1>
        <p className="text-sm text-slate-400">
          Launch the embeddable experience at{' '}
          <Link className="text-sky-400 hover:text-sky-300" href="/embed">
            /embed
          </Link>
          .
        </p>
      </div>
    </main>
  );
}