import { NextRequest, NextResponse } from "next/server";
import { decryptSession } from "@/lib/session";

const SESSION_COOKIE = "session";

const protectedPrefixes = ["/dashboard", "/properties", "/appointments"];
const authPages = ["/login", "/signup"];

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = protectedPrefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  const isAuthPage = authPages.includes(pathname);

  if (!isProtected && !isAuthPage) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await decryptSession(token);

  if (isProtected && !session) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && session) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
};
