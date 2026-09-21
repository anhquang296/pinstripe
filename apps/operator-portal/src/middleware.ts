import { PORTAL_SESSION_COOKIE } from '@common/constants/portal-session';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  if (request.cookies.has(PORTAL_SESSION_COOKIE)) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/((?!login|bff|_next|favicon.ico).*)'],
};
