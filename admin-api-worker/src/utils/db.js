// Database Utilities for D1

export function buildPagination(url) {
  const page = parseInt(url.searchParams.get("page")) || 1;
  const limit = Math.min(parseInt(url.searchParams.get("limit")) || 20, 100);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function buildOrderFilters(url) {
  const filters = [];
  const params = [];
  const search = url.searchParams.get("search");
  const status = url.searchParams.get("status");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const landingPage = url.searchParams.get("landing_page");
  const spin = url.searchParams.get("spin");

  // Spin/No-Spin filter
  if (spin === "spin") {
    filters.push("(reward_id IS NOT NULL AND reward_id != '')");
  } else if (spin === "nospin") {
    filters.push("(reward_id IS NULL OR reward_id = '')");
  }

  if (status && status !== "all") {
    filters.push("status = ?");
    params.push(status);
  }
  if (from) {
    filters.push("created_at >= ?");
    params.push(from);
  }
  if (to) {
    filters.push("created_at <= ?");
    params.push(to + "T23:59:59Z");
  }
  if (landingPage) {
    filters.push("landing_page = ?");
    params.push(landingPage);
  }
  if (search && search.trim()) {
    const term = "%" + search.trim() + "%";
    filters.push("(name LIKE ? OR phone LIKE ? OR order_id LIKE ? OR city LIKE ?)");
    params.push(term, term, term, term);
  }

  return { filters, params };
}

export function buildWhereClause(filters) {
  if (filters.length === 0) return "";
  return " WHERE " + filters.join(" AND ");
}

export async function getTotalCount(db, filters, params) {
  const whereClause = buildWhereClause(filters);
  const result = await db.prepare("SELECT COUNT(*) as total FROM orders" + whereClause)
    .bind(...params)
    .first();
  return result ? result.total : 0;
}
