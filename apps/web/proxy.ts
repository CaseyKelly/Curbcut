// First line of the sign-in gate (#4): the `authorized` callback in auth.ts
// runs for every request matched below. Pages and route handlers still check
// the session themselves through lib/session.ts.
export { auth as proxy } from './auth';

export const config = {
  // Everything except Next's static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
