import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import type { ColumnType } from "./schema";

/** SHA-256 hex digest of `salt:value`. Synchronous, identical in browser and Node. */
export function hashValue(value: string, salt: string): string {
  return bytesToHex(sha256(utf8ToBytes(`${salt}:${value}`)));
}

function maskWord(word: string): string {
  const chars = Array.from(word);
  if (chars.length <= 1) return "*";
  return chars[0] + "*".repeat(Math.min(chars.length - 1, 8));
}

/** Hides content while keeping a recognisable shape. */
export function maskValue(value: string, type: ColumnType): string {
  if (value === "") return "";
  switch (type) {
    case "email": {
      const at = value.lastIndexOf("@");
      if (at <= 0) return maskWord(value);
      return `${Array.from(value)[0]}*****${value.slice(at)}`;
    }
    case "id": {
      const chars = Array.from(value);
      const keep = Math.min(4, Math.max(1, Math.floor(chars.length / 3)));
      return "*".repeat(chars.length - keep) + chars.slice(-keep).join("");
    }
    case "date": {
      // Keep the year only, whatever the format.
      const year = /\d{4}/.exec(value)?.[0];
      return year ? `${year}-**-**` : "****-**-**";
    }
    default:
      return value
        .split(/(\s+)/)
        .map((part) => (/^\s+$/.test(part) || part === "" ? part : maskWord(part)))
        .join("");
  }
}

/**
 * Laplace scale for differential-privacy-style noise:
 * sensitivity is 1% of the column range, divided by ε.
 */
export function laplaceScale(range: number, epsilon: number): number {
  const sensitivity = Math.max(Math.abs(range) * 0.01, 1e-9);
  return sensitivity / epsilon;
}
