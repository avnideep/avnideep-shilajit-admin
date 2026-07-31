// Admin API Worker - Main Router
// Cloudflare Worker for admin.avnideepayurveda.in

import { authenticate, handleLogin } from "./handlers/auth.js";
import { handleListOrders, handleOrderDetail, handleUpdateStatus, handleDeleteOrders, handleExportOrders } from "./handlers/orders.js";
import { handleGetPaymentSettings, handleUpdatePaymentSettings, handleTestRazorpayConnection, handleGetPublicPaymentConfig } from "./handlers/paymentSettings.js";
import { handleAnalytics } from "./handlers/analytics.js";
import { handleGetSeoSettings, handleUpdateSeoSettings, handleGetGeneralSettings, handleUpdateGeneralSettings } from "./handlers/seoSettings.js";
import { handleCreateRazorpayOrder, handleVerifyPayment, handleSaveRazorpayOrder } from "./handlers/razorpay.js";
import { handleDashboard } from "./handlers/dashboard.js";
import { handleListRewards, handleRewardDetail, handleUpdateRewardStatus } from "./handlers/rewards.js";
import { success, error, corsHeaders, addCorsToResponse } from "./utils/response.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    // CORS preflight
    // Compute CORS headers once for all responses
    const requestOrigin = request.headers.get("Origin");
    const cors = corsHeaders(env, requestOrigin);

    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: cors
      });
    }

    try {
      // === PUBLIC ROUTES (no auth needed) ===

      // Health check
      if (path === "/api/admin/health" || path === "/") {
        return addCorsToResponse(success({ status: "ok", service: "avnideep-admin-api", version: "1.0.0" }), cors);
      }

      // Public payment config (no auth needed - used by checkout page)
      if (path === "/api/admin/payment-config" && method === "GET") {
        return addCorsToResponse(await handleGetPublicPaymentConfig(request, env), cors);
      }

      // Login
      if (path === "/api/admin/auth/login" && method === "POST") {
        return addCorsToResponse(await handleLogin(request, env), cors);
      }

      // === RAZORPAY (public - used by landing page checkout) ===

      // Create Razorpay order
      if (path === "/api/admin/razorpay/create-order" && method === "POST") {
        return addCorsToResponse(await handleCreateRazorpayOrder(request, env), cors);
      }

      // Verify Razorpay payment signature
      if (path === "/api/admin/razorpay/verify" && method === "POST") {
        return addCorsToResponse(await handleVerifyPayment(request, env), cors);
      }

      // Save order after Razorpay payment
      if (path === "/api/admin/razorpay/save-order" && method === "POST") {
        return addCorsToResponse(await handleSaveRazorpayOrder(request, env), cors);
      }

      // === AUTHENTICATED ROUTES ===

      // Verify JWT token
      if (path === "/api/admin/auth/verify" && method === "GET") {
        const payload = await authenticate(request, env);
        if (!payload) return addCorsToResponse(error("Unauthorized", 401), cors);
        return addCorsToResponse(success({ valid: true, email: payload.email }), cors);
      }

      // Authenticate all subsequent routes
      const authPayload = await authenticate(request, env);
      if (!authPayload) {
        return addCorsToResponse(error("Unauthorized - Invalid or expired token", 401), cors);
      }

      // === DASHBOARD ===
      if (path === "/api/admin/dashboard" && method === "GET") {
        return addCorsToResponse(await handleDashboard(request, env, url), cors);
      }

      // === ORDERS ===

      // Export orders (must come before /:id to avoid conflict)
      if (path === "/api/admin/orders/export" && method === "GET") {
        return addCorsToResponse(await handleExportOrders(request, env, url), cors);
      }

      // List orders with pagination, search, filter
      if (path === "/api/admin/orders" && method === "GET") {
        return addCorsToResponse(await handleListOrders(request, env, url), cors);
      }

      // Delete multiple orders (POST with array of IDs)
      if (path === "/api/admin/orders/delete" && method === "POST") {
        return addCorsToResponse(await handleDeleteOrders(request, env), cors);
      }

      // Single order detail
      const orderMatch = path.match(/^\/api\/admin\/orders\/([^\/]+)$/);
      if (orderMatch) {
        const orderId = orderMatch[1];
        if (method === "GET") {
          return addCorsToResponse(await handleOrderDetail(request, env, orderId), cors);
        }
      }

      // Update order status
      const statusMatch = path.match(/^\/api\/admin\/orders\/([^\/]+)\/status$/);
      if (statusMatch && method === "PATCH") {
        const orderId = statusMatch[1];
        return addCorsToResponse(await handleUpdateStatus(request, env, orderId), cors);
      }

      // === ANALYTICS ===
      if (path === "/api/admin/analytics" && method === "GET") {
        return addCorsToResponse(await handleAnalytics(request, env, url), cors);
      }

      // === SEO SETTINGS ===
      if (path === "/api/admin/seo" && method === "GET") {
        return addCorsToResponse(await handleGetSeoSettings(request, env, url), cors);
      }
      if (path === "/api/admin/seo" && method === "PUT") {
        return addCorsToResponse(await handleUpdateSeoSettings(request, env, url), cors);
      }
      // === GENERAL SETTINGS ===
      if (path === "/api/admin/settings" && method === "GET") {
        return addCorsToResponse(await handleGetGeneralSettings(request, env, url), cors);
      }
      if (path === "/api/admin/settings" && method === "PUT") {
        return addCorsToResponse(await handleUpdateGeneralSettings(request, env, url), cors);
      }

      // === PAYMENT SETTINGS ===

      // Get payment settings
      if (path === "/api/admin/payment-settings" && method === "GET") {
        return addCorsToResponse(await handleGetPaymentSettings(request, env), cors);
      }

      // Update payment settings
      if (path === "/api/admin/payment-settings" && method === "PUT") {
        return addCorsToResponse(await handleUpdatePaymentSettings(request, env), cors);
      }

      // Test Razorpay connection
      if (path === "/api/admin/payment-settings/test" && method === "GET") {
        return addCorsToResponse(await handleTestRazorpayConnection(request, env), cors);
      }

      // === REWARDS ===

      // List rewards with pagination, search, filter
      if (path === "/api/admin/rewards" && method === "GET") {
        return addCorsToResponse(await handleListRewards(request, env, url), cors);
      }

      // Single reward detail
      const rewardMatch = path.match(/^\/api\/admin\/rewards\/([^\/]+)$/);
      if (rewardMatch && method === "GET") {
        const rewardId = rewardMatch[1];
        return addCorsToResponse(await handleRewardDetail(request, env, rewardId), cors);
      }

      // Update reward status
      const rewardStatusMatch = path.match(/^\/api\/admin\/rewards\/([^\/]+)\/status$/);
      if (rewardStatusMatch && method === "PATCH") {
        const rewardId = rewardStatusMatch[1];
        return addCorsToResponse(await handleUpdateRewardStatus(request, env, rewardId), cors);
      }

      // 404
      return addCorsToResponse(error("Route not found", 404), cors);

    } catch (err) {
      console.error("Admin API Error:", err);
      return addCorsToResponse(error("Internal server error", 500), cors);
    }
  }
};
