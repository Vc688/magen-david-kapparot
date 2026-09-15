"use client";

import {
  ClipboardList,
  Download,
  Lock,
  LogOut,
  Pencil,
  Printer,
  RefreshCw,
  Save,
  Search
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import SiteContentEditor from "@/components/SiteContentEditor";
import { formatMoney } from "@/lib/money";
import type { Submission, SubmissionStatus } from "@/types";

type AdminResponse = {
  submissions: Submission[];
  settings: { deadlineIso: string; pricePerPersonCents: number; campaignName: string };
};

type Tab = "submissions" | "content";

const statuses: SubmissionStatus[] = ["paid", "pending", "expired", "canceled", "refunded"];

export default function AdminDashboard() {
  const [password, setPassword] = useState("");
  const [authorized, setAuthorized] = useState<boolean | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("submissions");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [settings, setSettings] = useState<AdminResponse["settings"] | undefined>();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("paid");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/submissions", { cache: "no-store" });
      if (response.status === 401) {
        setAuthorized(false);
        return;
      }
      const data = (await response.json()) as AdminResponse;
      setSubmissions(data.submissions);
      setSettings(data.settings);
      setAuthorized(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load submissions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password })
    });
    if (!response.ok) {
      setMessage("Invalid password.");
      return;
    }
    setPassword("");
    await load();
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthorized(false);
    setSubmissions([]);
  }

  async function update(
    id: string,
    status: SubmissionStatus,
    fields: { adminNotes?: string; performed?: boolean }
  ) {
    setMessage("");
    const response = await fetch(`/api/admin/submissions/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, ...fields })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Could not update submission.");
      return;
    }
    setSubmissions((current) => current.map((item) => (item.id === id ? data.submission : item)));
    setMessage("Saved.");
  }

  const filtered = submissions.filter((submission) => {
    const text = `${submission.id} ${submission.status} ${submission.donor.name} ${submission.donor.email} ${
      submission.donor.phone || ""
    } ${submission.names.map((name) => name.hebrewName).join(" ")}`.toLowerCase();
    const matchesText = text.includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" || submission.status === statusFilter;
    return matchesText && matchesStatus;
  });

  const metrics = useMemo(() => {
    const paid = submissions.filter((submission) => submission.status === "paid");
    return {
      paidSubmissions: paid.length,
      paidNames: paid.reduce((sum, submission) => sum + submission.names.length, 0),
      revenue: paid.reduce((sum, submission) => sum + submission.totalAmountCents, 0),
      feesCovered: paid.reduce((sum, submission) => sum + submission.feeCoverCents, 0),
      awaitingRabbi: paid.filter((submission) => !submission.performed).length
    };
  }, [submissions]);

  if (authorized === false) {
    return (
      <main className="admin-shell login-shell">
        <form className="login-card" onSubmit={login}>
          <span className="login-icon">
            <Lock size={28} />
          </span>
          <h1>Kapparot Admin</h1>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Admin password"
            required
          />
          {message ? <p className="error-text">{message}</p> : null}
          <button className="checkout-button">
            <Lock size={18} />
            Sign in
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">Congregation Magen David of West Deal</p>
          <h1>{settings?.campaignName || "Kapparot"} Admin</h1>
        </div>
        <div className="admin-actions">
          <a className="btn btn-ghost" href="/" target="_blank" rel="noopener noreferrer">
            View site
          </a>
          <a className="btn btn-ghost" href="/admin/names" target="_blank" rel="noopener noreferrer">
            <Printer size={17} />
            Names list
          </a>
          <a className="btn btn-ghost" href="/api/admin/export.csv">
            <Download size={17} />
            Export CSV
          </a>
          <button className="btn btn-ghost" onClick={load} disabled={loading}>
            <RefreshCw size={17} className={loading ? "spin" : ""} />
            Refresh
          </button>
          <button className="btn btn-ghost" onClick={logout}>
            <LogOut size={17} />
            Logout
          </button>
        </div>
      </header>

      <div className="admin-tabs">
        <button className={tab === "submissions" ? "active" : ""} onClick={() => setTab("submissions")}>
          <ClipboardList size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />
          Submissions
        </button>
        <button className={tab === "content" ? "active" : ""} onClick={() => setTab("content")}>
          <Pencil size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />
          Site content &amp; settings
        </button>
      </div>

      {tab === "content" ? (
        <SiteContentEditor />
      ) : (
        <>
          <section className="admin-metrics">
            <AdminMetric label="Paid names" value={metrics.paidNames.toLocaleString()} />
            <AdminMetric label="Paid submissions" value={metrics.paidSubmissions.toLocaleString()} />
            <AdminMetric label="Total collected" value={formatMoney(metrics.revenue)} />
            <AdminMetric label="Awaiting Kapparot" value={metrics.awaitingRabbi.toLocaleString()} />
          </section>

          <section className="orders-panel">
            <div className="orders-toolbar">
              <label className="search-box">
                <Search size={18} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name, email, or Hebrew name"
                />
              </label>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="paid">Paid</option>
                <option value="all">All statuses</option>
                {statuses
                  .filter((status) => status !== "paid")
                  .map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
              </select>
            </div>
            {message ? <p className="status-message">{message}</p> : null}
            <div className="orders-list">
              {filtered.length === 0 ? (
                <p className="muted">No submissions match this view.</p>
              ) : (
                filtered.map((submission) => (
                  <SubmissionCard
                    key={`${submission.id}-${submission.updatedAt}`}
                    submission={submission}
                    onUpdate={update}
                  />
                ))
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function AdminMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SubmissionCard({
  submission,
  onUpdate
}: {
  submission: Submission;
  onUpdate: (
    id: string,
    status: SubmissionStatus,
    fields: { adminNotes?: string; performed?: boolean }
  ) => Promise<void>;
}) {
  const [status, setStatus] = useState<SubmissionStatus>(submission.status);
  const [notes, setNotes] = useState(submission.adminNotes || "");
  const [performed, setPerformed] = useState(Boolean(submission.performed));

  return (
    <article className={`order-card status-${submission.status}`}>
      <div className="order-top">
        <div>
          <h2>{submission.donor.name}</h2>
          <p>
            {submission.donor.email}
            {submission.donor.phone ? ` / ${submission.donor.phone}` : ""}
          </p>
          <p>
            <span className={`pill pill-${submission.status}`}>{submission.status}</span>
            {submission.performed ? <span className="pill pill-done">Kapparot performed</span> : null}
          </p>
        </div>
        <div className="order-total">
          <strong>{formatMoney(submission.totalAmountCents)}</strong>
          <span>
            {submission.names.length} {submission.names.length === 1 ? "name" : "names"}
            {submission.extraDonationCents > 0 ? ` + ${formatMoney(submission.extraDonationCents)} extra` : ""}
            {submission.feeCoverCents > 0 ? ` + fees` : ""}
          </span>
        </div>
      </div>
      <div className="order-items">
        {submission.names.map((name, index) => (
          <div className="order-item" key={index}>
            <span>{name.gender === "male" ? "M" : "F"}</span>
            <strong dir="auto">{name.hebrewName}</strong>
          </div>
        ))}
      </div>
      <div className="order-controls">
        <select value={status} onChange={(event) => setStatus(event.target.value as SubmissionStatus)}>
          {statuses.map((option) => (
            <option value={option} key={option}>
              {option}
            </option>
          ))}
        </select>
        <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Admin notes" />
        <label className="check-inline">
          <input
            type="checkbox"
            checked={performed}
            onChange={(event) => setPerformed(event.target.checked)}
          />
          Performed
        </label>
        <button
          className="btn btn-primary"
          onClick={() => onUpdate(submission.id, status, { adminNotes: notes, performed })}
        >
          <Save size={16} />
          Save
        </button>
      </div>
      <p className="order-meta">
        {submission.id} / {new Date(submission.createdAt).toLocaleString()}
        {submission.paidAt ? ` / paid ${new Date(submission.paidAt).toLocaleString()}` : ""}
        {submission.stripePaymentIntentId ? ` / ${submission.stripePaymentIntentId}` : ""}
      </p>
    </article>
  );
}
