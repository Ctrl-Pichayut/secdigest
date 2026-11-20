const CVE_PATTERN = /\bCVE-(\d{4})-(\d{4,7})\b/gi;
const MIN_CVE_YEAR = 1999;
const MAX_CVE_YEAR = 2100;

/**
 * Extracts valid CVE identifiers from one or more text strings, normalized to
 * uppercase and deduplicated in order of first appearance.
 */
export function extractCveIds(
  ...texts: (string | null | undefined)[]
): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  for (const text of texts) {
    if (!text) continue;
    const regex = new RegExp(CVE_PATTERN.source, CVE_PATTERN.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const year = Number.parseInt(match[1], 10);
      if (year < MIN_CVE_YEAR || year > MAX_CVE_YEAR) {
        continue;
      }
      const normalized = `CVE-${match[1]}-${match[2]}`.toUpperCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        results.push(normalized);
      }
    }
  }

  return results;
}

/**
 * Builds the NVD vulnerability detail URL for a CVE identifier.
 */
export function nvdUrl(id: string): string {
  return `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(id)}`;
}
