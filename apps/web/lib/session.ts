import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { NOT_AUTHORIZED_PATH, SIGN_IN_PATH, allowlistFromEnv, isAllowedLogin } from './access';

/**
 * Session checks for pages and route handlers (#4). proxy.ts gates requests
 * too, but every non-public page and route handler calls one of these as
 * well, so the check doesn't depend on the proxy matcher. `routes.test.ts`
 * enforces that.
 */

/** The signed-in, allowlisted GitHub login, or null. For route handlers: answer 401 on null. */
export async function currentLogin(): Promise<string | null> {
  const session = await auth();
  const login = session?.user?.login;
  return isAllowedLogin(login, allowlistFromEnv()) ? login : null;
}

/** For pages: returns the allowlisted login or redirects to sign in or away. */
export async function requireUser(): Promise<string> {
  const session = await auth();
  const login = session?.user?.login;
  if (!login) redirect(SIGN_IN_PATH);
  if (!isAllowedLogin(login, allowlistFromEnv())) redirect(NOT_AUTHORIZED_PATH);
  return login;
}
