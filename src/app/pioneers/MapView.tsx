// src/app/pioneers/MapView.tsx
"use client";

import { useEffect, useRef } from "react";

interface PioneerPin {
  id: string; user_id: string; lat: number; lng: number;
  precision: string; status: string; note: string;
}
interface PioneerUser {
  id: string; username: string; display_name: string | null;
  avatar_url: string | null; kyc_status: string; bio: string | null;
}

interface Props {
  pins: PioneerPin[];
  users: Record<string, PioneerUser>;
  myUserId?: string;
  userLoc: { lat: number; lng: number } | null;
  onSelectPin: (pin: PioneerPin) => void;
}

export default function MapView({ pins, users, myUserId, userLoc, onSelectPin }: Props) {
  const mapRef     = useRef<any>(null);
  const mapElRef   = useRef<HTMLDivElement>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Load Leaflet CSS
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id   = "leaflet-css";
      link.rel  = "stylesheet";
      link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(link);
    }

    // Load Leaflet JS
    const initMap = () => {
      const L = (window as any).L;
      if (!L || !mapElRef.current || mapRef.current) return;

      const center: [number, number] = userLoc
        ? [userLoc.lat, userLoc.lng]
        : [3.1390, 101.6869]; // KL default

      const map = L.map(mapElRef.current, {
        center,
        zoom: userLoc ? 11 : 6,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
      renderMarkers();
    };

    if (!(window as any).L) {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      script.onload = initMap;
      document.head.appendChild(script);
    } else {
      initMap();
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const renderMarkers = () => {
    const L   = (window as any).L;
    const map = mapRef.current;
    if (!L || !map) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // User location marker
    if (userLoc) {
      const youIcon = L.divIcon({
        className: "",
        html: `<div style="
          width:36px;height:36px;border-radius:50%;
          background:linear-gradient(135deg,#F5A623,#e8941a);
          border:3px solid white;
          box-shadow:0 2px 12px rgba(245,166,35,0.6);
          display:flex;align-items:center;justify-content:center;
          font-size:16px;
        ">📍</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });
      const m = L.marker([userLoc.lat, userLoc.lng], { icon: youIcon })
        .addTo(map)
        .bindPopup("<b>You are here</b>");
      markersRef.current.push(m);
    }

    // Pioneer pins
    pins.forEach(pin => {
      const u = users[pin.user_id];
      if (!u) return;

      const isMe     = pin.user_id === myUserId;
      const isActive = pin.status === "active";
      const initial  = (u.display_name ?? u.username ?? "?").charAt(0).toUpperCase();
      const color    = isMe ? "#F5A623" : isActive ? "#48BB78" : "#718096";
      const border   = isMe ? "#e8941a" : isActive ? "#38A169" : "#4A5568";

      const icon = L.divIcon({
        className: "",
        html: `<div style="
          width:40px;height:40px;border-radius:50%;
          background:${u.avatar_url ? `url(${u.avatar_url}) center/cover` : color};
          border:3px solid ${border};
          box-shadow:0 2px 10px rgba(0,0,0,0.25);
          display:flex;align-items:center;justify-content:center;
          font-size:16px;font-weight:700;color:white;
          cursor:pointer;
          ${pin.precision !== "exact" ? "opacity:0.8;" : ""}
        ">${u.avatar_url ? "" : initial}</div>
        <div style="
          position:absolute;bottom:-4px;right:-2px;
          width:14px;height:14px;border-radius:50%;
          background:${isActive ? "#48BB78" : "#718096"};
          border:2px solid white;
        "></div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const marker = L.marker([pin.lat, pin.lng], { icon })
        .addTo(map)
        .on("click", () => onSelectPin(pin));

      markersRef.current.push(marker);
    });
  };

  // Re-render markers when pins/users change
  useEffect(() => {
    if (mapRef.current && (window as any).L) renderMarkers();
  }, [pins, users, userLoc]);

  return (
    <div
      ref={mapElRef}
      style={{ width: "100%", height: "100%", background: "#e8e8e8" }}
    />
  );
}
