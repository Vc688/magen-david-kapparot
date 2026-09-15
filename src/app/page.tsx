import Image from "next/image";

import KapparotForm from "@/components/KapparotForm";
import SiteFooter from "@/components/SiteFooter";
import { fillCopy, getSiteContent, isSubmissionOpen, paragraphs } from "@/lib/content";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const content = await getSiteContent();
  const open = isSubmissionOpen(content);

  return (
    <main className="page">
      <header className="masthead">
        <a href={content.shulWebsiteUrl} target="_blank" rel="noopener noreferrer" className="masthead-logo">
          <Image src="/logo.png" alt={content.organizationName} width={551} height={125} priority />
        </a>
      </header>

      <section className="card">
        <p className="eyebrow">{content.heroEyebrow}</p>
        <h1 className="page-title">{content.pageTitle}</h1>

        <KapparotForm
          key={content.deadlineIso}
          initiallyOpen={open}
          deadlineIso={content.deadlineIso}
          pricePerPersonCents={content.pricePerPersonCents}
          allowExtraDonation={content.allowExtraDonation}
          allowFeeCover={content.allowFeeCover}
          organizationName={content.organizationName}
          namesSectionTitle={content.namesSectionTitle}
          namesSectionHint={content.namesSectionHint}
          nameExample={content.nameExample}
          submitLabel={content.submitLabel}
          closedTitle={content.closedTitle}
          closedBody={fillCopy(content.closedBody, content)}
          contactEmail={content.contactEmail}
        >
          <div className="intro">
            <h2>{fillCopy(content.introTitle, content)}</h2>
            {paragraphs(fillCopy(content.introBody, content)).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
            <p className="notice">
              Please note that this Kapparot link will be disabled at{" "}
              <strong>{content.deadlineLabel}</strong>. The minimum donation this year is{" "}
              <strong>{formatMoney(content.pricePerPersonCents)}</strong> per person wishing to fulfill
              the Misva.
            </p>
          </div>
        </KapparotForm>
      </section>

      <SiteFooter content={content} />
    </main>
  );
}
