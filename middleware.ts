import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { isAllowedOrigin } from '@/lib/security';

export function middleware(request: NextRequest) {
  const destination = request.headers.get('sec-fetch-dest');
  if (destination === 'document' && !isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/embed/:path*'],
};