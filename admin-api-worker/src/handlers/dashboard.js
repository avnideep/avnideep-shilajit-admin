// Dashboard Handler - Stats, Aggregations
import { success, error } from "../utils/response.js";
import { buildOrderFilters, buildWhereClause } from "../utils/db.js";

function normalizeStatus(status, paymentStatus = "") {
  const s = String(status || "").toLowerCase().trim();
  const p = String(paymentStatus || "").toLowerCase().trim();

  if (p === "paid" || p === "captured" || p === "authorized") return "confirmed";
  if (p === "failed" || p === "refunded" || p === "cancelled") return "cancelled";

  if (["confirmed", "shipped", "delivered", "completed", "complete", "success", "paid"].includes(s)) return "confirmed";
  if (["shipped", "dispatched"].includes(s)) return "shipped";
  if (["delivered", "complete"].includes(s)) return "delivered";
  if (["cancelled", "canceled", "failed", "payment_failed", "refunded", "refund"].includes(s)) return "cancelled";
  if (["cod_order", "pending", "payment_pending", "payment_processing", "processing", "new", "created"].includes(s)) return "pending";

  return "pending";
}

export async function handleDashboard(request, env, url) {
  try {
    const period = url.searchParams.get("period") || "all";

    let dateFilter = "";
    let dateParam = null;
    const now = new Date();

    if (period === "today") {
      const today = now.toISOString().slice(0, 10);
      dateFilter = " WHERE created_at >= ?";
      dateParam = today;
    } else if (period === "week") {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter = " WHERE created_at >= ?";
      dateParam = weekAgo.toISOString();
    } else if (period === "month") {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      dateFilter = " WHERE created_at >= ?";
      dateParam = monthAgo.toISOString();
    }

    const queries = [];

    if (dateParam) {
      queries.push(env.DB.prepare("SELECT COUNT(*) as total FROM orders" + dateFilter).bind(dateParam).first());
    } else {
      queries.push(env.DB.prepare("SELECT COUNT(*) as total FROM orders").first());
    }

    if (dateParam) {
      queries.push(env.DB.prepare("SELECT COALESCE(SUM(CASE WHEN payment_status = 'paid' OR payment_status = 'captured' THEN amount ELSE 0 END), 0) as revenue FROM orders WHERE created_at >= ?").bind(dateParam).first());
    } else {
      queries.push(env.DB.prepare("SELECT COALESCE(SUM(CASE WHEN payment_status = 'paid' OR payment_status = 'captured' THEN amount ELSE 0 END), 0) as revenue FROM orders").first());
    }

    let statusQuery = "SELECT status, COUNT(*) as count FROM orders";
    let statusParams = [];
    if (dateParam) {
      statusQuery += " WHERE created_at >= ?";
      statusParams.push(dateParam);
    }
    statusQuery += " GROUP BY status";
    queries.push(env.DB.prepare(statusQuery).bind(...statusParams).all());

    const today = now.toISOString().slice(0, 10);
    queries.push(env.DB.prepare("SELECT COUNT(*) as count FROM orders WHERE created_at >= ?").bind(today).first());

    if (dateParam) {
      queries.push(env.DB.prepare("SELECT COUNT(*) as count FROM orders WHERE (payment_status IS NULL OR payment_status = '' OR payment_status IN ('pending','processing','failed')) AND status NOT IN ('cancelled','canceled','refunded') AND created_at >= ?").bind(dateParam).first());
    } else {
      queries.push(env.DB.prepare("SELECT COUNT(*) as count FROM orders WHERE (payment_status IS NULL OR payment_status = '' OR payment_status IN ('pending','processing','failed')) AND status NOT IN ('cancelled','canceled','refunded')").first());
    }

    // Spin/No-Spin queries
    let spinDateFilter = "";
    let spinDateParam = null;
    if (dateParam) {
      spinDateFilter = " AND created_at >= ?";
      spinDateParam = dateParam;
    }

    // Orders with reward (spin)
    let spinQuery = "SELECT COUNT(*) as count FROM orders WHERE reward_id IS NOT NULL AND reward_id != ''" + spinDateFilter;
    if (spinDateParam) {
      queries.push(env.DB.prepare(spinQuery).bind(spinDateParam).first());
    } else {
      queries.push(env.DB.prepare(spinQuery).first());
    }

    // Orders without reward (no-spin)
    let noSpinQuery = "SELECT COUNT(*) as count FROM orders WHERE (reward_id IS NULL OR reward_id = '')" + spinDateFilter;
    if (spinDateParam) {
      queries.push(env.DB.prepare(noSpinQuery).bind(spinDateParam).first());
    } else {
      queries.push(env.DB.prepare(noSpinQuery).first());
    }

    // Total reward amount given
    let rewardAmountQuery = "SELECT COALESCE(SUM(CAST(reward_amount AS REAL)), 0) as total_reward FROM orders WHERE reward_id IS NOT NULL AND reward_id != ''" + spinDateFilter;
    if (spinDateParam) {
      queries.push(env.DB.prepare(rewardAmountQuery).bind(spinDateParam).first());
    } else {
      queries.push(env.DB.prepare(rewardAmountQuery).first());
    }

    const results = await Promise.all(queries);
    const totalOrders = results[0]?.total || 0;
    const totalRevenue = results[1]?.revenue || 0;
    const statusCounts = {};
    const statusRows = results[2]?.results || [];
    for (const row of statusRows) {
      const normalized = normalizeStatus(row.status, row.payment_status);
      statusCounts[normalized] = (statusCounts[normalized] || 0) + Number(row.count || 0);
    }
    const statuses = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
    for (const s of statuses) { if (!statusCounts[s]) statusCounts[s] = 0; }
    const todayOrders = results[3]?.count || 0;
    const pendingOrders = results[4]?.count || 0;
    const spinOrders = results[5]?.count || 0;
    const noSpinOrders = results[6]?.count || 0;
    const totalRewardAmount = results[7]?.total_reward || 0;
    return success({ period, totalOrders, totalRevenue, todayOrders, statusCounts, pendingOrders, spinOrders, noSpinOrders, totalRewardAmount });
  } catch (err) {
    console.error("Dashboard error:", err);
    return error("Failed to fetch dashboard data", 500);
  }
}
