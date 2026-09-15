export type Gender = "male" | "female";

export type KapparotName = {
  gender: Gender;
  hebrewName: string;
};

export type DonorInfo = {
  name: string;
  email: string;
  phone?: string;
};

export type SubmissionStatus = "pending" | "paid" | "expired" | "canceled" | "refunded";

export type Submission = {
  id: string;
  status: SubmissionStatus;
  donor: DonorInfo;
  names: KapparotName[];
  pricePerPersonCents: number;
  namesTotalCents: number;
  extraDonationCents: number;
  coverFees: boolean;
  feeCoverCents: number;
  totalAmountCents: number;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  stripeCustomerId?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  paidAt?: string;
  /** Set by the admin once the rabbi has performed Kapparot for these names. */
  performed?: boolean;
  adminNotes?: string;
};

export type SubmissionsFile = {
  submissions: Submission[];
};

export type StripeEventsFile = {
  processedEventIds: string[];
};

export type CheckoutInput = {
  donor: DonorInfo;
  names: KapparotName[];
  extraDonationCents?: number;
  coverFees?: boolean;
};

export type SiteContent = {
  organizationName: string;
  campaignName: string;
  shulWebsiteUrl: string;
  shulWebsiteLabel: string;
  rabbiName: string;

  heroEyebrow: string;
  pageTitle: string;
  introTitle: string;
  /** Paragraphs separated by a blank line. */
  introBody: string;

  /** ISO 8601 with offset, e.g. 2026-09-20T14:00:00-04:00 */
  deadlineIso: string;
  /** Human-readable deadline shown in the notice, e.g. "2:00 PM (New York time) on Sunday, Erev Yom Kippur, September 20th 2026" */
  deadlineLabel: string;
  pricePerPersonCents: number;
  allowExtraDonation: boolean;
  allowFeeCover: boolean;

  namesSectionTitle: string;
  namesSectionHint: string;
  nameExample: string;
  submitLabel: string;

  closedTitle: string;
  closedBody: string;
  successTitle: string;
  successBody: string;

  contactEmail: string;
  footerNote: string;
};
