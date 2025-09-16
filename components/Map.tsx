"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMapEvent } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';

import { escapeHtml } from '@/lib/utils';
import type { ClinicFeature } from '@/types/clinics';

import 'leaflet/dist/leaflet.css';

type MapProps = {
  clinics: ClinicFeature[];
  selectedClinic: ClinicFeature | null;
  onSelectClinic: (clinic: ClinicFeature) => void;
  radiusMeters?: number;
};

const identifyClinic = (clinic: ClinicFeature) =>
  clinic.properties.clinic_id ?? clinic.geometry.coordinates.join(',');

const DEFAULT_CENTER: [number, number] = [37.0902, -95.7129];
const DEFAULT_ZOOM = 4;
const TILE_LAYER_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION =
  "&copy; <a href='https://carto.com/attributions'>CARTO</a> | &copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors";

export function Map({ clinics, selectedClinic, onSelectClinic, radiusMeters }: MapProps) {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  return (
    <div className="relative h-full min-h-[520px] w-full rounded-xl border border-slate-800 bg-slate-950/60 shadow-[0_25px_70px_-25px_rgba(15,23,42,0.75)]">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        minZoom={3}
        maxZoom={18}
        preferCanvas
        zoomAnimation
        fadeAnimation={false}
        updateWhenIdle
        className="h-full w-full text-slate-900"
        style={{ height: '100%', width: '100%', borderRadius: '0.75rem' }}
        attributionControl
      >
        <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_LAYER_URL} subdomains={['a', 'b', 'c', 'd']} />
        <ZoomTracker onZoomChange={setZoom} />
        <MarkerClusterGroup
          chunkedLoading
          spiderfyOnMaxZoom
          showCoverageOnHover={false}
          zoomToBoundsOnClick
          maxClusterRadius={52}
          polygonOptions={{ opacity: 0, color: 'transparent' }}
          iconCreateFunction={(cluster) => createClusterIcon(cluster.getChildCount(), zoom)}
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
              color: '#38bdf8',
              fillColor: '#0ea5e9',
              fillOpacity: 0.1,
              weight: 1.5,
            }}
            radius={radiusMeters}
          />
        ) : null}
      </MapContainer>
      {!clinics.length && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-slate-950/70 text-sm text-slate-400 backdrop-blur">
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

  const gradientStart = selected ? '#38bdf8' : '#ff6b6b';
  const gradientEnd = selected ? '#0ea5e9' : '#e11d48';

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
  const size = Math.round(34 * scale);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg width="${size}" height="${size}" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="clusterGradient" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#1e293b" opacity="1" />
        <stop offset="100%" stop-color="#0f172a" opacity="0.95" />
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
      <circle cx="28" cy="28" r="24" fill="url(#clusterGradient)" stroke="#0ea5e9" stroke-width="3" />
      <text x="28" y="32" text-anchor="middle" font-family="Inter, Arial" font-weight="700" font-size="16" fill="#38bdf8">${pointCount}</text>
    </g>
  </svg>`;

  return L.divIcon({
    html: svg,
    className: 'cluster-pin',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
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

