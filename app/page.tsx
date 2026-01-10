import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-extrabold tracking-tight">
        House Help Tracker
      </h1>
      <p className="mt-2 text-slate-600">
        Track worked/absent days and shifts. LocalStorage-based for now.
      </p>

      <div className="mt-6 flex gap-3">
        <Link
          href="/workers"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Go to Workers
        </Link>
      </div>
    </main>
  );
}
