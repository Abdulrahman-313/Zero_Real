import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// The tool and its generation API are private; everything else (landing, auth,
// static assets) stays public.
const isProtectedRoute = createRouteMatcher(["/app(.*)", "/api/ai(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    // Run on everything except Next internals and static files (unless referenced in search params).
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ico|webp|avif|woff2?|ttf|otf|map|txt|xml|json)).*)",
    // Always run on API routes.
    "/(api|trpc)(.*)",
  ],
};
