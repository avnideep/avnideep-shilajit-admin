// Rewards Handler - List, Filter, Detail for Reward Wheel entries
import { success, error, successPaginated } from "../utils/response.js";

export async function handleListRewards(request, env, url) {
  try {
    const page = parseInt(url.searchParams.get("page")) || 1;
    const limit = Math.min(parseInt(url.searchParams.get("limit")) || 50, 200);
    const offset = (page - 1) * limit;
    const search = url.searchParams.get("search");
    const status = url.searchParams.get("status");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const filters = [];
    const params = [];

    if (search && search.trim()) {
      const term = "%" + search.trim() + "%";
      filters.push("(name LIKE ? OR phone LIKE ? OR reward_id LIKE ?)");
      params.push(term, term, term);
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

    let whereClause = filters.length > 0 ? " WHERE " + filters.join(" AND ") : "";

    // Total count
    const countResult = await env.DB.prepare(
      "SELECT COUNT(*) as total FROM rewards" + whereClause
    ).bind(...params).first();
    const total = countResult?.total || 0;

    // Get rewards
    const query = "SELECT * FROM rewards" + whereClause +
      " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    const { results } = await env.DB.prepare(query)
      .bind(...params, limit, offset)
      .all();

    return successPaginated(results || [], {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error("List rewards error:", err);
    return error("Failed to fetch rewards", 500);
  }
}

export async function handleRewardDetail(request, env, rewardId) {
  try {
    const reward = await env.DB.prepare(
      "SELECT * FROM rewards WHERE reward_id = ?"
    ).bind(rewardId).first();

    if (!reward) {
      return error("Reward not found", 404);
    }
    return success(reward);
  } catch (err) {
    console.error("Reward detail error:", err);
    return error("Failed to fetch reward", 500);
  }
}

export async function handleUpdateRewardStatus(request, env, rewardId) {
  try {
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return error("Status is required");
    }

    const validStatuses = ["claimed", "pending_confirmation", "delivered", "paid_out", "expired"];
    if (!validStatuses.includes(status)) {
      return error("Invalid status. Must be one of: " + validStatuses.join(", "));
    }

    const existing = await env.DB.prepare(
      "SELECT id FROM rewards WHERE reward_id = ?"
    ).bind(rewardId).first();

    if (!existing) {
      return error("Reward not found", 404);
    }

    if (status === "paid_out") {
      await env.DB.prepare(
        "UPDATE rewards SET status = ?, claimed_at = ? WHERE reward_id = ?"
      ).bind(status, new Date().toISOString(), rewardId).run();
    } else {
      await env.DB.prepare(
        "UPDATE rewards SET status = ? WHERE reward_id = ?"
      ).bind(status, rewardId).run();
    }

    return success({ rewardId, status, updated: true });
  } catch (err) {
    console.error("Update reward status error:", err);
    return error("Failed to update reward status", 500);
  }
}
