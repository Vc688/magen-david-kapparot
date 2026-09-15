import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { updateSubmissionStatus } from "@/lib/store";
import type { SubmissionStatus } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const statuses: SubmissionStatus[] = ["pending", "paid", "expired", "canceled", "refunded"];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = (await request.json()) as {
    status?: SubmissionStatus;
    adminNotes?: string;
    performed?: boolean;
  };
  if (!body.status || !statuses.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  try {
    const { id } = await params;
    const submission = await updateSubmissionStatus(id, body.status, {
      adminNotes: body.adminNotes,
      performed: typeof body.performed === "boolean" ? body.performed : undefined
    });
    return NextResponse.json({ submission });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update submission." },
      { status: 404 }
    );
  }
}
