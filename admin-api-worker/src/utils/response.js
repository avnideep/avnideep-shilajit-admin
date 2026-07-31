// Response Utilities

export function corsHeaders(env, requestOrigin) {
  const allowedOrigins = ["https://admin.avnideepayurveda.in",
    "https://adminshilajit.avnideepayurveda.in",
    "https://admin.avnideep.in",
    "https://shop.avnideep.in",
    env.ALLOWED_ORIGIN
  ].filter(Boolean);
  
  let origin = "https://admin.avnideep.in";
  if (requestOrigin) {
    // Match against allowed origins
    const match = allowedOrigins.find(o => o === requestOrigin);
    if (match) origin = match;
    // Allow *.pages.dev and *.workers.dev during preview
    else if (requestOrigin.match(/^https:\/\/.*\.(pages|workers)\.dev$/)) origin = requestOrigin;
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function getHeaders(extraHeaders) {
  return {
    "Content-Type": "application/json",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    ...(extraHeaders || {})
  };
}

export function success(data, status = 200, cors = null) {
  const resp = new Response(JSON.stringify({ ok: true, data }), {
    status,
    headers: getHeaders(cors || {})
  });
  return resp;
}

export function successPaginated(data, pagination, status = 200, cors = null) {
  return success({ data, pagination }, status, cors);
}

export function error(message, status = 400, cors = null) {
  const resp = new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: getHeaders(cors || {})
  });
  return resp;
}

export function textResponse(data, contentType, filename, cors = null) {
  return new Response(data, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": 'attachment; filename="' + filename + '"',
      "Cache-Control": "no-store",
      ...(cors || {})
    }
  });
}

export function addCorsToResponse(response, corsHeaders) {
  if (corsHeaders) {
    Object.entries(corsHeaders).forEach(([key, val]) => {
      response.headers.set(key, val);
    });
  }
  return response;
}