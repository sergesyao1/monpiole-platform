import { useEffect } from "react";
import { Link } from "react-router";
import { divIcon, latLngBounds } from "leaflet";
import type { LeafletEventHandlerFnMap } from "leaflet";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { leafletTileLayer } from "../maps/leaflet-map-config.js";
import type { PublicPropertySummary } from "./public-property-model.js";

export interface PublicCatalogMapMarker {
  readonly property: PublicPropertySummary;
  readonly label?: string;
}

interface PublicCatalogMapProps {
  readonly markers: readonly PublicCatalogMapMarker[];
  readonly selectedPropertyId?: string;
  readonly catalogSearch: string;
  readonly onSelect: (propertyId: string) => void;
  readonly onClearSelection?: () => void;
}

export function PublicCatalogMap({ markers, selectedPropertyId, catalogSearch, onSelect, onClearSelection }: PublicCatalogMapProps) {
  const located = markers.filter((marker) => marker.property.publicLocation !== null);
  const selected = located.find((marker) => marker.property.publicPropertyId === selectedPropertyId);
  if (located.length === 0) return <div className="public-catalog-map-empty" role="status">Aucune position publique n’est disponible pour les biens affichés.</div>;
  const first = located[0]!.property.publicLocation!;
  return (
    <div className="public-catalog-map" role="region" aria-label="Carte des biens affichés">
      <MapContainer center={[first.latitude, first.longitude]} zoom={11} scrollWheelZoom className="public-catalog-map__canvas">
        <TileLayer attribution={leafletTileLayer.attribution} url={leafletTileLayer.url} />
        {located.map(({ property, label }) => {
          const location = property.publicLocation!;
          const selectedMarker = property.publicPropertyId === selectedPropertyId;
          const handlers: LeafletEventHandlerFnMap = { click: () => onSelect(property.publicPropertyId) };
          return <Marker key={property.publicPropertyId} position={[location.latitude, location.longitude]}
            icon={priceIcon(label, selectedMarker)} eventHandlers={handlers}
            title={`${property.title}, ${label ?? "Bien immobilier"}`} alt={`Sélectionner ${property.title}`}
            zIndexOffset={selectedMarker ? 1000 : 0} />;
        })}
        <FitLoadedMarkers markers={located} />
      </MapContainer>
      {selected === undefined ? null : <MapPreview marker={selected} catalogSearch={catalogSearch} onDismiss={onClearSelection} />}
    </div>
  );
}

function MapPreview({ marker, catalogSearch, onDismiss }: Readonly<{ marker: PublicCatalogMapMarker; catalogSearch: string; onDismiss?: () => void }>) {
  const { property, label } = marker;
  return <article className="public-map-preview" aria-live="polite"><div><strong>{property.title}</strong>
    <span>{property.location.city} · {property.location.district}</span>{label === undefined ? null : <span>{label}</span>}
    {property.publicLocation?.precision === "APPROXIMATE" ? <small>Localisation approximative</small> : null}</div>
    <Link to={`/catalogue/${property.publicPropertyId}`} state={{ catalogSearch }}>Voir le bien</Link>
    {onDismiss === undefined ? null : <button type="button" className="public-map-preview-dismiss" onClick={onDismiss} aria-label="Fermer l’aperçu">×</button>}</article>;
}

function FitLoadedMarkers({ markers }: Readonly<{ markers: readonly PublicCatalogMapMarker[] }>) {
  const map = useMap();
  const signature = markers.map(({ property }) => `${property.publicPropertyId}:${property.publicLocation!.latitude}:${property.publicLocation!.longitude}`).join("|");
  useEffect(() => {
    const positions = markers.map(({ property }) => [property.publicLocation!.latitude, property.publicLocation!.longitude] as [number, number]);
    if (positions.length === 1) map.setView(positions[0]!, markers[0]!.property.publicLocation?.precision === "APPROXIMATE" ? 11 : 13);
    else map.fitBounds(latLngBounds(positions), { padding: [36, 36], maxZoom: 13 });
  }, [map, markers, signature]);
  return null;
}

function priceIcon(label: string | undefined, selected: boolean) {
  const text = label ?? "Bien";
  return divIcon({ className: "public-map-marker-shell", html: `<span class="public-map-marker${selected ? " is-selected" : ""}">${escapeHtml(text)}</span>` });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}
