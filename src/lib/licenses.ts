import { v4 as uuidv4 } from "uuid";

export function generateLicenseKey(prefix: string = "FJ") {
  const raw = uuidv4().replace(/-/g, "").toUpperCase();
  const chunks = [
    raw.slice(0, 4),
    raw.slice(4, 8),
    raw.slice(8, 12),
    raw.slice(12, 16),
  ];

  return `${prefix}-${chunks.join("-")}`;
}
