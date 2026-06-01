import { auth } from "@clerk/nextjs/server";

export async function getBrandId(): Promise<string | null> {
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
