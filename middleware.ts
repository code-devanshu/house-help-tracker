import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ✅ If you're using NextAuth v4:
import { getToken } from "next-auth/jwt";

// If you're using NextAuth v5 instead, tell me — middleware import changes.

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ✅ allow home page always
  if (pathname === "/") return NextResponse.next();

  // ✅ allow next-auth endpoints + static assets
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // ✅ check session
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET, // for v4
  });

  // 🔒 Not logged in => go home
  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
