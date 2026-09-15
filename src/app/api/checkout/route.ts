import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";

import { getSiteContent, isSubmissionOpen } from "@/lib/content";
import { baseUrl, getStripe, isStripeConfigured } from "@/lib/stripe";
import { attachCheckoutSession, createSubmission, updateSubmissionStatus } from "@/lib/store";
import type { CheckoutInput, DonorInfo, KapparotName, Submission } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validateDonor(donor?: DonorInfo): string | undefined {
  if (!donor?.name?.trim()) return "Please enter your name.";
  if (!donor?.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donor.email.trim())) {
    return "Please enter a valid email address.";
  }
  return undefined;
}

function genderLabel(gender: KapparotName["gender"]): string {
  return gender === "male" ? "M" : "F";
}

/** Stripe metadata values are capped at 500 characters. */
function clip(text: string, max = 500): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Online payment is not configured yet. Please contact the shul office." },
      { status: 503 }
    );
  }

  const content = await getSiteContent();
  if (!isSubmissionOpen(content)) {
    return NextResponse.json({ error: content.closedTitle }, { status: 410 });
  }

  let body: CheckoutInput;
  try {
    body = (await request.json()) as CheckoutInput;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const donorError = validateDonor(body.donor);
  if (donorError) {
    return NextResponse.json({ error: donorError }, { status: 400 });
  }

  // Validation errors are user-facing; anything thrown here is safe to show.
  let submission: Submission;
  try {
    submission = await createSubmission(
      {
        donor: {
          name: body.donor.name.trim(),
          email: body.donor.email.trim().toLowerCase(),
          phone: body.donor.phone?.trim() || undefined
        },
        names: body.names,
        extraDonationCents: body.extraDonationCents,
        coverFees: body.coverFees
      },
      content
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Please check the form and try again." },
      { status: 400 }
    );
  }

  try {
    const siteUrl = baseUrl(request);
    const stripe = getStripe();
    const namesSummary = submission.names
      .map((name) => `${name.hebrewName} (${genderLabel(name.gender)})`)
      .join(", ");
    const count = submission.names.length;

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        quantity: count,
        price_data: {
          currency: "usd",
          unit_amount: submission.pricePerPersonCents,
          product_data: {
            name: `${content.campaignName} — per person`,
            description: clip(namesSummary, 300)
          }
        }
      }
    ];
    if (submission.extraDonationCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: submission.extraDonationCents,
          product_data: { name: "Additional donation" }
        }
      });
    }
    if (submission.feeCoverCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: submission.feeCoverCents,
          product_data: { name: "Cover processing fees" }
        }
      });
    }

    const metadata = {
      submissionId: submission.id,
      campaign: "kapparot",
      nameCount: String(count),
      names: clip(namesSummary)
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      submit_type: "donate",
      client_reference_id: submission.id,
      customer_email: submission.donor.email,
      success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/cancel?submission_id=${submission.id}`,
      metadata,
      expires_at: submission.expiresAt
        ? Math.floor(new Date(submission.expiresAt).getTime() / 1000)
        : undefined,
      payment_intent_data: {
        description: `${content.campaignName} — ${count} name${count === 1 ? "" : "s"} — ${submission.donor.name}`,
        metadata
      },
      line_items: lineItems
    });

    await attachCheckoutSession(submission.id, session.id);
    return NextResponse.json({ url: session.url, submissionId: submission.id });
  } catch (error) {
    // Stripe/network failures: keep the detail in the server log, not the donor's screen.
    console.error("Stripe Checkout session failed", submission.id, error);
    await updateSubmissionStatus(submission.id, "canceled").catch(() => undefined);
    return NextResponse.json(
      { error: "Payment could not be started right now. Please try again in a moment or contact the shul office." },
      { status: 502 }
    );
  }
}
