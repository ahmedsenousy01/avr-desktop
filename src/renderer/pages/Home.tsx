import { useEffect, useState } from "react";
import { api } from "@renderer/lib/api";

export const Home: React.FC = () => {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    api
      .readCounter()
      .then((v) => mounted && setCount(v))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const increment = async () => {
    try {
      setCount(await api.incrementCounter());
    } catch {}
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-900 via-slate-900 to-sky-950 text-zinc-100 antialiased">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-sky-500/20 ring-1 ring-inset ring-sky-300/30 backdrop-blur" />
            <span className="text-lg font-semibold tracking-tight">
              Learning Electron
            </span>
          </div>
          <a
            href="#"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/90 shadow-sm backdrop-blur transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            Docs
          </a>
        </header>

        <section className="mt-16 grid grid-cols-1 items-center gap-10 md:grid-cols-2">
          <div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Build delightful desktop apps with
              <span className="bg-gradient-to-r from-sky-400 to-cyan-300 bg-clip-text text-transparent">
                {" "}
                Electron
              </span>
            </h1>
            <p className="mt-4 max-w-prose text-white/70">
              Hot reloading, modern tooling, and a small example counter wired
              to the main process. Styled with Tailwind CSS v4.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                onClick={increment}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-sky-950 shadow-lg shadow-sky-500/30 transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sky-400 focus-visible:ring-offset-slate-950"
                aria-label="Increment counter"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-4 w-4"
                  aria-hidden
                >
                  <path d="M12 5c.414 0 .75.336.75.75V11.25H17.25a.75.75 0 1 1 0 1.5H12.75V18.25a.75.75 0 1 1-1.5 0V12.75H6.75a.75.75 0 1 1 0-1.5h4.5V5.75c0-.414.336-.75.75-.75Z" />
                </svg>
                Increment
              </button>
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm">
                <span className="text-white/60">Count</span>
                <span className="font-mono text-base tabular-nums">
                  {count}
                </span>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute -inset-8 -z-10 rounded-3xl bg-sky-400/10 blur-2xl" />
            <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-6 shadow-2xl backdrop-blur">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-white/60">Framework</p>
                  <p className="mt-1 text-sm font-semibold">Electron + Vite</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-white/60">UI</p>
                  <p className="mt-1 text-sm font-semibold">Tailwind v4</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-white/60">State</p>
                  <p className="mt-1 text-sm font-semibold">React 19</p>
                </div>

                <div className="col-span-3 rounded-xl border border-white/10 bg-white/5 p-4">
                  <p className="text-xs text-white/60">Live Counter</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight">
                    <span className="font-mono tabular-nums">{count}</span>
                  </p>
                  <p className="mt-1 text-xs text-white/60">
                    Backed by main process storage
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-16 border-t border-white/10 pt-6 text-center text-xs text-white/50">
          Made with ❤️ using Electron, Vite, React, and Tailwind CSS v4
        </footer>
      </div>
    </main>
  );
};
