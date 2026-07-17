"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatDistance, priceLabel } from "@/lib/geo";
import { labelForTag } from "@/lib/cuisines";
import { Place } from "@/lib/types";

interface Props {
  places: Place[];
  origin: { lat: number; lon: number };
  emojiFor: (p: Place) => string;
  inPipeline: Set<string | undefined>;
  onAdd: (p: Place) => void;
}

export default function MapView({ places, origin, emojiFor, inPipeline, onAdd }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onAddRef = useRef(onAdd);
  onAddRef.current = onAdd;

  // init once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: false }).setView(
      [origin.lat, origin.lon],
      15
    );
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // markers
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    // origin pin
    L.marker([origin.lat, origin.lon], {
      icon: L.divIcon({
        className: "",
        html: `<div class="map-origin"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
      interactive: false,
    }).addTo(layer);

    const bounds: L.LatLngTuple[] = [[origin.lat, origin.lon]];

    for (const p of places) {
      bounds.push([p.lat, p.lon]);
      const marker = L.marker([p.lat, p.lon], {
        icon: L.divIcon({
          className: "",
          html: `<div class="map-emoji">${emojiFor(p)}</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        }),
      });

      const el = document.createElement("div");
      el.className = "map-popup";
      const saved = inPipeline.has(p.id);
      el.innerHTML = `
        <div class="map-popup-name">${p.name}</div>
        <div class="map-popup-meta">
          ${formatDistance(p.distanceMeters)}${p.priceLevel ? ` · ${priceLabel(p.priceLevel)}` : ""}
          ${p.address ? `<br/>${p.address}` : ""}
        </div>
        <div class="map-popup-tags">${p.cuisines
          .slice(0, 3)
          .map((c) => `<span>${labelForTag(c)}</span>`)
          .join("")}</div>`;
      const btn = document.createElement("button");
      btn.className = "map-popup-btn";
      btn.textContent = saved ? "✓ In pipeline" : "+ Add to pipeline";
      btn.disabled = saved;
      btn.addEventListener("click", () => {
        onAddRef.current(p);
        btn.textContent = "✓ Added";
        btn.disabled = true;
      });
      el.appendChild(btn);

      marker.bindPopup(el, { closeButton: true, offset: [0, -8] });
      marker.addTo(layer);
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
    } else {
      map.setView([origin.lat, origin.lon], 15);
    }
  }, [places, origin.lat, origin.lon, emojiFor, inPipeline]);

  return <div ref={containerRef} className="h-full w-full" />;
}
