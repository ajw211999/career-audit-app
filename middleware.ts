import { NextRequest, NextResponse } from 'next/server';

// Protects both the dashboard pages and the /api/audits/* endpoints used by
// the dashboard. /api/intake and /api/generate stay public and are guarded by
// the shared WEBHOOK_SECRET instead.
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const needsAuth =
    path.startsWith('/dashboard') || path.startsWith('/api/audits');

  if (!needsAuth) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get('dashboard-auth');

  if (authCookie?.value === process.env.DASHBOARD_PASSWORD) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const encoded = authHeader.split(' ')[1];
    const decoded = Buffer.from(encoded, 'base64').toString();
    const [, password] = decoded.split(':');

    if (password === process.env.DASHBOARD_PASSWORD) {
      const response = NextResponse.next();
      response.cookies.set('dashboard-auth', password, {
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
      return response;
    }
  }

  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="NxtGen Heights Dashboard"' },
  });
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/audits/:path*'],
};
