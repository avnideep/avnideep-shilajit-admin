// JWT Utilities - HMAC-SHA256 for Cloudflare Workers
// No external dependencies - uses Web Crypto API

function base64UrlEncode(str) {
  const uint8 = new TextEncoder().encode(str);
  const base64 = btoa(String.fromCharCode(...uint8));
  return base64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const binaryStr = atob(str);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

async function hmacSha256(secret, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const sigStr = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return sigStr.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export async function signJWT(payload, secret, expiresIn = "24h") {
  const header = { alg: "HS256", typ: "JWT" };

  let exp = Math.floor(Date.now() / 1000);
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (match) {
    const num = parseInt(match[1]);
    const unit = match[2];
    const mult = { s: 1, m: 60, h: 3600, d: 86400 };
    exp += num * (mult[unit] || 3600);
  } else {
    exp += 86400;
  }

  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = { ...payload, iat: now, exp };

  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(tokenPayload));
  const signature = await hmacSha256(secret, headerEncoded + "." + payloadEncoded);

  return headerEncoded + "." + payloadEncoded + "." + signature;
}

export async function verifyJWT(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerEncoded, payloadEncoded, signature] = parts;

    const expectedSig = await hmacSha256(secret, headerEncoded + "." + payloadEncoded);
    if (signature !== expectedSig) return null;

    const payloadStr = base64UrlDecode(payloadEncoded);
    const payload = JSON.parse(payloadStr);

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;

    return payload;
  } catch (err) {
    console.error("JWT verify error:", err);
    return null;
  }
}
