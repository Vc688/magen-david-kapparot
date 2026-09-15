import { CheckCircle2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import SiteFooter from "@/components/SiteFooter";
import { fillCopy, getSiteContent } from "@/lib/content";
import { formatMoney } from "@/lib/money";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getSubmissionByCheckoutSession, markSubmissionPaid } from "@/lib/store";
import type { Submission } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Looks up the submission for this Checkout session. If the webhook hasn't
 * landed yet (or isn't configured), confirms payment directly with Stripe so
 * the donor always sees an accurate confirmation.
 */
async function resolveSubmission(sessionId?: string): Promise<Submission | undefined> {
  if (!sessionId) return undefined;
  let submission = await getSubmissionByCheckoutSession(sessionId);
  if (submission && submission.status !== "paid" && isStripeConfigured()) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      if (session.payment_status === "paid") {
        await markSubmissionPaid(submission.id, {
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId:
            typeof session.payment_intent === "string" ? session.payment_intent : undefined,
          stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined
        });
        submission = await getSubmissionByCheckoutSession(sessionId);
      }
    } catch {
      // Leave as-is; the webhook will reconcile.
    }
  }
  return submission;
}

export default async function SuccessPage({
  searchParams
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  const [content, submission] = await Promise.all([getSiteContent(), resolveSubmission(session_id)]);
  const paid = submission?.status === "paid";

  return (
    <main className="page">
      <header className="masthead">
        <Link href="/" className="masthead-logo">
          <Image src="/logo.png" alt={content.organizationName} width={551} height={125} priority />
        </Link>
      </header>

      <section className="card system-card">
        <span className="system-icon ok">
          <CheckCircle2 size={40} />
        </span>
        <h1>{paid ? content.successTitle : "Thank you — we're confirming your payment"}</h1>
        <p>
          {paid
            ? fillCopy(content.successBody, content)
            : "Your payment is being confirmed with Stripe. You will receive an email receipt shortly; if this page still shows as unconfirmed after a few minutes, please contact the shul office."}
        </p>

        {submission ? (
          <div className="receipt">
            <h2>Names submitted for Kapparot</h2>
            <ul className="receipt-names">
              {submission.names.map((name, index) => (
                <li key={index}>
                  <span dir="auto">{name.hebrewName}</span>
                  <small>{name.gender === "male" ? "Male" : "Female"}</small>
                </li>
              ))}
            </ul>
            <div className="receipt-total">
              <span>Total</span>
              <strong>{formatMoney(submission.totalAmountCents)}</strong>
            </div>
            <p className="muted">Reference: {submission.id}</p>
          </div>
        ) : session_id ? (
          <p className="muted">Reference: {session_id}</p>
        ) : null}

        <div className="system-actions">
          <Link href="/" className="btn btn-primary">
            Submit more names
          </Link>
          <a className="btn btn-ghost" href={content.shulWebsiteUrl} target="_blank" rel="noopener noreferrer">
            Back to {content.shulWebsiteLabel}
          </a>
        </div>
      </section>

      <SiteFooter content={content} />
    </main>
  );
}
