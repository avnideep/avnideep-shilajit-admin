// Razorpay Handler - Order Creation, Verification, Webhook Forwarding
import { success, error } from "../utils/response.js";

// RAZORPAY API
const RAZORPAY_API = "https://api.razorpay.com/v1";

// Helper: Razorpay API call with Basic Auth

// ============================================================
// CREATE RAZORPAY ORDER
// Called from landing page when customer selects Razorpay payment
// ============================================================
export async function handleCreateRazorpayOrder(request, env) {
  try {
    const body = await request.json();
    const { amount, currency, receipt, customer } = body;

    if (!amount || amount <= 0) {
      return error("Amount is required and must be > 0", 400);
    }

    const keyId = env.RAZORPAY_KEY_ID;
    const keySecret = env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return error("Razorpay not configured on server", 503);
    }

    // Check if Razorpay is enabled in settings
    try {
      const settings = await env.DB.prepare(
        "SELECT enabled FROM payment_settings WHERE provider = ?"
      ).bind("razorpay").first();
      if (settings && !(settings.enabled === 1 || settings.enabled === true)) {
        return error("Razorpay payments are currently disabled", 503);
      }
    } catch (dbErr) {
      // Table might not exist - proceed anyway
      console.log("RAZORPAY_SETTINGS_CHECK_FAILED", String(dbErr.message || dbErr));
    }

    // Amount in paise (Razorpay uses smallest currency unit)
    const amountPaise = Math.round(amount * 100);
    const receiptId = receipt || `rcpt_${Date.now()}`;

    // Create order via Razorpay API
    const credentials = btoa(keyId + ":" + keySecret);
    const res = await fetch(RAZORPAY_API + "/orders", {
      method: "POST",
      headers: {
        "Authorization": "Basic " + credentials,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: currency || "INR",
        receipt: receiptId,
        notes: customer ? {
          name: customer.name || "",
          phone: customer.phone || "",
          email: customer.email || ""
        } : {}
      })
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("RAZORPAY_CREATE_ORDER_FAILED", data);
      return error(data.error?.description || data.message || "Failed to create Razorpay order", 502);
    }

    return success({
      id: data.id,
      amount: data.amount,
      currency: data.currency,
      receipt: data.receipt,
      status: data.status,
      key_id: keyId
    });
  } catch (err) {
    console.error("Create Razorpay order error:", err);
    return error("Failed to create payment order", 500);
  }
}

// ============================================================
// VERIFY PAYMENT SIGNATURE
// Called from landing page after Razorpay Checkout success
// ============================================================
export async function handleVerifyPayment(request, env) {
  try {
    const body = await request.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return error("Missing payment verification fields", 400);
    }

    const keySecret = env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return error("Razorpay not configured on server", 503);
    }

    // Generate expected signature: HMAC SHA256(order_id + "|" + payment_id, key_secret)
    const message = razorpay_order_id + "|" + razorpay_payment_id;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(keySecret);
    const messageData = encoder.encode(message);

    const cryptoKey = await crypto.subtle.importKey(
      "raw", keyData,
      { name: "HMAC", hash: "SHA-256" },
      false, ["sign"]
    );

    const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
    const expectedSignature = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    if (expectedSignature !== razorpay_signature) {
      console.error("RAZORPAY_SIGNATURE_MISMATCH", {
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id
      });
      return error("Payment signature verification failed", 400);
    }

    // Also fetch payment details from Razorpay to confirm capture status
    const keyId = env.RAZORPAY_KEY_ID;
    const credentials = btoa(keyId + ":" + keySecret);
    const paymentRes = await fetch(RAZORPAY_API + "/payments/" + razorpay_payment_id, {
      headers: { "Authorization": "Basic " + credentials }
    });

    let paymentStatus = "paid";
    let paymentCaptured = true;

    if (paymentRes.ok) {
      const paymentData = await paymentRes.json();
      paymentStatus = paymentData.status || "paid";
      paymentCaptured = paymentData.captured === true || paymentData.status === "captured";
    }

    return success({
      verified: true,
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id,
      payment_status: paymentStatus,
      captured: paymentCaptured
    });
  } catch (err) {
    console.error("Verify payment error:", err);
    return error("Payment verification failed: " + String(err.message || err), 500);
  }
}

// ============================================================
// SAVE ORDER AFTER VERIFIED PAYMENT
// Called from landing page after payment verification succeeds
// Saves the complete order to D1
// ============================================================
export async function handleSaveRazorpayOrder(request, env) {
  try {
    const body = await request.json();
    const {
      order_id, name, phone, pincode, address, amount,
      product, razorpay_order_id, razorpay_payment_id, razorpay_signature,
      reward_id, reward_amount, page_url, source
    } = body;

    if (!order_id || !name || !phone || !amount) {
      return error("Missing required fields", 400);
    }

    // Check duplicate
    const existing = await env.DB.prepare(
      "SELECT order_id FROM orders WHERE order_id = ?"
    ).bind(order_id).first();

    if (existing) {
      // Order already saved (e.g. fire-and-forget / advance flow) - link payment info
      try {
        await env.DB.prepare(
          `UPDATE orders SET
            razorpay_order_id = ?,
            razorpay_payment_id = ?,
            razorpay_signature = ?,
            payment_status = 'paid',
            payment_captured = 1,
            webhook_verified = 1,
            status = CASE WHEN status IN ('payment_pending', 'pending', 'prepaid') THEN 'paid' ELSE status END,
            updated_at = ?
          WHERE order_id = ?`
        ).bind(
          razorpay_order_id || "",
          razorpay_payment_id || "",
          razorpay_signature || "",
          new Date().toISOString(),
          order_id
        ).run();
      } catch (updErr) {
        console.error("SAVE_RZR_ORDER_UPDATE_FAILED", String(updErr.message || updErr));
      }
      return success({
        saved: true,
        duplicate: true,
        updated: true,
        order_id: order_id,
        message: "Order payment linked"
      });
    }

    const now = new Date().toISOString();
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";

    await env.DB.prepare(
      `INSERT INTO orders (
        order_id, name, phone, pincode, address,
        payment_method, amount, product, status, source, page_url,
        razorpay_order_id, razorpay_payment_id, razorpay_signature,
        payment_status, payment_captured,
        reward_id, reward_amount,
        created_at, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      order_id,
      name,
      phone,
      pincode || "",
      address || "",
      "razorpay",
      amount,
      product || "Avnideep 6Pro Vitality Shilajit Capsules",
      "paid",
      source || "",
      page_url || "",
      razorpay_order_id || "",
      razorpay_payment_id || "",
      razorpay_signature || "",
      "paid",
      1,
      reward_id || "",
      reward_amount || 0,
      now,
      ip,
      request.headers.get("User-Agent") || ""
    ).run();

    return success({
      saved: true,
      order_id: order_id,
      message: "Order saved successfully with Razorpay payment"
    });
  } catch (err) {
    console.error("Save Razorpay order error:", err);
    return error("Failed to save order", 500);
  }
}
