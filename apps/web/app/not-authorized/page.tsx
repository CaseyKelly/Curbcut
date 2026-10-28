import type { Metadata } from 'next';
import Link from 'next/link';
import { auth, signOut } from '@/auth';

export const metadata: Metadata = { title: 'Not authorized · Curbcut' };

/**
 * Public (#4): where signed-in GitHub accounts outside the allowlist land.
 * Someone turned away at sign-in has no session; someone removed from the
 * allowlist later still does, so they get a sign-out button.
 */
export default async function NotAuthorizedPage() {
  const session = await auth();
  const login = session?.user?.login;

  async function signOutAction() {
    'use server';
    await signOut({ redirectTo: '/sign-in' });
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Not authorized</h1>
      <p className="mt-4 text-neutral-700">
        {login ? (
          <>
            The GitHub account <strong>{login}</strong> doesn&apos;t have access to Curbcut.
          </>
        ) : (
          <>That GitHub account doesn&apos;t have access to Curbcut.</>
        )}{' '}
        Curbcut is private, and only a few accounts can use it.
      </p>
      <p className="mt-4 text-neutral-700">
        To use a different account, sign out of GitHub first, then{' '}
        <Link href="/sign-in" className="underline hover:no-underline">
          sign in again
        </Link>
        .
      </p>
      {login ? (
        <form action={signOutAction} className="mt-8">
          <button
            type="submit"
            className="rounded-md border border-neutral-900 px-4 py-2 font-medium hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            Sign out
          </button>
        </form>
      ) : null}
    </main>
  );
}
