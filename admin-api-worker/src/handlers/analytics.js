// Analytics Handler - Stats, Aggregations, UTM, Devices, Top States
import { success, error } from "../utils/response.js";

function getDateRange(period) {
  const now = new Date();
  let from = null;
  if (period === "today") {
    from = now.toISOString().slice(0, 10);
  } else if (period === "week") {
    const d = new Date(now); d.setDate(d.getDate() - 7); from = d.toISOString();
  } else if (period === "month") {
    const d = new Date(now); d.setMonth(d.getMonth() - 1); from = d.toISOString();
  } else if (period === "quarter") {
    const d = new Date(now); d.setMonth(d.getMonth() - 3); from = d.toISOString();
  } else if (period === "year") {
    const d = new Date(now); d.setFullYear(d.getFullYear() - 1); from = d.toISOString();
  }
  return from;
}

// Simple browser detection from user_agent string
function detectBrowser(ua) {
  if (!ua) return "Unknown";
  if (ua.includes("Chrome") && !ua.includes("Edg")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("OPR") || ua.includes("Opera")) return "Opera";
  if (ua.includes("UCBrowser")) return "UC Browser";
  return "Other";
}

function detectDevice(ua) {
  if (!ua) return "Unknown";
  if (/Mobile|Android|iPhone|iPad|iPod/i.test(ua)) {
    if (/iPad|Tablet/i.test(ua)) return "Tablet";
    return "Mobile";
  }
  return "Desktop";
}

// Guess state from address (looking for common Indian state names)
function detectState(address, pincode) {
  if (!address && !pincode) return "Unknown";
  const states = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
    "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
    "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry"
  ];
  const addr = (address || "") + " " + (pincode || "");
  for (const s of states) {
    if (addr.toLowerCase().includes(s.toLowerCase())) return s;
  }
  // Try to guess from pincode ranges
  if (pincode) {
    const pin = String(pincode).replace(/\D/g, "").slice(0, 3);
    const pinNum = parseInt(pin, 10);
    if (pinNum >= 11 && pinNum <= 13) return "Delhi";
    if (pinNum >= 14 && pinNum <= 17) return "Punjab/Haryana";
    if (pinNum >= 19 && pinNum <= 19) return "Jammu & Kashmir";
    if (pinNum >= 20 && pinNum <= 28) return "Uttar Pradesh/Uttarakhand";
    if (pinNum >= 30 && pinNum <= 34) return "Rajasthan";
    if (pinNum >= 36 && pinNum <= 39) return "Gujarat";
    if (pinNum >= 40 && pinNum <= 44) return "Maharashtra";
    if (pinNum >= 45 && pinNum <= 48) return "Madhya Pradesh";
    if (pinNum >= 50 && pinNum <= 53) return "Telangana/Andhra Pradesh";
    if (pinNum >= 56 && pinNum <= 59) return "Karnataka";
    if (pinNum >= 60 && pinNum <= 64) return "Tamil Nadu/Puducherry";
    if (pinNum >= 67 && pinNum <= 69) return "Kerala";
    if (pinNum >= 70 && pinNum <= 74) return "West Bengal";
    if (pinNum >= 75 && pinNum <= 77) return "Odisha";
    if (pinNum >= 78 && pinNum <= 78) return "Assam/North East";
    if (pinNum >= 80 && pinNum <= 85) return "Bihar/Jharkhand";
  }
  return "Unknown";
}

export async function handleAnalytics(request, env, url) {
  try {
    const period = url.searchParams.get("period") || "all";
    const from = getDateRange(period);
    const useDateFilter = from !== null;

    // Build date condition
    const dateFilter = useDateFilter ? " WHERE created_at >= ?" : "";
    const dateParam = useDateFilter ? from : null;
    const dateParamArr = useDateFilter ? [from] : [];

    // 1. Total Orders & Revenue
    const totalsQuery = useDateFilter
      ? "SELECT COUNT(*) as total_orders, COALESCE(SUM(amount), 0) as total_revenue FROM orders" + dateFilter
      : "SELECT COUNT(*) as total_orders, COALESCE(SUM(amount), 0) as total_revenue FROM orders";
    
    const totals = useDateFilter
      ? await env.DB.prepare(totalsQuery).bind(from).first()
      : await env.DB.prepare(totalsQuery).first();

    // 2. Orders by date (for chart - last 30 days)
    let dateChartFrom = new Date();
    dateChartFrom.setDate(dateChartFrom.getDate() - 30);
    const chartFrom = dateChartFrom.toISOString();
    const chartData = await env.DB.prepare(
      "SELECT DATE(created_at) as date, COUNT(*) as orders, COALESCE(SUM(amount), 0) as revenue FROM orders WHERE created_at >= ? GROUP BY DATE(created_at) ORDER BY date ASC"
    ).bind(chartFrom).all();

    // 3. Payment method breakdown
    const payQuery = useDateFilter
      ? "SELECT payment_method, COUNT(*) as count, COALESCE(SUM(amount), 0) as revenue FROM orders" + dateFilter + " GROUP BY payment_method"
      : "SELECT payment_method, COUNT(*) as count, COALESCE(SUM(amount), 0) as revenue FROM orders GROUP BY payment_method";
    const payData = useDateFilter
      ? await env.DB.prepare(payQuery).bind(from).all()
      : await env.DB.prepare(payQuery).all();

    // 4. Status breakdown
    const statusQuery = useDateFilter
      ? "SELECT status, COUNT(*) as count FROM orders" + dateFilter + " GROUP BY status"
      : "SELECT status, COUNT(*) as count FROM orders GROUP BY status";
    const statusData = useDateFilter
      ? await env.DB.prepare(statusQuery).bind(from).all()
      : await env.DB.prepare(statusQuery).all();

    // 5. COD vs Online payment
    const codQuery = useDateFilter
      ? "SELECT CASE WHEN payment_method IN ('razorpay','prepaid') THEN 'online' ELSE 'cod' END as type, COUNT(*) as count, COALESCE(SUM(amount), 0) as revenue FROM orders" + dateFilter + " GROUP BY type"
      : "SELECT CASE WHEN payment_method IN ('razorpay','prepaid') THEN 'online' ELSE 'cod' END as type, COUNT(*) as count, COALESCE(SUM(amount), 0) as revenue FROM orders GROUP BY type";
    const codData = useDateFilter
      ? await env.DB.prepare(codQuery).bind(from).all()
      : await env.DB.prepare(codQuery).all();

    // 6. UTM source breakdown
    const utmQuery = useDateFilter
      ? "SELECT utm_source, COUNT(*) as count, COALESCE(SUM(amount), 0) as revenue FROM orders WHERE utm_source IS NOT NULL AND utm_source != ''" + dateFilter.replace("WHERE", "AND") + " GROUP BY utm_source ORDER BY count DESC LIMIT 10"
      : "SELECT utm_source, COUNT(*) as count, COALESCE(SUM(amount), 0) as revenue FROM orders WHERE utm_source IS NOT NULL AND utm_source != '' GROUP BY utm_source ORDER BY count DESC LIMIT 10";
    const utmParams = useDateFilter ? [from] : [];
    const utmData = useDateFilter
      ? await env.DB.prepare(utmQuery).bind(from).all()
      : await env.DB.prepare(utmQuery).all();

    // 7. Device & Browser breakdown (parse user_agent)
    // Get all rows with user_agent data
    const uaQuery = useDateFilter
      ? "SELECT user_agent FROM orders WHERE user_agent IS NOT NULL AND user_agent != ''" + dateFilter.replace("WHERE", "AND")
      : "SELECT user_agent FROM orders WHERE user_agent IS NOT NULL AND user_agent != ''";
    const uaData = useDateFilter
      ? await env.DB.prepare(uaQuery).bind(from).all()
      : await env.DB.prepare(uaQuery).all();

    const browsers = {};
    const devices = {};
    const uaRows = uaData?.results || [];
    for (const row of uaRows) {
      const browser = detectBrowser(row.user_agent);
      const device = detectDevice(row.user_agent);
      browsers[browser] = (browsers[browser] || 0) + 1;
      devices[device] = (devices[device] || 0) + 1;
    }

    // 8. Top states
    const stateQuery = useDateFilter
      ? "SELECT address, pincode FROM orders" + dateFilter
      : "SELECT address, pincode FROM orders";
    const stateData = useDateFilter
      ? await env.DB.prepare(stateQuery).bind(from).all()
      : await env.DB.prepare(stateQuery).all();

    const states = {};
    const stateRows = stateData?.results || [];
    for (const row of stateRows) {
      const state = detectState(row.address, row.pincode);
      states[state] = (states[state] || 0) + 1;
    }
    const topStates = Object.entries(states)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([state, count]) => ({ state, count }));

    const totalOrders = totals?.total_orders || 0;

    return success({
      period,
      totals: {
        orders: totalOrders,
        revenue: totals?.total_revenue || 0
      },
      chart: chartData?.results || [],
      payment_methods: payData?.results || [],
      status_breakdown: statusData?.results || [],
      cod_vs_online: codData?.results || [],
      utm_sources: utmData?.results || [],
      browsers,
      devices,
      top_states: topStates
    });
  } catch (err) {
    console.error("Analytics error:", err);
    return error("Failed to fetch analytics data", 500);
  }
}
