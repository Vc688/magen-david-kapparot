import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { getSiteContent } from "@/lib/content";
import { getSubmissions } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const [submissions, content] = await Promise.all([getSubmissions(), getSiteContent()]);
  return NextResponse.json({
    submissions,
    settings: {
      deadlineIso: content.deadlineIso,
      pricePerPersonCents: content.pricePerPersonCents,
      campaignName: content.campaignName
    }
  });
}
