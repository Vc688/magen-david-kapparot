import { NextRequest, NextResponse } from "next/server";

import { isAdminRequest } from "@/lib/admin-auth";
import { getSubmissions } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csv(value: unknown): string {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/** One row per Hebrew name, so the rabbi's list can be filtered/sorted in Excel. */
export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const submissions = await getSubmissions();
  const rows = [
    [
      "submission_id",
      "status",
      "performed",
      "hebrew_name",
      "gender",
      "donor_name",
      "donor_email",
      "donor_phone",
      "names_in_submission",
      "per_person",
      "extra_donation",
      "fees_covered",
      "submission_total",
      "created_at",
      "paid_at",
      "admin_notes"
    ]
  ];
  for (const submission of submissions) {
    for (const name of submission.names) {
      rows.push([
        submission.id,
        submission.status,
        submission.performed ? "yes" : "",
        name.hebrewName,
        name.gender,
        submission.donor.name,
        submission.donor.email,
        submission.donor.phone || "",
        String(submission.names.length),
        (submission.pricePerPersonCents / 100).toFixed(2),
        (submission.extraDonationCents / 100).toFixed(2),
        (submission.feeCoverCents / 100).toFixed(2),
        (submission.totalAmountCents / 100).toFixed(2),
        submission.createdAt,
        submission.paidAt || "",
        submission.adminNotes || ""
      ]);
    }
  }
  // BOM so Excel opens Hebrew text correctly.
  const body = `﻿${rows.map((row) => row.map(csv).join(",")).join("\n")}\n`;
  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="kapparot-names.csv"`
    }
  });
}
