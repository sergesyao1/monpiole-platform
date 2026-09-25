import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import type { LatLngExpression, LeafletEventHandlerFnMap } from "leaflet";
import "leaflet/dist/leaflet.css";

interface PropertyGeolocationMapProps {
  readonly latitude: string;
  readonly longitude: string;
  readonly onPositionChange: (latitude: number, longitude: number) => void;
}

export function PropertyGeolocationMap({ latitude, longitude, onPositionChange }: PropertyGeolocationMapProps) {
  const position = validMapPosition(latitude, longitude);
  if (!position) {
    return <div className="property-geolocation-map-placeholder" role="status">Saisissez des coordonnées valides pour afficher la carte.</div>;
  }
  const handlers: LeafletEventHandlerFnMap = {
    dragend(event) {
      const marker = event.target as L.Marker;
      const next = marker.getLatLng();
      onPositionChange(next.lat, next.lng);
    },
  };
  return (
    <div className="property-geolocation-map" aria-label="Carte de prévisualisation de la position du bien">
      <MapContainer center={position} zoom={16} scrollWheelZoom className="property-geolocation-map__canvas">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker draggable eventHandlers={handlers} position={position} />
        <SynchronizeMap position={position} />
      </MapContainer>
    </div>
  );
}

export function validMapPosition(latitude: string, longitude: string): LatLngExpression | undefined {
  const lat = coordinate(latitude);
  const lng = coordinate(longitude);
  if (lat === undefined || lng === undefined || lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;
  return [lat, lng];
}

function coordinate(value: string): number | undefined {
  const parsed = Number(value.trim().replace(",", "."));
  return value.trim() !== "" && Number.isFinite(parsed) ? parsed : undefined;
}

function SynchronizeMap({ position }: { readonly position: LatLngExpression }) {
  const map = useMap();
  useEffect(() => { map.panTo(position); }, [map, position]);
  return null;
}
