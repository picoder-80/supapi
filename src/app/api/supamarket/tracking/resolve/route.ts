import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import { detectTracking } from "@/lib/market/tracking-detect";

type TrackingProvider = "aftership" | "17track" | "custom";

type ExternalTrackingResponse = {
  carrier?: string;
  tracking_url?: string;
  tracking_number?: string;
  provider?: TrackingProvider | "external_api";
};

async function resolveViaCustomApi(input: {
  tracking_number: string;
  courier_company?: string;
}): Promise<ExternalTrackingResponse | null> {
  const apiUrl = process.env.TRACKING_RESOLVE_API_URL;
  const apiKey = process.env.TRACKING_RESOLVE_API_KEY;
  if (!apiUrl || !apiKey) return null;

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(input),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    if (!data || typeof data !== "object") return null;
    return {
      carrier: typeof data.carrier === "string" ? data.carrier : undefined,
      tracking_url: typeof data.tracking_url === "string" ? data.tracking_url : undefined,
      tracking_number: typeof data.tracking_number === "string" ? data.tracking_number : undefined,
      provider: "custom",
    };
  } catch {
    return null;
  }
}

async function resolveViaAfterShip(input: {
  tracking_number: string;
  courier_company?: string;
}): Promise<ExternalTrackingResponse | null> {
  const apiKey = process.env.AFTERSHIP_API_KEY;
  if (!apiKey) return null;
  const trackingNumber = input.tracking_number.replace(/\s+/g, "");
  const detectUrl = `https://api.aftership.com/v4/couriers/detect?tracking=${encodeURIComponent(trackingNumber)}`;

  try {
    const detectRes = await fetch(detectUrl, {
      method: "GET",
      headers: {
        "aftership-api-key": apiKey,
      },
    });
    if (!detectRes.ok) return null;
    const detectData = await detectRes.json().catch(() => null);
    const courier = detectData?.data?.couriers?.[0];
    const slug = String(courier?.slug ?? "").trim();
    const name = String(courier?.name ?? input.courier_company ?? "").trim();
    if (!slug && !name) return null;

    const trackingUrl = slug
      ? `https://www.aftership.com/track/${encodeURIComponent(slug)}/${encodeURIComponent(trackingNumber)}`
      : null;

    return {
      carrier: name || input.courier_company || undefined,
      tracking_number: trackingNumber,
      tracking_url: trackingUrl ?? undefined,
      provider: "aftership",
    };
  } catch {
    return null;
  }
}

async function resolveVia17Track(input: {
  tracking_number: string;
  courier_company?: string;
}): Promise<ExternalTrackingResponse | null> {
  const token = process.env.TRACKING_17TRACK_API_KEY;
  if (!token) return null;
  const apiUrl = process.env.TRACKING_17TRACK_API_URL ?? "https://api.17track.net/track/v2/gettrackinfo";
  const trackingNumber = input.tracking_number.replace(/\s+/g, "");
  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "17token": token,
      },
      body: JSON.stringify([{ number: trackingNumber }]),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const accepted = data?.data?.accepted?.[0] ?? data?.accepted?.[0] ?? null;
    const trackInfo = accepted?.track ?? accepted ?? null;
    const company = String(trackInfo?.z1 ?? trackInfo?.carrier_name ?? input.courier_company ?? "").trim();
    return {
      carrier: company || input.courier_company || "17Track",
      tracking_number: trackingNumber,
      tracking_url: `https://t.17track.net/en#nums=${encodeURIComponent(trackingNumber)}`,
      provider: "17track",
    };
  } catch {
    return null;
  }
}

async function resolveWithConfiguredProvider(input: {
  tracking_number: string;
  courier_company?: string;
}): Promise<ExternalTrackingResponse | null> {
  const configured = String(process.env.TRACKING_PROVIDER ?? "auto").trim().toLowerCase();
  if (configured === "aftership") return resolveViaAfterShip(input);
  if (configured === "17track") return resolveVia17Track(input);
  if (configured === "custom") return resolveViaCustomApi(input);

  // auto mode: try high quality global providers first, then custom bridge.
  return (
    (await resolveViaAfterShip(input)) ??
    (await resolveVia17Track(input)) ??
    (await resolveViaCustomApi(input))
  );
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!auth) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(auth);
    if (!payload) return NextResponse.json({ success: false }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const trackingRaw = String(body?.tracking_number ?? "").trim();
    const courierRaw = String(body?.courier_company ?? "").trim();
    if (!trackingRaw) {
      return NextResponse.json({ success: false, error: "tracking_number is required" }, { status: 400 });
    }

    const external = await resolveWithConfiguredProvider({
      tracking_number: trackingRaw,
      courier_company: courierRaw || undefined,
    });

    const local = detectTracking(trackingRaw);
    const fallback17Track = `https://t.17track.net/en#nums=${encodeURIComponent(trackingRaw.replace(/\s+/g, ""))}`;

    const carrier = (external?.carrier || courierRaw || local?.carrier || "Other Courier").trim();
    const trackingNumber = (external?.tracking_number || local?.trackingNumber || trackingRaw).trim();
    const trackingUrl = (external?.tracking_url || local?.trackingUrl || fallback17Track).trim();

    return NextResponse.json({
      success: true,
      data: {
        tracking_number: trackingNumber,
        tracking_carrier: carrier,
        tracking_url: trackingUrl,
        source: external?.provider ?? (local ? "local_detector" : "fallback"),
      },
    });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

