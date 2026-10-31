import crypto from "node:crypto";

/* RFC 4648 base32 (no padding) for TOTP secrets. */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of s.toUpperCase().replace(/[^A-Z2-7]/g, "")) {
    const idx = B32.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** RFC 6238 TOTP — HMAC-SHA1, 6 digits, 30s step (standard authenticator-app defaults). */
export function totp(secretB32: string, timestampMs = Date.now(), step = 30, digits = 6): string {
  const counter = Math.floor(timestampMs / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const key = base32Decode(secretB32);
  const sig = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = sig[sig.length - 1] & 0xf;
  const code =
    ((sig[offset] & 0x7f) << 24) |
    ((sig[offset + 1] & 0xff) << 16) |
    ((sig[offset + 2] & 0xff) << 8) |
    (sig[offset + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, "0");
}

/** Verify a 6-digit code with ±1 step (±30s clock drift). */
export function verifyTotp(secretB32: string, code: string): boolean {
  const clean = code.replace(/\D/g, "");
  if (clean.length !== 6) return false;
  for (const drift of [-1, 0, 1]) {
    if (totp(secretB32, Date.now() + drift * 30_000) === clean) return true;
  }
  return false;
}

export function newTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function otpauthUri(params: { label: string; secret: string; issuer: string }): string {
  return (
    `otpauth://totp/${encodeURIComponent(params.issuer)}:${encodeURIComponent(params.label)}` +
    `?secret=${params.secret}&issuer=${encodeURIComponent(params.issuer)}&algorithm=SHA1&digits=6&period=30`
  );
}
