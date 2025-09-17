"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvent } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';

import { escapeHtml } from '@/lib/utils';
import type { ClinicFeature } from '@/types/clinics';

import 'leaflet/dist/leaflet.css';

type ClusterIconTarget = { getChildCount: () => number };

type FocusTarget =
  | { type: 'clinic'; clinic: ClinicFeature }
  | { type: 'bounds'; bounds: [[number, number], [number, number]] };

type MapProps = {
  clinics: ClinicFeature[];
  selectedClinic: ClinicFeature | null;
  onSelectClinic: (clinic: ClinicFeature) => void;
  focus: FocusTarget | null;
  radiusMeters?: number;
};

const identifyClinic = (clinic: ClinicFeature) =>
  clinic.properties.clinic_id ?? clinic.geometry.coordinates.join(',');

const DEFAULT_CENTER: [number, number] = [37.0902, -95.7129];
const DEFAULT_ZOOM = 4;
const TILE_LAYER_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION =
  "&copy; <a href='https://carto.com/attributions'>CARTO</a> | &copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors";

export function Map({ clinics, selectedClinic, onSelectClinic, focus, radiusMeters }: MapProps) {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  return (
    <div className="relative h-full min-h-[520px] w-full rounded-xl border border-slate-200 bg-white shadow-[0_20px_60px_-25px_rgba(15,23,42,0.25)]">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        minZoom={3}
        maxZoom={18}
        preferCanvas
        zoomAnimation
        fadeAnimation={false}
        className="h-full w-full text-slate-800"
        style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}
        attributionControl
      >
        <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_LAYER_URL} subdomains={['a', 'b', 'c', 'd']} />
        <ZoomTracker onZoomChange={setZoom} />
        <ViewportController focus={focus} />
        <MarkerClusterGroup
          chunkedLoading
          spiderfyOnMaxZoom
          showCoverageOnHover={false}
          zoomToBoundsOnClick
          maxClusterRadius={52}
          polygonOptions={{ opacity: 0, color: 'transparent' }}
          iconCreateFunction={(cluster: ClusterIconTarget) => createClusterIcon(cluster.getChildCount(), zoom)}
        >
          {clinics.map((clinic) => {
            const identifier = identifyClinic(clinic);
            return (
              <ClinicMarker
                key={identifier}
                clinic={clinic}
                selected={selectedClinic ? identifyClinic(selectedClinic) === identifier : false}
                zoom={zoom}
                onSelect={onSelectClinic}
              />
            );
          })}
        </MarkerClusterGroup>
        {selectedClinic && radiusMeters ? (
          <Circle
            center={[
              selectedClinic.geometry.coordinates[1],
              selectedClinic.geometry.coordinates[0],
            ]}
            pathOptions={{
              color: '#1d4ed8',
              fillColor: '#60a5fa',
              fillOpacity: 0.15,
              weight: 1.25,
            }}
            radius={radiusMeters}
          />
        ) : null}
      </MapContainer>
      {!clinics.length && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-white/85 text-sm text-slate-500 backdrop-blur">
          No clinics found.
        </div>
      )}
    </div>
  );
}

type ClinicMarkerProps = {
  clinic: ClinicFeature;
  selected: boolean;
  zoom: number;
  onSelect: (clinic: ClinicFeature) => void;
};

function ClinicMarker({ clinic, selected, zoom, onSelect }: ClinicMarkerProps) {
  const markerRef = useRef<L.Marker | null>(null);
  const { geometry, properties } = clinic;
  const position: [number, number] = [geometry.coordinates[1], geometry.coordinates[0]];

  useEffect(() => {
    if (selected) {
      markerRef.current?.openPopup();
    } else {
      markerRef.current?.closePopup();
    }
  }, [selected]);

  const icon = useMemo(() => createMarkerIcon(properties.rank, selected, zoom), [properties.rank, selected, zoom]);

  const safeName = properties.clinic_name ? escapeHtml(properties.clinic_name) : 'Clinic';

  return (
    <Marker
      ref={(instance) => {
        markerRef.current = instance as unknown as L.Marker | null;
      }}
      position={position}
      icon={icon}
      eventHandlers={{
        click() {
          onSelect(clinic);
        },
      }}
    >
      <Popup className="rounded-xl border border-slate-200/30 shadow-lg shadow-black/40">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-slate-900">{safeName}</div>
          <div className="text-xs text-slate-600 space-y-0.5">
            <div>Score: {formatValue(properties.score)}</div>
            <div>Rank: {formatValue(properties.rank)}</div>
            <div>Total slots: {formatValue(properties.total_slots_offered)}</div>
            <div>Booked slots: {formatValue(properties.slots_booked)}</div>
            <div>Fill rate: {formatRate(properties.fill_rate_pct)}</div>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

function createMarkerIcon(rank: number | null, selected: boolean, zoom: number) {
  const label = rank === null ? '' : `${rank}`;
  const baseSize = selected ? 24 : 18;
  const scale = Math.min(1.3, Math.max(0.7, zoom / 9));
  const svgSize = Math.round(baseSize * scale * 2.2);
  const circleRadius = Math.round((selected ? 10 : 7) * scale);

  const gradientStart = selected ? '#2563eb' : '#14b8a6';
  const gradientEnd = selected ? '#60a5fa' : '#2dd4bf';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg width="${svgSize}" height="${svgSize * 1.4}" viewBox="0 0 40 56" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="pinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${gradientStart}" />
        <stop offset="100%" stop-color="${gradientEnd}" />
      </linearGradient>
      <filter id="pinGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="glow" />
        <feMerge>
          <feMergeNode in="glow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <g filter="url(#pinGlow)">
      <path d="M20 53L8 33C4 27 3 22 3 18C3 8 11 0 21 0C31 0 39 8 39 18C39 22 38 27 34 33L22 53Z" fill="url(#pinGradient)" />
      <circle cx="21" cy="18" r="${circleRadius + 2}" fill="white" opacity="0.12" />
      <circle cx="21" cy="18" r="${circleRadius}" fill="white" />
      <text x="21" y="20" text-anchor="middle" font-family="Inter, Arial" font-weight="700" font-size="${selected ? 12 : 11}" fill="#0f172a">${label}</text>
    </g>
  </svg>`;

  const iconSize: [number, number] = [svgSize, Math.round(svgSize * 1.4)];
  const iconAnchor: [number, number] = [svgSize / 2, Math.round(svgSize * 1.35)];
  const popupAnchor: [number, number] = [0, -Math.round(svgSize * 0.6)];

  return L.divIcon({
    html: svg,
    className: 'custom-pin',
    iconSize,
    iconAnchor,
    popupAnchor,
  });
}

function createClusterIcon(pointCount: number, zoom: number) {
  const scale = Math.min(1.2, Math.max(0.8, zoom / 8));
  const size = Math.round(30 * scale);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg width="${size}" height="${size}" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="clusterGradient" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#bfdbfe" opacity="1" />
        <stop offset="100%" stop-color="#93c5fd" opacity="0.95" />
      </radialGradient>
      <filter id="clusterShadow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="5" result="shadow" />
        <feMerge>
          <feMergeNode in="shadow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <g filter="url(#clusterShadow)">
      <circle cx="28" cy="28" r="24" fill="url(#clusterGradient)" stroke="#2563eb" stroke-width="3" />
      <text x="28" y="32" text-anchor="middle" font-family="Inter, Arial" font-weight="700" font-size="16" fill="#1d4ed8">${pointCount}</text>
    </g>
  </svg>`;

  return L.divIcon({
    html: svg,
    className: 'cluster-pin',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function ViewportController({ focus }: { focus: FocusTarget | null }) {
  const map = useMap();

  useEffect(() => {
    if (!focus) {
      return;
    }

    if (focus.type === 'clinic') {
      const [longitude, latitude] = focus.clinic.geometry.coordinates;
      map.flyTo([latitude, longitude], Math.max(map.getZoom(), 10), {
        duration: 0.6,
        easeLinearity: 0.25,
      });
      return;
    }

    const bounds = L.latLngBounds(focus.bounds);
    const isSinglePoint = bounds.getSouthWest().equals(bounds.getNorthEast());

    if (isSinglePoint) {
      map.flyTo(bounds.getCenter(), Math.max(map.getZoom(), 9), { duration: 0.6, easeLinearity: 0.25 });
      return;
    }

    map.flyToBounds(bounds, {
      padding: [80, 80],
      maxZoom: 7.5,
      duration: 0.6,
      easeLinearity: 0.25,
    });
  }, [focus, map]);

  return null;
}
function ZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  useMapEvent('zoomend', (event) => {
    onZoomChange(event.target.getZoom());
  });
  useMapEvent('zoomstart', (event) => {
    onZoomChange(event.target.getZoom());
  });
  return null;
}

function formatValue(value: number | null): string {
  if (value === null || value === undefined) {
    return '-';
  }
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function formatRate(value: number | null): string {
  if (value === null || value === undefined) {
    return '-';
  }
  return `${value.toFixed(1)}%`;
}


