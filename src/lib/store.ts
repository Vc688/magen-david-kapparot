import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { feeCoverCents } from "@/lib/money";
import type {
  CheckoutInput,
  KapparotName,
  SiteContent,
  StripeEventsFile,
  Submission,
  SubmissionStatus,
  SubmissionsFile
} from "@/types";

/** Stripe requires Checkout `expires_at` to be at least 30 minutes out. */
const CHECKOUT_MINUTES = 31;
export const MAX_NAMES = 20;
const MAX_NAME_LENGTH = 80;
const MAX_EXTRA_DONATION_CENTS = 100_000_00;

const dataDir = path.join(process.cwd(), "data");
const submissionsPath = path.join(dataDir, "submissions.json");
const eventsPath = path.join(dataDir, "stripe-events.json");

let writeQueue: Promise<unknown> = Promise.resolve();

async function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(fn, fn);
  writeQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function ensureDataFiles() {
  await fs.mkdir(dataDir, { recursive: true });
  await ensureJson<SubmissionsFile>(submissionsPath, { submissions: [] });
  await ensureJson<StripeEventsFile>(eventsPath, { processedEventIds: [] });
}

async function ensureJson<T>(filePath: string, fallback: T) {
  try {
    await fs.access(filePath);
  } catch {
    await writeJson(filePath, fallback);
  }
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(filePath: string, data: T): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
  await fs.rename(tempPath, filePath);
}

function nowIso() {
  return new Date().toISOString();
}

function checkoutExpiry() {
  return new Date(Date.now() + CHECKOUT_MINUTES * 60 * 1000).toISOString();
}

function isPendingExpired(submission: Submission, at = new Date()): boolean {
  return (
    submission.status === "pending" &&
    Boolean(submission.expiresAt) &&
    new Date(submission.expiresAt!) <= at
  );
}

function cleanExpired(submissions: Submission[]): boolean {
  const at = new Date();
  let changed = false;
  for (const submission of submissions) {
    if (isPendingExpired(submission, at)) {
      submission.status = "expired";
      submission.updatedAt = nowIso();
      changed = true;
    }
  }
  return changed;
}

/**
 * Validates and normalizes the names list from the public form. Throws a
 * user-facing message on bad input so the API can return it directly.
 */
export function normalizeNames(input: unknown): KapparotName[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error("Please enter at least one name.");
  }
  if (input.length > MAX_NAMES) {
    throw new Error(`You can submit up to ${MAX_NAMES} names at once.`);
  }
  return input.map((raw, index) => {
    const gender = raw?.gender;
    const hebrewName = typeof raw?.hebrewName === "string" ? raw.hebrewName.trim() : "";
    if (gender !== "male" && gender !== "female") {
      throw new Error(`Please select male or female for name #${index + 1}.`);
    }
    if (!hebrewName) {
      throw new Error(`Please enter the Hebrew name for name #${index + 1}.`);
    }
    if (hebrewName.length > MAX_NAME_LENGTH) {
      throw new Error(`Name #${index + 1} is too long.`);
    }
    return { gender, hebrewName };
  });
}

export function normalizeExtraDonation(input: unknown, allowed: boolean): number {
  if (!allowed) return 0;
  const cents = Math.round(Number(input) || 0);
  if (cents < 0) return 0;
  if (cents > MAX_EXTRA_DONATION_CENTS) {
    throw new Error("That additional donation amount is too large for online checkout.");
  }
  return cents;
}

export async function getSubmissions(): Promise<Submission[]> {
  await ensureDataFiles();
  const file = await readJson<SubmissionsFile>(submissionsPath, { submissions: [] });
  if (cleanExpired(file.submissions)) {
    await writeJson(submissionsPath, file);
  }
  return file.submissions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getSubmission(id: string): Promise<Submission | undefined> {
  const submissions = await getSubmissions();
  return submissions.find((submission) => submission.id === id);
}

export async function getSubmissionByCheckoutSession(
  checkoutSessionId: string
): Promise<Submission | undefined> {
  const submissions = await getSubmissions();
  return submissions.find((submission) => submission.stripeCheckoutSessionId === checkoutSessionId);
}

/**
 * Creates a pending submission with all amounts computed server-side from the
 * current site settings — the client's subtotal is never trusted.
 */
export async function createSubmission(input: CheckoutInput, content: SiteContent): Promise<Submission> {
  return withWriteLock(async () => {
    await ensureDataFiles();
    const file = await readJson<SubmissionsFile>(submissionsPath, { submissions: [] });
    cleanExpired(file.submissions);

    const names = normalizeNames(input.names);
    const extraDonationCents = normalizeExtraDonation(input.extraDonationCents, content.allowExtraDonation);
    const pricePerPersonCents = content.pricePerPersonCents;
    const namesTotalCents = pricePerPersonCents * names.length;
    const netCents = namesTotalCents + extraDonationCents;
    const coverFees = content.allowFeeCover && Boolean(input.coverFees);
    const feeCents = coverFees ? feeCoverCents(netCents) : 0;

    const createdAt = nowIso();
    const submission: Submission = {
      id: `kap_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`,
      status: "pending",
      donor: input.donor,
      names,
      pricePerPersonCents,
      namesTotalCents,
      extraDonationCents,
      coverFees,
      feeCoverCents: feeCents,
      totalAmountCents: netCents + feeCents,
      createdAt,
      updatedAt: createdAt,
      expiresAt: checkoutExpiry()
    };
    file.submissions.unshift(submission);
    await writeJson(submissionsPath, file);
    return submission;
  });
}

export async function attachCheckoutSession(id: string, checkoutSessionId: string): Promise<void> {
  await updateSubmission(id, (submission) => {
    submission.stripeCheckoutSessionId = checkoutSessionId;
  });
}

export async function markSubmissionPaid(
  id: string,
  fields: {
    stripeCheckoutSessionId?: string;
    stripePaymentIntentId?: string;
    stripeCustomerId?: string;
  }
): Promise<void> {
  await updateSubmission(id, (submission) => {
    submission.status = "paid";
    submission.expiresAt = undefined;
    submission.paidAt = submission.paidAt || nowIso();
    submission.stripeCheckoutSessionId = fields.stripeCheckoutSessionId || submission.stripeCheckoutSessionId;
    submission.stripePaymentIntentId = fields.stripePaymentIntentId || submission.stripePaymentIntentId;
    submission.stripeCustomerId = fields.stripeCustomerId || submission.stripeCustomerId;
  });
}

export async function markCheckoutExpired(checkoutSessionId: string): Promise<void> {
  await withWriteLock(async () => {
    await ensureDataFiles();
    const file = await readJson<SubmissionsFile>(submissionsPath, { submissions: [] });
    const submission = file.submissions.find(
      (candidate) => candidate.stripeCheckoutSessionId === checkoutSessionId
    );
    if (submission && submission.status === "pending") {
      submission.status = "expired";
      submission.updatedAt = nowIso();
      submission.expiresAt = undefined;
      await writeJson(submissionsPath, file);
    }
  });
}

export async function updateSubmissionStatus(
  id: string,
  status: SubmissionStatus,
  fields: { adminNotes?: string; performed?: boolean } = {}
): Promise<Submission> {
  return updateSubmission(id, (submission) => {
    submission.status = status;
    if (fields.adminNotes !== undefined) {
      submission.adminNotes = fields.adminNotes;
    }
    if (fields.performed !== undefined) {
      submission.performed = fields.performed;
    }
    if (status !== "pending") {
      submission.expiresAt = undefined;
    }
    if (status === "paid" && !submission.paidAt) {
      submission.paidAt = nowIso();
    }
  });
}

export async function updateSubmission(
  id: string,
  mutate: (submission: Submission) => void
): Promise<Submission> {
  return withWriteLock(async () => {
    await ensureDataFiles();
    const file = await readJson<SubmissionsFile>(submissionsPath, { submissions: [] });
    const submission = file.submissions.find((candidate) => candidate.id === id);
    if (!submission) {
      throw new Error("Submission not found.");
    }
    mutate(submission);
    submission.updatedAt = nowIso();
    await writeJson(submissionsPath, file);
    return submission;
  });
}

export async function hasProcessedStripeEvent(eventId: string): Promise<boolean> {
  await ensureDataFiles();
  const file = await readJson<StripeEventsFile>(eventsPath, { processedEventIds: [] });
  return file.processedEventIds.includes(eventId);
}

export async function markStripeEventProcessed(eventId: string): Promise<void> {
  await withWriteLock(async () => {
    await ensureDataFiles();
    const file = await readJson<StripeEventsFile>(eventsPath, { processedEventIds: [] });
    if (!file.processedEventIds.includes(eventId)) {
      file.processedEventIds.push(eventId);
      await writeJson(eventsPath, file);
    }
  });
}
