import { signOut } from '@/auth';
import { requireUser } from '@/lib/session';

export default async function HomePage() {
  const login = await requireUser();

  async function signOutAction() {
    'use server';
    await signOut({ redirectTo: '/sign-in' });
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Curbcut</h1>
      <p className="mt-4 text-neutral-700">
        Scan a page for accessibility issues, understand them, and review fixes.
      </p>
      <form action={signOutAction} className="mt-8 flex items-center gap-4">
        <p className="text-neutral-700">
          Signed in as <strong>{login}</strong>
        </p>
        <button
          type="submit"
          className="rounded-md border border-neutral-900 px-3 py-1 font-medium hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}
