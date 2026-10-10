import { withAuth } from "next-auth/middleware";

const publicRoutes = ["/login"];

export default withAuth(
  function proxy() {
    return;
  },
  {
    pages: { signIn: "/login" },
    callbacks: {
      authorized({ req, token }) {
        const pathname = req.nextUrl.pathname;
        const isApiAuthRoute = pathname === "/api/auth" || pathname.startsWith("/api/auth/");
        const isApiRoute = pathname.startsWith("/api/");
        const isPublicRoute = publicRoutes.some(
          (route) => pathname === route || pathname.startsWith(`${route}/`),
        );

        if (isApiAuthRoute) return true;
        // API handlers enforce auth themselves so unauthenticated requests receive JSON 401s.
        if (isApiRoute && !token) return true;
        if (isPublicRoute) return true;

        return Boolean(token);
      },
    },
  },
);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
