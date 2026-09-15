import type Stripe from "stripe";

import { getStripe } from "@/lib/stripe";
import { getSubmissions, insertSubmission, markSubmissionPaid } from "@/lib/store";
import type { Gender, KapparotName, Submission } from "@/types";

export type SyncResult = {
  scanned: number;
  added: string[];
  markedPaid: string[];
  alreadyCurrent: number;
};

/**
 * Parses the `names` metadata written by /api/checkout:
 *   "Moshe ben Frieda (M), שרה בת רבקה (F)"
 * A clipped list ends with "…" and may lose the last entry — those names still
 * live in the Stripe line-item description, but the record is flagged in notes.
 */
function parseNames(raw: string | undefined): KapparotName[] {
  if (!raw) return [];
  const names: KapparotName[] = [];
  for (const match of raw.matchAll(/(.+?) \((M|F)\)(?:,\s|$)/g)) {
    const gender: Gender = match[2] === "M" ? "male" : "female";
    names.push({ gender, hebrewName: match[1].trim() });
  }
  return names;
}

function lineItemBreakdown(items: Stripe.LineItem[]) {
  let perPersonCents = 0;
  let nameCount = 0;
  let extraDonationCents = 0;
  let feeCoverCents = 0;
  for (const item of items) {
    const label = item.description || "";
    const quantity = item.quantity || 0;
    const unit = item.price?.unit_amount || 0;
    if (label.endsWith("per person")) {
      perPersonCents = unit;
      nameCount = quantity;
    } else if (label === "Additional donation") {
      extraDonationCents += item.amount_total;
    } else if (label === "Cover processing fees") {
      feeCoverCents += item.amount_total;
    }
  }
  return { perPersonCents, nameCount, extraDonationCents, feeCoverCents };
}

function submissionFromSession(session: Stripe.Checkout.Session, items: Stripe.LineItem[]): Submission {
  const breakdown = lineItemBreakdown(items);
  const parsed = parseNames(session.metadata?.names);
  const expectedCount = parseInt(session.metadata?.nameCount || "0", 10) || breakdown.nameCount;
  // If metadata was clipped, pad with placeholders so the count (and money) stays right.
  const names = [...parsed];
  while (names.length < expectedCount) {
    names.push({ gender: "male", hebrewName: `(name #${names.length + 1} — see Stripe)` });
  }
  const paidAt = new Date(session.created * 1000).toISOString();
  const now = new Date().toISOString();
  const notes = [
    "Recovered from Stripe by Sync.",
    parsed.length < expectedCount ? "Some names were clipped in metadata — check the Stripe payment." : ""
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: session.metadata?.submissionId || `kap_stripe_${session.id.slice(-12)}`,
    status: "paid",
    donor: {
      name: session.customer_details?.name || session.metadata?.donorName || "Unknown donor",
      email: session.customer_details?.email || session.customer_email || "",
      phone: session.customer_details?.phone || undefined
    },
    names,
    pricePerPersonCents: breakdown.perPersonCents,
    namesTotalCents: breakdown.perPersonCents * names.length,
    extraDonationCents: breakdown.extraDonationCents,
    coverFees: breakdown.feeCoverCents > 0,
    feeCoverCents: breakdown.feeCoverCents,
    totalAmountCents: session.amount_total || 0,
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
    stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined,
    createdAt: paidAt,
    updatedAt: now,
    paidAt,
    adminNotes: notes
  };
}

/**
 * Marks the local record for a paid session as paid — or, if the record is
 * missing (e.g. `data/` was reset by a redeploy), rebuilds it from Stripe.
 * Used by the webhook and the thank-you page. Returns the submission id.
 */
export async function recordPaidSession(session: Stripe.Checkout.Session): Promise<string | undefined> {
  if (session.payment_status !== "paid") return undefined;
  const existing = await getSubmissions();
  const local =
    existing.find((submission) => submission.stripeCheckoutSessionId === session.id) ||
    existing.find((submission) => submission.id === session.metadata?.submissionId);

  if (local) {
    if (local.status !== "paid") {
      await markSubmissionPaid(local.id, {
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
        stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined
      });
    }
    return local.id;
  }

  if (session.metadata?.campaign !== "kapparot") return undefined;
  const items = await getStripe().checkout.sessions.listLineItems(session.id, { limit: 10 });
  const submission = submissionFromSession(session, items.data);
  await insertSubmission(submission);
  return submission.id;
}

/**
 * Pulls every paid Kapparot Checkout session from Stripe and makes the local
 * records match: pending/missing submissions become paid. Safe to run repeatedly.
 * This is the recovery path when the webhook failed or `data/` was reset.
 */
export async function syncFromStripe(): Promise<SyncResult> {
  const stripe = getStripe();
  const existing = await getSubmissions();
  const byId = new Map(existing.map((submission) => [submission.id, submission]));
  const bySession = new Map(
    existing
      .filter((submission) => submission.stripeCheckoutSessionId)
      .map((submission) => [submission.stripeCheckoutSessionId!, submission])
  );

  const result: SyncResult = { scanned: 0, added: [], markedPaid: [], alreadyCurrent: 0 };

  for await (const session of stripe.checkout.sessions.list({ limit: 100 })) {
    if (session.metadata?.campaign !== "kapparot" || session.payment_status !== "paid") {
      continue;
    }
    result.scanned += 1;
    const local = bySession.get(session.id) || byId.get(session.metadata?.submissionId || "");

    if (local?.status === "paid") {
      result.alreadyCurrent += 1;
      continue;
    }
    if (local) {
      await markSubmissionPaid(local.id, {
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : undefined,
        stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined
      });
      result.markedPaid.push(local.id);
      continue;
    }

    const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
    const submission = submissionFromSession(session, items.data);
    await insertSubmission(submission);
    byId.set(submission.id, submission);
    result.added.push(submission.id);
  }

  return result;
}
