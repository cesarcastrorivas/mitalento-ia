import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js Edge Middleware — runs on the server before any page is rendered.
 * Redirects unauthenticated users before they receive a single byte of HTML.
 *
 * ARCHITECTURE NOTE:
 * - Middleware (Edge runtime): Fast cookie-presence check only.
 *   Cannot use Firebase Admin SDK (requires Node.js APIs).
 * - Admin layout (Server Component): Full cryptographic session verification
 *   + admin role check via getServerUser() using Firebase Admin SDK.
 *   This is the authoritative authorization gate for /admin routes.
 * - API routes: Each route independently verifies session + role via getServerUser().
 */
export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const session = request.cookies.get('__session')?.value;

    // Admin routes — require session; role check happens in the page/API
    if (pathname.startsWith('/admin')) {
        if (!session) {
            return NextResponse.redirect(new URL('/', request.url));
        }
        return NextResponse.next();
    }

    // Student routes — require session
    const protectedPrefixes = [
        '/dashboard',
        '/modules',
        '/paths',
        '/courses',
        '/profile',
        '/leaderboard',
        '/progress',
        '/sofia',
        '/certificate',
        '/certificacion',
        '/compromiso',
        '/action-plan',
        '/evaluacion-actitudinal',
    ];

    const isProtected = protectedPrefixes.some(p => pathname.startsWith(p));
    if (isProtected && !session) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all paths EXCEPT:
         * - _next/static  (static assets)
         * - _next/image   (image optimization)
         * - favicon.ico
         * - /api/auth/*   (login/session endpoints — must stay public)
         * - /verify/*     (public certificate verification page)
         */
        '/((?!_next/static|_next/image|favicon.ico|api/auth|verify).*)',
    ],
};
