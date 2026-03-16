/**
 * Worldwide tracking number / URL auto-detect
 * Parses user input (tracking number or full URL) and returns carrier + tracking URL
 */

export interface TrackingResult {
  carrier: string;
  carrierId: string;
  trackingNumber: string;
  trackingUrl: string | null;
}

// Worldwide carriers: patterns (regex) + URL builder
const CARRIERS: Array<{
  id: string;
  name: string;
  patterns: RegExp[];
  urlTemplate: string; // {tracking} = tracking number placeholder
  urlDomains: string[]; // for URL detection
}> = [
  // ── International ──
  {
    id: "dhl",
    name: "DHL",
    patterns: [/^\d{10,14}$/, /^JJD\d{14}$/, /^\d{11}$/],
    urlTemplate: "https://www.dhl.com/en/express/tracking.html?AWB={tracking}",
    urlDomains: ["dhl.com", "dhl.de", "dhl.co.uk"],
  },
  {
    id: "fedex",
    name: "FedEx",
    patterns: [/^\d{12,15}$/, /^\d{20}$/],
    urlTemplate: "https://www.fedex.com/fedextrack/?trknbr={tracking}",
    urlDomains: ["fedex.com", "fedex.co.uk"],
  },
  {
    id: "ups",
    name: "UPS",
    patterns: [/^1Z[A-Z0-9]{16}$/, /^\d{18}$/, /^T\d{10}$/],
    urlTemplate: "https://www.ups.com/track?tracknum={tracking}",
    urlDomains: ["ups.com"],
  },
  {
    id: "usps",
    name: "USPS",
    patterns: [/^\d{20,22}$/, /^94\d{20}$/, /^[A-Z]{2}\d{9}US$/],
    urlTemplate: "https://tools.usps.com/go/TrackConfirmAction?tLabels={tracking}",
    urlDomains: ["usps.com"],
  },
  {
    id: "tnt",
    name: "TNT",
    patterns: [/^\d{9,12}$/],
    urlTemplate: "https://www.tnt.com/express/en_my/site/shipping-tools/tracking.html?searchType=con&cons={tracking}",
    urlDomains: ["tnt.com"],
  },
  {
    id: "aramex",
    name: "Aramex",
    patterns: [/^\d{10,14}$/],
    urlTemplate: "https://www.aramex.com/tools/track/?ShipmentNumber={tracking}",
    urlDomains: ["aramex.com"],
  },
  // ── Malaysia ──
  {
    id: "poslaju",
    name: "Pos Laju",
    patterns: [/^[A-Z]{2}\d{9}[A-Z]{2}$/i, /^EF\d{9}MY$/i, /^RX\d{9}MY$/i],
    urlTemplate: "https://track.pos.com.my/tracking?trackingNo={tracking}",
    urlDomains: ["pos.com.my", "poslaju.com.my"],
  },
  {
    id: "jt",
    name: "J&T Express",
    patterns: [/^JTE\d{10,14}$/i, /^JT\d{12,14}$/i],
    urlTemplate: "https://www.jtexpress.my/index/query/gzquery.html?bills={tracking}",
    urlDomains: ["jtexpress.my", "jnt.com", "jtexpress.com"],
  },
  {
    id: "ninjavan",
    name: "Ninja Van",
    patterns: [/^NV\d{10,14}$/i, /^[A-Z]{2}\d{12}$/i],
    urlTemplate: "https://www.ninjavan.co/my/en/tracking/{tracking}",
    urlDomains: ["ninjavan.co", "ninjavan.sg"],
  },
  {
    id: "gdex",
    name: "GDex",
    patterns: [/^GD\d{10,14}$/i],
    urlTemplate: "https://www.gdexpress.com/track/?awb={tracking}",
    urlDomains: ["gdexpress.com"],
  },
  {
    id: "skynet",
    name: "Skynet",
    patterns: [/^\d{10,14}$/],
    urlTemplate: "https://www.skynet.com.my/track?hawb={tracking}",
    urlDomains: ["skynet.com.my"],
  },
  // ── Singapore ──
  {
    id: "singpost",
    name: "SingPost",
    patterns: [/^[A-Z]{2}\d{9}[A-Z]{2}$/i, /^RR\d{9}SG$/i],
    urlTemplate: "https://www.singpost.com/track-items?track_number={tracking}",
    urlDomains: ["singpost.com"],
  },
  // ── China / Asia ──
  {
    id: "cainiao",
    name: "Cainiao / AliExpress",
    patterns: [/^[A-Z]{2}\d{9}[A-Z]{2}$/i, /^LP\d{14}$/i],
    urlTemplate: "https://global.cainiao.com/detail.htm?mailNoList={tracking}",
    urlDomains: ["cainiao.com", "aliexpress.com"],
  },
  {
    id: "sfexpress",
    name: "SF Express",
    patterns: [/^SF\d{13}$/i, /^\d{12,14}$/],
    urlTemplate: "https://www.sf-express.com/my/en/dynamic_function/waybill/#search/bill-number/{tracking}",
    urlDomains: ["sf-express.com"],
  },
  {
    id: "4px",
    name: "4PX",
    patterns: [/^[A-Z0-9]{12,20}$/i],
    urlTemplate: "https://track.4px.com/#/result/0/{tracking}",
    urlDomains: ["4px.com"],
  },
  // ── Europe ──
  {
    id: "dpd",
    name: "DPD",
    patterns: [/^\d{14}$/, /^[0-9]{10,20}$/],
    urlTemplate: "https://www.dpd.com/trace?parcelNumber={tracking}",
    urlDomains: ["dpd.com", "dpd.co.uk"],
  },
  {
    id: "royalmail",
    name: "Royal Mail",
    patterns: [/^[A-Z]{2}\d{9}GB$/i, /^[A-Z]{4}\d{10}GB$/i],
    urlTemplate: "https://www.royalmail.com/track-your-item#/tracking-results/{tracking}",
    urlDomains: ["royalmail.com"],
  },
  {
    id: "hermes",
    name: "Hermes / Evri",
    patterns: [/^\d{16}$/, /^[A-Z0-9]{14,18}$/i],
    urlTemplate: "https://www.evri.com/parcel-tracking?parcelId={tracking}",
    urlDomains: ["evri.com", "hermes.co.uk"],
  },
  // ── Indonesia ──
  {
    id: "jne",
    name: "JNE",
    patterns: [/^[A-Z]{2}\d{9}[A-Z]{2}$/i],
    urlTemplate: "https://www.jne.co.id/id/tracking/trace?q={tracking}",
    urlDomains: ["jne.co.id"],
  },
  {
    id: "sicepat",
    name: "Sicepat",
    patterns: [/^[A-Z0-9]{12,16}$/i],
    urlTemplate: "https://www.sicepat.com/tracking?awb={tracking}",
    urlDomains: ["sicepat.com"],
  },
  // ── Thailand ──
  {
    id: "kerry",
    name: "Kerry Express",
    patterns: [/^[A-Z0-9]{10,16}$/i],
    urlTemplate: "https://th.kerryexpress.com/en/track/?track={tracking}",
    urlDomains: ["kerryexpress.com", "kerry.co.th"],
  },
  // ── Philippines ──
  {
    id: "jntph",
    name: "J&T Philippines",
    patterns: [/^JT\d{12,14}$/i],
    urlTemplate: "https://www.jtexpress.ph/index/query/gzquery.html?bills={tracking}",
    urlDomains: ["jtexpress.ph"],
  },
  // ── Generic / fallback ──
  {
    id: "17track",
    name: "17Track",
    patterns: [/^[A-Z0-9]{10,30}$/i],
    urlTemplate: "https://t.17track.net/en#nums={tracking}",
    urlDomains: ["17track.net", "17track.org"],
  },
];

function extractTrackingFromUrl(url: string): { domain: string; tracking: string } | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname + u.search;
    const match = path.match(/(?:track|trace|query|search|awb|bill|parcel|shipment|trackingNo|tracknum|trknbr)[=:\/]?([A-Z0-9\-]{8,30})/i)
      || path.match(/\/([A-Z0-9\-]{10,30})(?:\?|$|\/)/i);
    const tracking = match?.[1]?.replace(/-/g, "") ?? u.searchParams.get("trackingNo") ?? u.searchParams.get("awb") ?? u.searchParams.get("bill") ?? u.searchParams.get("q") ?? "";
    if (tracking.length >= 8) return { domain: host, tracking };
  } catch {}
  return null;
}

export function detectTracking(input: string): TrackingResult | null {
  const raw = String(input || "").trim();
  if (!raw || raw.length < 6) return null;

  const clean = raw.replace(/\s+/g, "").toUpperCase();

  // 1. Try URL detection first
  const urlExtract = extractTrackingFromUrl(raw);
  if (urlExtract) {
    for (const c of CARRIERS) {
      if (c.urlDomains.some(d => urlExtract.domain.includes(d.replace(/^www\./, "")))) {
        const tracking = urlExtract.tracking || clean;
        const url = c.urlTemplate.replace("{tracking}", encodeURIComponent(tracking));
        return { carrier: c.name, carrierId: c.id, trackingNumber: tracking, trackingUrl: url };
      }
    }
    // Unknown URL domain → use 17track as fallback
    const tracking = urlExtract.tracking || clean;
    const c = CARRIERS.find(x => x.id === "17track")!;
    return { carrier: c.name, carrierId: c.id, trackingNumber: tracking, trackingUrl: c.urlTemplate.replace("{tracking}", encodeURIComponent(tracking)) };
  }

  // 2. Try pattern matching on clean tracking number
  for (const c of CARRIERS) {
    for (const p of c.patterns) {
      if (p.test(clean)) {
        const url = c.urlTemplate.replace("{tracking}", encodeURIComponent(clean));
        return { carrier: c.name, carrierId: c.id, trackingNumber: clean, trackingUrl: url };
      }
    }
  }

  // 3. Fallback: 17track for any alphanumeric 10+ chars
  if (/^[A-Z0-9\-]{10,30}$/i.test(clean)) {
    const c = CARRIERS.find(x => x.id === "17track")!;
    return { carrier: c.name, carrierId: c.id, trackingNumber: clean, trackingUrl: c.urlTemplate.replace("{tracking}", encodeURIComponent(clean)) };
  }

  return null;
}
