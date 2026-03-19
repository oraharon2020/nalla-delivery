import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// נתיבים שלא דורשים אימות
const publicPaths = ['/login', '/admin/login', '/api'];

// נתיבים של assets שלא צריכים בדיקה
const assetPaths = ['/_next', '/assets', '/favicon.ico', '/manifest.json'];

// נתיבי אדמין שדורשים אימות אדמין (מטופלים בצד הלקוח)
const adminPaths = ['/admin'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // אל תבדוק assets
  if (assetPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }
  
  // אל תבדוק נתיבים ציבוריים
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // נתיבי אדמין - האימות מתבצע בצד הלקוח
  if (adminPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }
  
  // בדוק אם יש טוקן (לנהגים)
  const token = request.cookies.get('auth_token')?.value;
  
  if (!token) {
    // הפנה לדף התחברות
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
  
  // אפשר המשך
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
