import Link from "next/link";
import { cookies } from "next/headers";

import PrintButton from "@/components/PrintButton";
import { COOKIE_NAME, verifyAdminToken } from "@/lib/admin-auth";
import { getSiteContent } from "@/lib/content";
import { getSubmissions } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Print-friendly list of every paid name for the rabbi, grouped by gender.
 * Protected by the same admin cookie as the dashboard.
 */
export default async function NamesListPage() {
  const cookieStore = await cookies();
  if (!verifyAdminToken(cookieStore.get(COOKIE_NAME)?.value)) {
    return (
      <main className="system-page">
        <section className="system-card">
          <h1>Sign in required</h1>
          <p>Please sign in to the admin dashboard first, then open the names list again.</p>
          <div className="system-actions">
            <Link href="/admin" className="btn btn-primary">
              Go to admin
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const [submissions, content] = await Promise.all([getSubmissions(), getSiteContent()]);
  const paid = submissions.filter((submission) => submission.status === "paid");
  const rows = paid.flatMap((submission) =>
    submission.names.map((name) => ({
      ...name,
      donor: submission.donor.name,
      performed: Boolean(submission.performed),
      paidAt: submission.paidAt
    }))
  );
  const males = rows.filter((row) => row.gender === "male");
  const females = rows.filter((row) => row.gender === "female");
  const printedAt = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });

  return (
    <main className="print-page">
      <header className="print-header">
        <div>
          <h1>
            {content.campaignName} — names for {content.rabbiName}
          </h1>
          <p className="muted">
            {rows.length} {rows.length === 1 ? "name" : "names"} from {paid.length} paid{" "}
            {paid.length === 1 ? "submission" : "submissions"} · printed {printedAt}
          </p>
        </div>
        <div className="print-actions no-print">
          <Link href="/admin" className="btn btn-ghost">
            Back to admin
          </Link>
          <PrintButton />
        </div>
      </header>

      <section className="print-columns">
        <NameTable title="Male" rows={males} />
        <NameTable title="Female" rows={females} />
      </section>
    </main>
  );
}

function NameTable({
  title,
  rows
}: {
  title: string;
  rows: { hebrewName: string; donor: string; performed: boolean }[];
}) {
  return (
    <div className="print-table">
      <h2>
        {title} <span className="muted">({rows.length})</span>
      </h2>
      {rows.length === 0 ? (
        <p className="muted">None yet.</p>
      ) : (
        <ol>
          {rows.map((row, index) => (
            <li key={index} className={row.performed ? "done" : ""}>
              <span dir="auto" className="print-name">
                {row.hebrewName}
              </span>
              <small className="muted">{row.donor}</small>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

