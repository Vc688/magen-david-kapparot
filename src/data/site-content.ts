import type { SiteContent } from "@/types";

/**
 * Default site copy and settings. Every field here can be overridden from the
 * admin dashboard ("Site content" tab), which writes to `data/site-content.json`.
 * If that file is missing or a field is blank, these defaults are used, so the
 * page always renders complete copy out of the box.
 *
 * Safe to edit this file directly for permanent default changes.
 */
export const defaultContent: SiteContent = {
  organizationName: "Congregation Magen David of West Deal",
  campaignName: "Kapparot 2026",
  shulWebsiteUrl: "https://westdealshul.org/",
  shulWebsiteLabel: "westdealshul.org",
  rabbiName: "Rabbi Saul Kassin",

  heroEyebrow: "Congregation Magen David of West Deal",
  pageTitle: "Kapparot 2026",
  introTitle: "Fulfill the custom of Kapparot 2026",
  introBody: [
    "You may appoint {rabbi} to perform Kapparot on your behalf so that you can fulfill the Misva of this holiday.",
    "If one cannot use a chicken for Kapparot, this custom can be observed by using money. The money should be given to a poor person as charity.",
    "If one performs Kapparot with money, this money cannot be counted toward his Ma'aser Kesafim (tithe of his income). The money serves as his atonement, as a kind of “ransom” for his life, and it must therefore not come from money that he would in any event have to give to charity. You can fulfill this custom of Kapparot by having {rabbi} distribute funds on your behalf to those in need."
  ].join("\n\n"),

  // Erev Yom Kippur 5787 — Sunday, September 20, 2026, 2:00 PM Eastern
  deadlineIso: "2026-09-20T14:00:00-04:00",
  deadlineLabel: "2:00 PM (New York time) on Sunday, Erev Yom Kippur, September 20th 2026",
  pricePerPersonCents: 2000,
  allowExtraDonation: true,
  allowFeeCover: true,

  namesSectionTitle: "Enter name(s)",
  namesSectionHint: "Enter the Hebrew name of each person below.",
  nameExample: "Moshe ben Frieda",
  submitLabel: "Continue to payment",

  closedTitle: "Kapparot submissions are now closed",
  closedBody:
    "The deadline for this year's Kapparot has passed. Gemar Hatima Tova — may you be sealed for a good year. If you have any questions, please contact the shul office.",
  successTitle: "Thank you — your Kapparot request has been received",
  successBody:
    "Your payment is complete. {rabbi} will perform Kapparot on behalf of the names below and distribute the funds to those in need. A receipt has been emailed to you. Gemar Hatima Tova!",

  contactEmail: "info@magendavid.net",
  footerNote:
    "Congregation Magen David of West Deal · 395 Deal Road, Ocean, NJ 07712 · (732) 531-3220"
};
