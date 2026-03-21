import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function isProtectedRoute(pathname: string) {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return true;
  }

  if (pathname === "/account" || pathname.startsWith("/account/")) {
    return true;
  }

  if (pathname === "/feed" || pathname.startsWith("/feed/")) {
    return true;
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return true;
  }

  if (pathname === "/orders" || pathname.startsWith("/orders/")) {
    return true;
  }

  if (pathname === "/disputes" || pathname.startsWith("/disputes/")) {
    return true;
  }

  if (pathname === "/support" || pathname.startsWith("/support/")) {
    return true;
  }

  if (pathname === "/licenses" || pathname.startsWith("/licenses/")) {
    return true;
  }

  if (pathname === "/checkout" || pathname.startsWith("/checkout/")) {
    return true;
  }

  if (
    pathname === "/seller" ||
    pathname === "/seller/new" ||
    pathname === "/seller/bundles/new" ||
    pathname === "/seller/onboarding" ||
    /^\/seller\/products\/[^/]+\/edit$/.test(pathname) ||
    /^\/seller\/bundles\/[^/]+\/edit$/.test(pathname)
  ) {
    return true;
  }

  return false;
}

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          requestHeaders.set(name, value);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtectedRoute(request.nextUrl.pathname) && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
