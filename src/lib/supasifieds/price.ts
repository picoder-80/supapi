export function formatPiPriceDisplay(raw: string | null | undefined, fallback = "—"): string {
  const value = String(raw ?? "").trim();
  if (!value) return fallback;

  const lower = value.toLowerCase();
  if (value.includes("π") || lower.includes("negotiable") || lower.includes("free") || lower.includes("contact")) {
    return value;
  }

  if (/^\d+([.,]\d+)?(\s*\/\s*[a-zA-Z]+)?$/.test(value)) {
    return `${value.replace(/\s+/g, " ").trim()} π`;
  }

  return value;
}
