import { NextResponse, type NextRequest } from 'next/server';
import { OWNER_COOKIE, isOwnerId } from '@/lib/owner';

/** Gives each browser an anonymous owner id the first time it visits (see lib/owner.ts). */
export function proxy(request: NextRequest) {
  if (isOwnerId(request.cookies.get(OWNER_COOKIE)?.value)) return NextResponse.next();

  const ownerId = crypto.randomUUID();
  // Add it to this request too, so the page or API route handling the very first visit already sees it.
  request.cookies.set(OWNER_COOKIE, ownerId);
  const response = NextResponse.next({ request: { headers: request.headers } });
  // httpOnly: page scripts can't read or steal it. lax: sent on normal navigation, not cross-site posts.
  response.cookies.set({
    name: OWNER_COOKIE,
    value: ownerId,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export const config = {
  // Everything except static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
