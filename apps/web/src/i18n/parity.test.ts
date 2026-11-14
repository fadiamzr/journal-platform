import { describe, it, expect } from "vitest";
import enMessages from "../../messages/en.json";
import frMessages from "../../messages/fr.json";
import arMessages from "../../messages/ar.json";

function getLeafKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  let keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullPath = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      keys = keys.concat(getLeafKeys(v as Record<string, unknown>, fullPath));
    } else {
      keys.push(fullPath);
    }
  }
  return keys;
}

describe("i18n Message Parity", () => {
  const enKeys = getLeafKeys(enMessages).sort();
  const frKeys = getLeafKeys(frMessages).sort();
  const arKeys = getLeafKeys(arMessages).sort();

  it("ensures French translations contain every key present in English", () => {
    const missingInFr = enKeys.filter((k) => !frKeys.includes(k));
    const extraInFr = frKeys.filter((k) => !enKeys.includes(k));

    expect(missingInFr, `Missing in fr.json: ${missingInFr.join(", ")}`).toEqual([]);
    expect(extraInFr, `Unexpected extra keys in fr.json: ${extraInFr.join(", ")}`).toEqual([]);
  });

  it("ensures Arabic translations contain every key present in English", () => {
    const missingInAr = enKeys.filter((k) => !arKeys.includes(k));
    const extraInAr = arKeys.filter((k) => !enKeys.includes(k));

    expect(missingInAr, `Missing in ar.json: ${missingInAr.join(", ")}`).toEqual([]);
    expect(extraInAr, `Unexpected extra keys in ar.json: ${extraInAr.join(", ")}`).toEqual([]);
  });

  it("confirms identical key counts across all three locales", () => {
    expect(frKeys.length).toBe(enKeys.length);
    expect(arKeys.length).toBe(enKeys.length);
  });
});
