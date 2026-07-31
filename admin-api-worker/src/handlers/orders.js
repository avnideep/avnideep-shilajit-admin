// Orders Handler - CRUD, Search, Filter, Pagination, Export
import { success, error, successPaginated, textResponse } from "../utils/response.js";
import { buildPagination, buildOrderFilters, buildWhereClause, getTotalCount } from "../utils/db.js";

// List orders with pagination, search, filter
export async function handleListOrders(request, env, url) {
  try {
    const { page, limit, offset } = buildPagination(url);
    const { filters, params } = buildOrderFilters(url);
    const whereClause = buildWhereClause(filters);

    // Get total count
    const total = await getTotalCount(env.DB, filters, params);

    // Get orders
    const query = "SELECT * FROM orders" + whereClause +
      " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    const resultParams = [...params, limit, offset];

    const { results } = await env.DB.prepare(query)
      .bind(...resultParams)
      .all();

    return successPaginated(results || [], {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error("List orders error:", err);
    return error("Failed to fetch orders", 500);
  }
}

// Single order detail
export async function handleOrderDetail(request, env, orderId) {
  try {
    const order = await env.DB.prepare(
      "SELECT * FROM orders WHERE order_id = ?"
    ).bind(orderId).first();

    if (!order) {
      return error("Order not found", 404);
    }

    return success(order);
  } catch (err) {
    console.error("Order detail error:", err);
    return error("Failed to fetch order", 500);
  }
}

// Update order status
export async function handleUpdateStatus(request, env, orderId) {
  try {
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return error("Status is required");
    }

    const validStatuses = ["pending", "confirmed", "processing", "shipped", "out_for_delivery", "delivered", "cancelled", "returned"];
    if (!validStatuses.includes(status)) {
      return error("Invalid status. Must be one of: " + validStatuses.join(", "));
    }

    // Check if order exists
    const existing = await env.DB.prepare(
      "SELECT order_id FROM orders WHERE order_id = ?"
    ).bind(orderId).first();

    if (!existing) {
      return error("Order not found", 404);
    }

    // Update status
    await env.DB.prepare(
      "UPDATE orders SET status = ? WHERE order_id = ?"
    ).bind(status, orderId).run();

    return success({ orderId, status, updated: true });
  } catch (err) {
    console.error("Update status error:", err);
    return error("Failed to update order status: " + err.message, 500);
  }
}

// Delete multiple orders
export async function handleDeleteOrders(request, env) {
  try {
    const body = await request.json();
    const { orderIds } = body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return error("orderIds array is required", 400);
    }

    if (orderIds.length > 100) {
      return error("Cannot delete more than 100 orders at once", 400);
    }

    // Delete all matching order IDs in a single query (D1 supports IN with bind)
    let deleted = 0;
    const deleteStmt = env.DB.prepare("DELETE FROM orders WHERE order_id = ?");

    for (const id of orderIds) {
      const result = await deleteStmt.bind(id).run();
      if (result.meta?.changes > 0) deleted++;
    }

    return success({
      deleted,
      total: orderIds.length,
      failed: orderIds.length - deleted
    });
  } catch (err) {
    console.error("Delete orders error:", err);
    return error("Failed to delete orders", 500);
  }
}

// Export orders to CSV
export async function handleExportOrders(request, env, url) {
  try {
    const { filters, params } = buildOrderFilters(url);
    const whereClause = buildWhereClause(filters);
    const format = url.searchParams.get("format") || "csv";

    const query = "SELECT * FROM orders" + whereClause + " ORDER BY created_at DESC";
    const { results } = await env.DB.prepare(query).bind(...params).all();

    if (!results || results.length === 0) {
      return error("No orders found to export", 404);
    }

    if (format === "csv") {
      // Generate CSV
      const headers = Object.keys(results[0]);
      let csv = headers.join(",") + "\n";

      for (const row of results) {
        const values = headers.map(h => {
          const val = row[h];
          if (val === null || val === undefined) return "";
          const str = String(val);
          // Escape quotes and wrap in quotes if contains comma or quote
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return '"' + str.replace(/"/g, '""') + '"';
          }
          return str;
        });
        csv += values.join(",") + "\n";
      }

      const filename = "orders_export_" + new Date().toISOString().slice(0, 10) + ".csv";
      return textResponse(csv, "text/csv; charset=utf-8", filename);
    }

    if (format === "excel") {
      // Generate tab-separated values (compatible with Excel)
      const headers = Object.keys(results[0]);
      let tsv = headers.join("\t") + "\n";

      for (const row of results) {
        const values = headers.map(h => {
          const val = row[h];
          return val === null || val === undefined ? "" : String(val);
        });
        tsv += values.join("\t") + "\n";
      }

      const filename = "orders_export_" + new Date().toISOString().slice(0, 10) + ".xls";
      return textResponse(tsv, "application/vnd.ms-excel; charset=utf-8", filename);
    }

    return error("Unsupported format. Use 'csv' or 'excel'", 400);
  } catch (err) {
    console.error("Export error:", err);
    return error("Failed to export orders", 500);
  }
}
