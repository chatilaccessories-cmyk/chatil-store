const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const ALLOWED_ORIGINS = new Set([
  "https://chatil-store.vercel.app",
  "https://chatil-store-chatilaccessories-1139.vercel.app",
  "https://chatil-store-om9x6ek59-chatilaccessories-1139.vercel.app",
]);

function response(body: unknown, status: number, origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://chatil-store.vercel.app";
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": allowedOrigin,
      "Vary": "Origin",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Cache-Control": "no-store",
    },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return response({ ok: true }, 200, origin);
  if (req.method !== "POST") return response({ error: "method_not_allowed" }, 405, origin);
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return response({ error: "origin_not_allowed" }, 403, origin);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error("Checkout function is missing required server configuration.");
    return response({ error: "checkout_unavailable" }, 503, origin);
  }

  const length = Number(req.headers.get("content-length") || "0");
  if (length > 12000) return response({ error: "request_too_large" }, 413, origin);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return response({ error: "invalid_json" }, 400, origin);
  }

  if (typeof body.website === "string" && body.website.trim() !== "") {
    return response({ ok: true }, 200, origin);
  }

  const customerName = typeof body.customer_name === "string" ? body.customer_name.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const governorate = typeof body.governorate === "string" ? body.governorate.trim() : "";
  const address = typeof body.address === "string" ? body.address.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const items = Array.isArray(body.items) ? body.items : [];

  if (customerName.length < 2 || customerName.length > 100) return response({ error: "invalid_customer_name" }, 400, origin);
  if (!/^[0-9+()\s-]{8,20}$/.test(phone)) return response({ error: "invalid_phone" }, 400, origin);
  if (governorate.length < 2 || governorate.length > 80) return response({ error: "invalid_governorate" }, 400, origin);
  if (address.length < 5 || address.length > 500) return response({ error: "invalid_address" }, 400, origin);
  if (notes.length > 500) return response({ error: "invalid_notes" }, 400, origin);
  if (items.length < 1 || items.length > 20) return response({ error: "invalid_items" }, 400, origin);

  const cleanItems = [];
  for (const item of items) {
    if (!item || typeof item.slug !== "string" || !/^[a-z0-9-]{2,80}$/.test(item.slug)) {
      return response({ error: "invalid_items" }, 400, origin);
    }
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return response({ error: "invalid_quantity" }, 400, origin);
    cleanItems.push({ slug: item.slug, quantity });
  }

  try {
    const result = await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_guest_order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        p_customer_name: customerName,
        p_phone: phone,
        p_governorate: governorate,
        p_address: address,
        p_notes: notes,
        p_items: cleanItems,
      }),
    });

    if (!result.ok) {
      console.error("Order RPC failed with status:", result.status);
      return response({ error: "order_not_created" }, 400, origin);
    }

    const order = await result.json();
    return response({ ok: true, order_id: order.order_id, total_egp: order.total_egp, status: order.status }, 201, origin);
  } catch {
    console.error("Checkout request failed before an order confirmation was returned.");
    return response({ error: "checkout_unavailable" }, 503, origin);
  }
});
