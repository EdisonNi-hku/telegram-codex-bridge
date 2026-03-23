import { normalizeWhitespace, truncateText } from "./text.js";

const AUTO_SESSION_TITLE_LIMIT = 48;
const EDGE_PUNCTUATION_PATTERN = /^[\s"'`.,;:!?()[\]{}<>|/\\-]+|[\s"'`.,;:!?()[\]{}<>|/\\-]+$/gu;

export function sanitizeAutoSessionTitle(
  value: string | null | undefined,
  limit = AUTO_SESSION_TITLE_LIMIT
): string | null {
  if (!value) {
    return null;
  }

  const normalized = normalizeWhitespace(value).replace(EDGE_PUNCTUATION_PATTERN, "").trim();
  if (normalized.length === 0) {
    return null;
  }

  return truncateText(normalized, limit, "...");
}

export function resolveAutoSessionTitle(options: {
  threadName?: string | null | undefined;
  preview?: string | null | undefined;
  limit?: number | undefined;
}): string | null {
  const limit = options.limit ?? AUTO_SESSION_TITLE_LIMIT;
  return sanitizeAutoSessionTitle(options.threadName, limit)
    ?? sanitizeAutoSessionTitle(options.preview, limit);
}
