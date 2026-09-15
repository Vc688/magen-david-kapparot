import { CircleX } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import SiteFooter from "@/components/SiteFooter";
import { getSiteContent } from "@/lib/content";

export const dynamic = "force-dynamic";

export default async function CancelPage({
  searchParams
}: {
  searchParams: Promise<{ submission_id?: string }>;
}) {
  const { submission_id } = await searchParams;
  const content = await getSiteContent();

  return (
    <main className="page">
      <header className="masthead">
        <Link href="/" className="masthead-logo">
          <Image src="/logo.png" alt={content.organizationName} width={551} height={125} priority />
        </Link>
      </header>

      <section className="card system-card">
        <span className="system-icon warn">
          <CircleX size={40} />
        </span>
        <h1>Payment canceled</h1>
        <p>
          No worries — your card was not charged and nothing was submitted. You can go back and try
          again whenever you are ready.
        </p>
        {submission_id ? <p className="muted">Reference: {submission_id}</p> : null}
        <div className="system-actions">
          <Link href="/" className="btn btn-primary">
            Return to Kapparot
          </Link>
        </div>
      </section>

      <SiteFooter content={content} />
    </main>
  );
}
