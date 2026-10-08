import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function FitRoute({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length) {
      map.fitBounds(points.map((point) => [point.lat, point.lon]), { padding: [42, 42] });
    }
  }, [map, points]);
  return null;
}

export default function MapView({ route, result }) {
  const original = route?.nodes || [];
  const detour = result?.detour_route?.nodes || [];
  const points = [...original, ...detour];
  const center = points.length ? [points[0].lat, points[0].lon] : [18.5204, 73.8567];
  const originalLine = original.map((point) => [point.lat, point.lon]);
  const detourLine = detour.map((point) => [point.lat, point.lon]);
  const incident = result?.incident_node;
  const disruptionOrigin = incident && original.length
    ? original.reduce((closest, point) => {
      const currentDistance = Math.hypot(point.lat - incident.lat, point.lon - incident.lon);
      const closestDistance = Math.hypot(closest.lat - incident.lat, closest.lon - incident.lon);
      return currentDistance < closestDistance ? point : closest;
    }, original[0])
    : null;

  return (
    <div className="map-frame">
      <MapContainer center={center} zoom={10} scrollWheelZoom className="map-canvas">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <FitRoute points={points} />
        {originalLine.length > 1 && (
          <Polyline positions={originalLine} pathOptions={{ color: "#9cdb63", weight: 5, opacity: result ? 0.45 : 0.9 }} />
        )}
        {incident && disruptionOrigin && (
          <Polyline positions={[[disruptionOrigin.lat, disruptionOrigin.lon], [incident.lat, incident.lon]]} pathOptions={{ color: "#f08b62", weight: 6 }} />
        )}
        {detourLine.length > 1 && (
          <Polyline positions={detourLine} pathOptions={{ color: "#62b5ed", weight: 5, dashArray: "9 9" }} />
        )}
        {original.map((point, index) => (
          <CircleMarker
            key={`${point.id}-${index}`}
            center={[point.lat, point.lon]}
            radius={index === 0 || index === original.length - 1 ? 7 : 5}
            pathOptions={{ color: "#101812", weight: 2, fillColor: result && point.id === incident?.id ? "#ef735b" : "#b3e875", fillOpacity: 1 }}
          >
            <Popup><strong>{point.name}</strong><br />{point.type}</Popup>
          </CircleMarker>
        ))}
        {detour.slice(1).map((point) => (
          <CircleMarker key={`detour-${point.id}`} center={[point.lat, point.lon]} radius={6} pathOptions={{ color: "#101812", weight: 2, fillColor: "#62b5ed", fillOpacity: 1 }}>
            <Popup><strong>{point.name}</strong><br />Emergency destination</Popup>
          </CircleMarker>
        ))}
        {incident && (
          <CircleMarker center={[incident.lat, incident.lon]} radius={10} pathOptions={{ color: "#ff9e7e", weight: 2, fillColor: "#ef735b", fillOpacity: 0.85 }}>
            <Popup><strong>Disruption: {incident.name}</strong></Popup>
          </CircleMarker>
        )}
      </MapContainer>
      <div className="map-legend">
        <span><i className="legend-safe" /> Planned route</span>
        {result && <span><i className="legend-alert" /> Disruption</span>}
        {detour.length > 1 && <span><i className="legend-detour" /> Recovery route</span>}
      </div>
      {!route && <div className="map-empty">Choose a shipment and generate its first route.</div>}
    </div>
  );
}
