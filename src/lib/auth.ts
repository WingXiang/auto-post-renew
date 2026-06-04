import { auth } from "@clerk/nextjs/server";

export async function getBrandId(): Promise<string | null> {
  // Dev bypass — return fallback org so local testing works without Clerk session
  if (
    process.env.DEV_BYPASS_AUTH === "true" &&
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_DEFAULT_BRAND_ID
  ) {
    return process.env.DEV_DEFAULT_BRAND_ID;
  }
  const { orgId } = await auth();
  return orgId ?? null;
}

export async function requireBrandId(): Promise<string> {
  const brandId = await getBrandId();
  if (!brandId) {
    throw new Error("NO_ORG");
  }
  return brandId;
}
