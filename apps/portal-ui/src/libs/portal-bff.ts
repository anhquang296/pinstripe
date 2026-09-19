import { PORTAL_SESSION_COOKIE } from '@common/constants/portal-session';
import { PORTAL_CLIENT_IP_HEADER } from '@pinstripe/core/contracts';
import { ErrorTypeEnum } from '@pinstripe/core/errors';
import type { ErrorType, HttpMethod, PortalSessionResponse } from '@pinstripe/sdk';
import { HttpMethodEnum } from '@pinstripe/sdk';
import { find, first, join, matches, split, trim } from 'lodash-es';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

enum PortalCredentialEnum {
  PORTAL_KEY = 'portal_key',
  SESSION = 'session',
}

interface PortalRoute {
  method: HttpMethod;
  path: string;
  credential: PortalCredentialEnum;
}

interface PortalBffConfig {
  apiUrl: string;
  portalApiKey: string | null;
}

const PORTAL_ROUTES: readonly PortalRoute[] = [
  { method: HttpMethodEnum.POST, path: 'links', credential: PortalCredentialEnum.PORTAL_KEY },
  { method: HttpMethodEnum.POST, path: 'sessions', credential: PortalCredentialEnum.PORTAL_KEY },
  { method: HttpMethodEnum.DELETE, path: 'sessions', credential: PortalCredentialEnum.SESSION },
  { method: HttpMethodEnum.GET, path: 'me', credential: PortalCredentialEnum.SESSION },
  { method: HttpMethodEnum.GET, path: 'invoices', credential: PortalCredentialEnum.SESSION },
  { method: HttpMethodEnum.GET, path: 'subscriptions', credential: PortalCredentialEnum.SESSION },
  { method: HttpMethodEnum.GET, path: 'payment_methods', credential: PortalCredentialEnum.SESSION },
];

function readPortalBffConfig(): PortalBffConfig {
  const { PINSTRIPE_API_URL = 'http://localhost:3000', PINSTRIPE_PORTAL_API_KEY } = process.env;

  return { apiUrl: PINSTRIPE_API_URL, portalApiKey: PINSTRIPE_PORTAL_API_KEY ?? null };
}

function buildErrorResponse(status: number, type: ErrorType, message: string): NextResponse {
  return NextResponse.json(
    { error: { type, message, requestId: crypto.randomUUID() } },
    { status },
  );
}

function resolvePortalRoute(method: string, segments: readonly string[]): PortalRoute | null {
  const path = join(segments, '/');
  const portalRoute = find(PORTAL_ROUTES, matches({ method, path }));

  return portalRoute ?? null;
}

function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');

  if (origin && host && URL.canParse(origin)) {
    return new URL(origin).host === host;
  }

  return false;
}

function readClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');

  if (forwardedFor) {
    return trim(first(split(forwardedFor, ',')));
  }

  return request.headers.get('x-real-ip') || 'unknown';
}

function buildCredentialHeaders(
  request: NextRequest,
  portalRoute: PortalRoute,
  portalApiKey: string,
): Record<string, string> {
  if (portalRoute.credential === PortalCredentialEnum.PORTAL_KEY) {
    return {
      authorization: `Bearer ${portalApiKey}`,
      [PORTAL_CLIENT_IP_HEADER]: readClientIp(request),
    };
  }

  const sessionCookie = request.cookies.get(PORTAL_SESSION_COOKIE);

  if (sessionCookie) {
    return { authorization: `Bearer ${sessionCookie.value}` };
  }

  return {};
}

async function buildSessionResponse(apiResponse: Response): Promise<NextResponse> {
  const portalSession = (await apiResponse.json()) as PortalSessionResponse;
  const { sessionKey, sessionExpiresAt } = portalSession;
  const response = NextResponse.json(
    { ...portalSession, sessionKey: null },
    { status: apiResponse.status },
  );

  if (sessionKey && sessionExpiresAt) {
    response.cookies.set(PORTAL_SESSION_COOKIE, sessionKey, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: new Date(sessionExpiresAt),
    });
  }

  return response;
}

async function buildPortalResponse(
  portalRoute: PortalRoute,
  apiResponse: Response,
): Promise<NextResponse> {
  const isSessionRoute = portalRoute.path === 'sessions';

  if (isSessionRoute && portalRoute.method === HttpMethodEnum.POST && apiResponse.ok) {
    return buildSessionResponse(apiResponse);
  }

  const body = await apiResponse.text();
  const contentType = apiResponse.headers.get('content-type') || 'application/json';
  const response = new NextResponse(body, {
    status: apiResponse.status,
    headers: { 'content-type': contentType },
  });
  const isSessionEnded =
    apiResponse.status === 401 ||
    (isSessionRoute && portalRoute.method === HttpMethodEnum.DELETE && apiResponse.ok);

  if (portalRoute.credential === PortalCredentialEnum.SESSION && isSessionEnded) {
    response.cookies.delete(PORTAL_SESSION_COOKIE);
  }

  return response;
}

async function forwardPortalRequest(
  request: NextRequest,
  portalRoute: PortalRoute,
): Promise<NextResponse> {
  const { apiUrl, portalApiKey } = readPortalBffConfig();

  if (portalApiKey) {
    const url = `${apiUrl}/portal/${portalRoute.path}${request.nextUrl.search}`;
    const headers: Record<string, string> = {
      accept: 'application/json',
      ...buildCredentialHeaders(request, portalRoute, portalApiKey),
    };
    const init: RequestInit = { method: portalRoute.method, headers, cache: 'no-store' };

    if (portalRoute.method === HttpMethodEnum.POST) {
      headers['content-type'] = 'application/json';
      init.body = await request.text();
    }

    const apiResponse = await fetch(url, init);

    return buildPortalResponse(portalRoute, apiResponse);
  }

  return buildErrorResponse(503, ErrorTypeEnum.API, 'The portal is not configured');
}

export async function handlePortalBffRequest(
  request: NextRequest,
  segments: readonly string[],
): Promise<NextResponse> {
  const portalRoute = resolvePortalRoute(request.method, segments);

  if (portalRoute) {
    if (portalRoute.method === HttpMethodEnum.GET || isSameOriginRequest(request)) {
      return forwardPortalRequest(request, portalRoute);
    }

    return buildErrorResponse(403, ErrorTypeEnum.INVALID_REQUEST, 'Cross-origin request refused');
  }

  return buildErrorResponse(404, ErrorTypeEnum.INVALID_REQUEST, 'Unrecognized portal route');
}
