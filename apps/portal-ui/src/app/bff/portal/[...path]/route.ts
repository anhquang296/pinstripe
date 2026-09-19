import { handlePortalBffRequest } from '@libs/portal-bff';
import type { NextRequest } from 'next/server';

interface PortalBffRouteContext {
  params: Promise<{ path: string[] }>;
}

async function handle(request: NextRequest, context: PortalBffRouteContext) {
  const { path } = await context.params;

  return handlePortalBffRequest(request, path);
}

export const dynamic = 'force-dynamic';
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
