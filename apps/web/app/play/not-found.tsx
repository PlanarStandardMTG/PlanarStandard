import Link from "next/link";

export default function PlayNotFound() {
  return (
    <div className="py-10 text-center">
      <h1 className="font-display text-2xl">Not here</h1>
      <p className="mt-2 text-sm text-ink-600 dark:text-ink-400">
        That event does not exist, or it is not open yet.
      </p>
      <Link
        href="/play"
        className="mt-4 inline-block text-sm font-medium text-eclipse-700 dark:text-eclipse-400"
      >
        Back to events
      </Link>
    </div>
  );
}
