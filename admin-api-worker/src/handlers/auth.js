// Auth Handler - Login, Verify, Middleware
import { signJWT, verifyJWT } from "../utils/jwt.js";
import { success, error } from "../utils/response.js";

// SHA-256 hash utility using Web Crypto API
async function sha256Hex(data) {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(data));
  const hex = Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  return hex;
}

export async function authenticate(request, env) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    const token = authHeader.slice(7);
    return await verifyJWT(token, env.JWT_SECRET);
  } catch (err) {
    console.error("Auth error:", err);
    return null;
  }
}

export async function handleLogin(request, env) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return error("Email and password are required");
    }

    // Verify email (accepts registered email OR username)
    const allowedIdentities = [
      env.ADMIN_EMAIL,
      "AvnideepAyurveda"
    ].filter(Boolean);
    if (!allowedIdentities.includes(email)) {
      return error("Invalid credentials", 401);
    }

    // Verify password using SHA-256 salt:hash
    const storedCreds = env.ADMIN_PASSWORD_HASH;
    if (!storedCreds) {
      return error("Server configuration error", 500);
    }

    // Format: salt:hash (SHA-256 of salt+password)
    const parts = storedCreds.split(":");
    if (parts.length !== 2) {
      return error("Server configuration error", 500);
    }

    const salt = parts[0];
    const storedHash = parts[1];
    const inputHash = await sha256Hex(salt + password);

    // Constant-time comparison
    let match = true;
    if (inputHash.length !== storedHash.length) match = false;
    for (let i = 0; i < Math.max(inputHash.length, storedHash.length); i++) {
      if (inputHash[i] !== (storedHash[i] || '')) match = false;
    }

    if (!match) {
      return error("Invalid credentials", 401);
    }

    // Generate JWT
    const token = await signJWT(
      { email, role: "admin" },
      env.JWT_SECRET,
      "24h"
    );

    return success({
      token,
      email: env.ADMIN_EMAIL,
      expiresIn: "24h"
    });
  } catch (err) {
    console.error("Login error:", err);
    return error("Login failed", 500);
  }
}
