import fs from "node:fs/promises";
import path from "node:path";

import { defaultContent } from "@/data/site-content";
import type { SiteContent } from "@/types";

const dataDir = path.join(process.cwd(), "data");
const contentPath = path.join(dataDir, "site-content.json");

/**
 * Reads admin-edited overrides from `data/site-content.json` and merges them
 * onto the baked-in defaults. Any missing or blank field falls back to the
 * default so the page never renders empty copy.
 */
export async function getSiteContent(): Promise<SiteContent> {
  try {
    const raw = await fs.readFile(contentPath, "utf-8");
    const saved = JSON.parse(raw) as Partial<SiteContent>;
    return mergeContent(saved);
  } catch {
    return defaultContent;
  }
}

export async function saveSiteContent(input: Partial<SiteContent>): Promise<SiteContent> {
  const merged = mergeContent(input);
  await fs.mkdir(dataDir, { recursive: true });
  const tempPath = `${contentPath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(merged, null, 2)}\n`, "utf-8");
  await fs.rename(tempPath, contentPath);
  return merged;
}

function mergeContent(input: Partial<SiteContent>): SiteContent {
  return {
    organizationName: pick(input.organizationName, defaultContent.organizationName),
    campaignName: pick(input.campaignName, defaultContent.campaignName),
    shulWebsiteUrl: pick(input.shulWebsiteUrl, defaultContent.shulWebsiteUrl),
    shulWebsiteLabel: pick(input.shulWebsiteLabel, defaultContent.shulWebsiteLabel),
    rabbiName: pick(input.rabbiName, defaultContent.rabbiName),

    heroEyebrow: pick(input.heroEyebrow, defaultContent.heroEyebrow),
    pageTitle: pick(input.pageTitle, defaultContent.pageTitle),
    introTitle: pick(input.introTitle, defaultContent.introTitle),
    introBody: pick(input.introBody, defaultContent.introBody),

    deadlineIso: pickDate(input.deadlineIso, defaultContent.deadlineIso),
    deadlineLabel: pick(input.deadlineLabel, defaultContent.deadlineLabel),
    pricePerPersonCents: pickCents(input.pricePerPersonCents, defaultContent.pricePerPersonCents),
    allowExtraDonation: pickBool(input.allowExtraDonation, defaultContent.allowExtraDonation),
    allowFeeCover: pickBool(input.allowFeeCover, defaultContent.allowFeeCover),

    namesSectionTitle: pick(input.namesSectionTitle, defaultContent.namesSectionTitle),
    namesSectionHint: pick(input.namesSectionHint, defaultContent.namesSectionHint),
    nameExample: pick(input.nameExample, defaultContent.nameExample),
    submitLabel: pick(input.submitLabel, defaultContent.submitLabel),

    closedTitle: pick(input.closedTitle, defaultContent.closedTitle),
    closedBody: pick(input.closedBody, defaultContent.closedBody),
    successTitle: pick(input.successTitle, defaultContent.successTitle),
    successBody: pick(input.successBody, defaultContent.successBody),

    contactEmail: pick(input.contactEmail, defaultContent.contactEmail),
    footerNote: pick(input.footerNote, defaultContent.footerNote)
  };
}

/** Replaces `{rabbi}` placeholders in editable copy with the configured rabbi name. */
export function fillCopy(text: string, content: SiteContent): string {
  return text.replace(/\{rabbi\}/g, content.rabbiName);
}

/** Splits an editable multi-paragraph field on blank lines. */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function isSubmissionOpen(content: SiteContent, at = new Date()): boolean {
  return at.getTime() < new Date(content.deadlineIso).getTime();
}

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function pick(value: unknown, fallback: string): string {
  const cleaned = clean(value);
  return cleaned || fallback;
}

function pickDate(value: unknown, fallback: string): string {
  const cleaned = clean(value);
  if (!cleaned || Number.isNaN(new Date(cleaned).getTime())) {
    return fallback;
  }
  return cleaned;
}

function pickCents(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 100) return fallback;
  return Math.round(n);
}

function pickBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}
