"use client";

import { Lock, Minus, Plus } from "lucide-react";
import { FormEvent, ReactNode, useCallback, useMemo, useRef, useState } from "react";

import Countdown from "@/components/Countdown";
import { feeCoverCents, formatMoney } from "@/lib/money";
import type { Gender } from "@/types";

type NameRow = { key: number; gender: Gender | ""; hebrewName: string };

type Props = {
  initiallyOpen: boolean;
  deadlineIso: string;
  pricePerPersonCents: number;
  allowExtraDonation: boolean;
  allowFeeCover: boolean;
  organizationName: string;
  namesSectionTitle: string;
  namesSectionHint: string;
  nameExample: string;
  submitLabel: string;
  closedTitle: string;
  closedBody: string;
  contactEmail: string;
  children: ReactNode;
};

const MAX_NAMES = 20;

export default function KapparotForm(props: Props) {
  const [open, setOpen] = useState(props.initiallyOpen);
  // Row keys come from a ref (not a module counter) so server and client render identical ids.
  const nextKey = useRef(2);
  const [rows, setRows] = useState<NameRow[]>([{ key: 1, gender: "", hebrewName: "" }]);
  const [donorName, setDonorName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [extraDollars, setExtraDollars] = useState("");
  const [coverFees, setCoverFees] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleExpire = useCallback(() => setOpen(false), []);

  const filledRows = rows.filter((row) => row.gender && row.hebrewName.trim());
  const extraCents = props.allowExtraDonation
    ? Math.max(0, Math.round((Number(extraDollars) || 0) * 100))
    : 0;

  const totals = useMemo(() => {
    const namesTotal = filledRows.length * props.pricePerPersonCents;
    const net = namesTotal + extraCents;
    const fee = props.allowFeeCover ? feeCoverCents(net) : 0;
    return {
      namesTotal,
      net,
      fee,
      total: net + (coverFees ? fee : 0)
    };
  }, [filledRows.length, props.pricePerPersonCents, props.allowFeeCover, extraCents, coverFees]);

  function updateRow(key: number, patch: Partial<NameRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addRow() {
    const key = nextKey.current++;
    setRows((current) =>
      current.length >= MAX_NAMES ? current : [...current, { key, gender: "", hebrewName: "" }]
    );
  }

  function removeRow(key: number) {
    setRows((current) => (current.length === 1 ? current : current.filter((row) => row.key !== key)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    for (const [index, row] of rows.entries()) {
      if (!row.gender) return setError(`Please select male or female for name #${index + 1}.`);
      if (!row.hebrewName.trim()) return setError(`Please enter the Hebrew name for name #${index + 1}.`);
    }
    if (!donorName.trim()) return setError("Please enter your name.");
    if (!email.trim() || !email.includes("@")) return setError("Please enter a valid email address.");

    setSubmitting(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          donor: { name: donorName, email, phone },
          names: rows.map((row) => ({ gender: row.gender, hebrewName: row.hebrewName.trim() })),
          extraDonationCents: extraCents,
          coverFees
        })
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        if (response.status === 410) setOpen(false);
        throw new Error(data.error || "Checkout could not be started.");
      }
      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <div className="closed-notice">
        <h2>{props.closedTitle}</h2>
        <p>{props.closedBody}</p>
        <p className="muted">
          Contact: <a href={`mailto:${props.contactEmail}`}>{props.contactEmail}</a>
        </p>
      </div>
    );
  }

  return (
    <>
      <Countdown deadlineIso={props.deadlineIso} onExpire={handleExpire} />

      {props.children}

      <form className="kapparot-form" onSubmit={submit} noValidate>
        <fieldset className="panel">
          <legend>
            <span className="panel-title">{props.namesSectionTitle}</span>
            <span className="panel-hint">
              {props.namesSectionHint} (Ex.: {props.nameExample})
            </span>
          </legend>

          <div className="name-rows">
            {rows.map((row, index) => (
              <div className="name-row" key={row.key}>
                <label className="sr-only" htmlFor={`gender-${row.key}`}>
                  Gender for name {index + 1}
                </label>
                <select
                  id={`gender-${row.key}`}
                  value={row.gender}
                  onChange={(event) => updateRow(row.key, { gender: event.target.value as Gender })}
                  required
                  className={row.gender ? "" : "placeholder"}
                >
                  <option value="" disabled>
                    Select gender *
                  </option>
                  <option value="male">Male | {formatMoney(props.pricePerPersonCents)}</option>
                  <option value="female">Female | {formatMoney(props.pricePerPersonCents)}</option>
                </select>
                <label className="sr-only" htmlFor={`name-${row.key}`}>
                  Hebrew name {index + 1}
                </label>
                <input
                  id={`name-${row.key}`}
                  value={row.hebrewName}
                  onChange={(event) => updateRow(row.key, { hebrewName: event.target.value })}
                  placeholder="Enter Hebrew name *"
                  dir="auto"
                  maxLength={80}
                  autoComplete="off"
                  required
                />
                <button
                  type="button"
                  className="btn-remove"
                  onClick={() => removeRow(row.key)}
                  disabled={rows.length === 1}
                  aria-label={`Remove name ${index + 1}`}
                  title="Remove"
                >
                  <Minus size={16} />
                  <span>Remove</span>
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn-add"
            onClick={addRow}
            disabled={rows.length >= MAX_NAMES}
          >
            <Plus size={18} />
            Add another name
          </button>
        </fieldset>

        <fieldset className="panel">
          <legend>
            <span className="panel-title">Your details</span>
            <span className="panel-hint">Your receipt will be emailed to this address.</span>
          </legend>
          <div className="donor-grid">
            <input
              value={donorName}
              onChange={(event) => setDonorName(event.target.value)}
              placeholder="Your full name *"
              autoComplete="name"
              required
            />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Your email address *"
              autoComplete="email"
              required
            />
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Phone (optional)"
              autoComplete="tel"
            />
          </div>
        </fieldset>

        {props.allowExtraDonation ? (
          <div className="extra-row">
            <label htmlFor="extra-donation">
              <strong>Add an additional donation</strong>
              <span>Optional — supports the shul&apos;s charity fund.</span>
            </label>
            <div className="money-input">
              <span>$</span>
              <input
                id="extra-donation"
                type="number"
                inputMode="decimal"
                min={0}
                step={1}
                value={extraDollars}
                onChange={(event) => setExtraDollars(event.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        ) : null}

        <div className="totals">
          <div className="total-line">
            <span>
              {filledRows.length} {filledRows.length === 1 ? "name" : "names"} ×{" "}
              {formatMoney(props.pricePerPersonCents)}
            </span>
            <span>{formatMoney(totals.namesTotal)}</span>
          </div>
          {extraCents > 0 ? (
            <div className="total-line">
              <span>Additional donation</span>
              <span>{formatMoney(extraCents)}</span>
            </div>
          ) : null}
          {props.allowFeeCover ? (
            <label className="total-line fee-line">
              <span>
                <input
                  type="checkbox"
                  checked={coverFees}
                  onChange={(event) => setCoverFees(event.target.checked)}
                />
                Cover transaction fee
                <small>Support {props.organizationName} by covering card processing fees.</small>
              </span>
              <span>{formatMoney(totals.fee)}</span>
            </label>
          ) : null}
          <div className="total-line grand">
            <span>Total</span>
            <strong>{formatMoney(totals.total)}</strong>
          </div>
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        <button className="checkout-button" type="submit" disabled={submitting}>
          <Lock size={18} />
          {submitting ? "Redirecting to secure payment…" : props.submitLabel}
        </button>
        <p className="secure-note">Payments are processed securely by Stripe. You will be redirected to complete payment.</p>
      </form>
    </>
  );
}
