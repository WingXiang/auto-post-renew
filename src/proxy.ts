import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks(.*)",
  "/api/upload-base64", // called from n8n with shared-secret auth
]);

export default clerkMiddleware(async (auth, req) => {
  // Dev-only bypass — 任何情況下都拒絕在 production 生效，
  // 避免不小心把 DEV_BYPASS_AUTH=true 設進 Vercel production env 而開後門。
  if (
    process.env.DEV_BYPASS_AUTH === "true" &&
    process.env.NODE_ENV !== "production"
  ) {
    return;
  }
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
