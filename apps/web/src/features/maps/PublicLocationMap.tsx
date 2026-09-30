import { Circle, MapContainer, Marker, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { leafletTileLayer } from "./leaflet-map-config.js";

export interface PublicMapPosition {
  readonly latitude: number;
  readonly longitude: number;
  readonly precision: "EXACT" | "APPROXIMATE";
}

interface PublicLocationMapProps {
  readonly position: PublicMapPosition;
  readonly label: string;
}

export function PublicLocationMap({ position, label }: PublicLocationMapProps) {
  const center: [number, number] = [position.latitude, position.longitude];
  const approximate = position.precision === "APPROXIMATE";
  return (
    <div className="public-location-map" role="region" aria-label={`Carte de localisation de ${label}`}>
      <MapContainer center={center} zoom={approximate ? 11 : 14} scrollWheelZoom className="public-location-map__canvas">
        <TileLayer attribution={leafletTileLayer.attribution} url={leafletTileLayer.url} />
        {approximate
          ? <Circle center={center} radius={800} pathOptions={{ color: "#1f684c", fillColor: "#7fb99f", fillOpacity: 0.24, weight: 2 }} />
          : <Marker position={center} title={label} alt={`Position de ${label}`} />}
      </MapContainer>
    </div>
  );
}
