import { PORTAL_SESSION_COOKIE } from '@common/constants/portal-session';
import { PORTAL_CLIENT_IP_HEADER } from '@vxrerp/billing/contracts';
import { ErrorTypeEnum } from '@vxrerp/platform/errors';
import type { ErrorType, HttpMethod, PortalSessionResponse } from '@vxrerp/sdk';
import { HttpMethodEnum } from '@vxrerp/sdk';
import { find, first, forEach, join, split, trim } from 'lodash-es';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

enum PortalCredentialEnum {
  PORTAL_KEY = 'portal_key',
  SESSION = 'session',
}

interface PortalRoute {
  method: HttpMethod;
  pattern: RegExp;
  credential: PortalCredentialEnum;
}

interface ResolvedPortalRoute extends PortalRoute {
  path: string;
}

interface PortalBffConfig {
  apiUrl: string;
  portalApiKey: string | null;
}

const SESSIONS_PATH = 'sessions';
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'content-disposition'];

const PORTAL_ROUTES: readonly PortalRoute[] = [
  { method: HttpMethodEnum.POST, pattern: /^links$/, credential: PortalCredentialEnum.PORTAL_KEY },
  {
    method: HttpMethodEnum.POST,
    pattern: /^sessions$/,
    credential: PortalCredentialEnum.PORTAL_KEY,
  },
  {
    method: HttpMethodEnum.DELETE,
    pattern: /^sessions$/,
    credential: PortalCredentialEnum.SESSION,
  },
  {
    method: HttpMethodEnum.POST,
    pattern: /^sessions\/current$/,
    credential: PortalCredentialEnum.SESSION,
  },
  { method: HttpMethodEnum.GET, pattern: /^me$/, credential: PortalCredentialEnum.SESSION },
  { method: HttpMethodEnum.GET, pattern: /^invoices$/, credential: PortalCredentialEnum.SESSION },
  {
    method: HttpMethodEnum.GET,
    pattern: /^invoices\/[A-Za-z0-9_]+(\/pdf|\/bank_transfer|\/comparison|\/reminders)?$/,
    credential: PortalCredentialEnum.SESSION,
  },
  { method: HttpMethodEnum.GET, pattern: /^usage$/, credential: PortalCredentialEnum.SESSION },
  { method: HttpMethodEnum.POST, pattern: /^requests$/, credential: PortalCredentialEnum.SESSION },
  {
    method: HttpMethodEnum.GET,
    pattern: /^invoice_exports$/,
    credential: PortalCredentialEnum.SESSION,
  },
  { method: HttpMethodEnum.GET, pattern: /^payments$/, credential: PortalCredentialEnum.SESSION },
  {
    method: HttpMethodEnum.GET,
    pattern: /^invoice_totals$/,
    credential: PortalCredentialEnum.SESSION,
  },
  {
    method: HttpMethodEnum.GET,
    pattern: /^subscriptions$/,
    credential: PortalCredentialEnum.SESSION,
  },
  {
    method: HttpMethodEnum.GET,
    pattern: /^payment_methods$/,
    credential: PortalCredentialEnum.SESSION,
  },
];

function readPortalBffConfig(): PortalBffConfig {
  const { VXRERP_API_URL = 'http://localhost:3000', VXRERP_PORTAL_API_KEY } = process.env;

  return { apiUrl: VXRERP_API_URL, portalApiKey: VXRERP_PORTAL_API_KEY ?? null };
}

function buildErrorResponse(status: number, type: ErrorType, message: string): NextResponse {
  return NextResponse.json(
    { error: { type, message, requestId: crypto.randomUUID() } },
    { status },
  );
}

function resolvePortalRoute(
  method: string,
  segments: readonly string[],
): ResolvedPortalRoute | null {
  const path = join(segments, '/');

  const portalRoute = find(PORTAL_ROUTES, (candidateRoute) => {
    return candidateRoute.method === method && candidateRoute.pattern.test(path);
  });

  if (portalRoute) {
    return { ...portalRoute, path };
  }

  return null;
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

function buildForwardedHeaders(apiResponse: Response): Headers {
  const headers = new Headers();

  forEach(FORWARDED_RESPONSE_HEADERS, (headerName) => {
    const headerValue = apiResponse.headers.get(headerName);

    if (headerValue) {
      headers.set(headerName, headerValue);
    }
  });

  return headers;
}

async function buildPortalResponse(
  portalRoute: ResolvedPortalRoute,
  apiResponse: Response,
): Promise<NextResponse> {
  const isSessionRoute = portalRoute.path === SESSIONS_PATH;

  if (isSessionRoute && portalRoute.method === HttpMethodEnum.POST && apiResponse.ok) {
    return buildSessionResponse(apiResponse);
  }

  const body = await apiResponse.arrayBuffer();

  const response = new NextResponse(body, {
    status: apiResponse.status,
    headers: buildForwardedHeaders(apiResponse),
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
  portalRoute: ResolvedPortalRoute,
): Promise<NextResponse> {
  const { apiUrl, portalApiKey } = readPortalBffConfig();

  if (portalApiKey) {
    const url = `${apiUrl}/v1/portal/${portalRoute.path}${request.nextUrl.search}`;

    const headers: Record<string, string> = {
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
