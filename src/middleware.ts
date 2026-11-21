import { NextResponse, type NextRequest } from "next/server";

/** Cheap edge gate: no session cookie → sign-in page. Real authorization happens server-side per request. */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/officer") && !pathname.startsWith("/officer/login") && !req.cookies.get("cf_officer")) {
    const url = req.nextUrl.clone();
    url.pathname = "/officer/login";
    url.search = `?next=${encodeURIComponent(pathname + req.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/officer/:path*"] };
