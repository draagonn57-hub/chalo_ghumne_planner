import { useEffect, useMemo, useState, useRef } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
} from "@vis.gl/react-google-maps";
import { MapPin, Navigation, Calendar, Loader2 } from "lucide-react";
import { geocodeBatch, hasMapsKey } from "@/lib/geocodeService";

const MAP_ID = "tp-itinerary-map";

const DAY_COLORS = [
  "#E76F51",
  "#0D5C75",
  "#F4A261",
  "#2A9D8F",
  "#8B5CF6",
  "#E63946",
  "#457B9D",
  "#F1FAEE",
  "#A8DADC",
  "#1D3557",
];

function colorForDay(dayIndex) {
  return DAY_COLORS[dayIndex % DAY_COLORS.length];
}

function buildMapPoints(itinerary) {
  const points = [];

  (itinerary.destinations || []).forEach((d, i) => {
    points.push({
      id: `dest-${i}`,
      label: d.name,
      sublabel: d.country,
      type: "destination",
      dayIndex: -1,
      query: `${d.name}, ${d.country}`,
    });
  });

  (itinerary.hotels || []).forEach((h, i) => {
    points.push({
      id: `hotel-${i}`,
      label: h.name,
      sublabel: h.location,
      type: "hotel",
      dayIndex: -1,
      query: `${h.name}, ${h.location}`,
    });
  });

  (itinerary.landmarks || []).forEach((l, i) => {
    points.push({
      id: `landmark-${i}`,
      label: l.name,
      sublabel: l.location,
      type: "landmark",
      dayIndex: -1,
      query: `${l.name}, ${l.location}`,
    });
  });

  (itinerary.days || []).forEach((day, dayIdx) => {
    if (day.location) {
      points.push({
        id: `day-${dayIdx}-loc`,
        label: `Day ${day.day}: ${day.title}`,
        sublabel: day.location,
        type: "day",
        dayIndex: dayIdx,
        query: day.location,
      });
    }

    ["morning", "afternoon", "evening"].forEach((slot) => {
      const landmark = day[slot]?.landmark;
      if (landmark) {
        points.push({
          id: `day-${dayIdx}-${slot}`,
          label: landmark,
          sublabel: `Day ${day.day} · ${slot}`,
          type: "landmark",
          dayIndex: dayIdx,
          query: landmark,
        });
      }
    });
  });

  return points;
}

function FitBounds({ points, activeDay }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const valid = points.filter((p) => p.coords);
    if (valid.length === 0) return;

    if (activeDay !== null && activeDay >= 0) {
      const dayPoints = valid.filter(
        (p) => p.dayIndex === activeDay || p.type === "hotel" || p.type === "destination"
      );
      if (dayPoints.length > 0) {
        const bounds = new window.google.maps.LatLngBounds();
        dayPoints.forEach((p) =>
          bounds.extend({ lat: p.coords.lat, lng: p.coords.lng })
        );
        map.fitBounds(bounds, 80);
        return;
      }
    }

    const bounds = new window.google.maps.LatLngBounds();
    valid.forEach((p) =>
      bounds.extend({ lat: p.coords.lat, lng: p.coords.lng })
    );
    map.fitBounds(bounds, 80);
  }, [map, points, activeDay]);

  return null;
}

function polylinePath(points) {
  return points
    .filter((p) => p.coords)
    .map((p) => ({ lat: p.coords.lat, lng: p.coords.lng }));
}

export default function ItineraryMap({ itinerary }) {
  const [resolvedPoints, setResolvedPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState(null);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [showAllDays, setShowAllDays] = useState(true);
  const mapRef = useRef(null);

  const rawPoints = useMemo(
    () => buildMapPoints(itinerary),
    [itinerary]
  );

  const dayList = useMemo(() => {
    const days = [];
    (itinerary.days || []).forEach((d, i) => {
      const hasLocation = d.location || d.morning?.landmark || d.afternoon?.landmark || d.evening?.landmark;
      if (hasLocation) days.push({ index: i, day: d.day, title: d.title, location: d.location });
    });
    return days;
  }, [itinerary]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const queries = rawPoints.map((p) => p.query);
    geocodeBatch(queries).then((cache) => {
      if (cancelled) return;

      const enriched = rawPoints.map((p) => ({
        ...p,
        coords: cache[p.query.trim().toLowerCase()] || null,
      }));

      setResolvedPoints(enriched);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [rawPoints]);

  const visiblePoints = useMemo(() => {
    if (activeDay === null || showAllDays) return resolvedPoints;
    return resolvedPoints.filter(
      (p) =>
        p.dayIndex === activeDay ||
        p.type === "hotel" ||
        p.type === "destination"
    );
  }, [resolvedPoints, activeDay, showAllDays]);

  const routePath = useMemo(() => {
    if (activeDay === null || showAllDays) {
      const ordered = [];
      resolvedPoints.forEach((p) => {
        if (p.type === "day" && p.coords) ordered.push(p);
      });
      return polylinePath(ordered);
    }
    const dayOrdered = resolvedPoints
      .filter((p) => p.dayIndex === activeDay && p.coords)
      .sort((a, b) => {
        const order = { day: 0, landmark: 1 };
        return (order[a.type] ?? 2) - (order[b.type] ?? 2);
      });
    return polylinePath(dayOrdered);
  }, [resolvedPoints, activeDay, showAllDays]);

  if (!hasMapsKey()) {
    return (
      <div
        className="tp-card p-8 flex items-center justify-center flex-col gap-3 min-h-[300px]"
        data-testid="itinerary-map-fallback"
      >
        <MapPin size={32} className="text-slate-300" />
        <p className="text-slate-400 text-sm text-center max-w-sm">
          Interactive map requires a Google Maps API key. Add
          REACT_APP_GOOGLE_MAPS_API_KEY to enable the map view.
        </p>
      </div>
    );
  }

  const hasCoords = resolvedPoints.some((p) => p.coords);

  if (loading) {
    return (
      <div className="tp-card p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="text-[#0D5C75] animate-spin" />
          <p className="text-slate-500 text-sm">Loading map…</p>
        </div>
      </div>
    );
  }

  if (!hasCoords) {
    return (
      <div
        className="tp-card p-8 flex items-center justify-center flex-col gap-3 min-h-[300px]"
        data-testid="itinerary-map-no-coords"
      >
        <MapPin size={32} className="text-slate-300" />
        <p className="text-slate-400 text-sm text-center max-w-sm">
          Could not resolve any locations for this itinerary.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="itinerary-map-container">
      {/* Day filter pills */}
      {dayList.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => {
              setActiveDay(null);
              setShowAllDays(true);
            }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              showAllDays
                ? "bg-[#0D5C75] text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All days
          </button>
          {dayList.map((d) => (
            <button
              key={d.index}
              onClick={() => {
                setActiveDay(d.index);
                setShowAllDays(false);
              }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                !showAllDays && activeDay === d.index
                  ? "text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
              style={
                !showAllDays && activeDay === d.index
                  ? { backgroundColor: colorForDay(d.index) }
                  : {}
              }
              data-testid={`map-day-pill-${d.index}`}
            >
              <Calendar size={12} />
              Day {d.day}
            </button>
          ))}
        </div>
      )}

      {/* Map */}
      <div
        className="rounded-2xl overflow-hidden shadow-lg"
        style={{ height: "500px" }}
      >
        <APIProvider apiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}>
          <Map
            defaultZoom={4}
            defaultCenter={{ lat: 20.5937, lng: 78.9629 }}
            mapId={MAP_ID}
            gestureHandling="greedy"
            disableDefaultUI={false}
            ref={mapRef}
          >
            {visiblePoints.map((p) => {
              if (!p.coords) return null;

              const color =
                p.type === "destination"
                  ? "#0D5C75"
                  : p.type === "hotel"
                  ? "#E76F51"
                  : p.type === "day"
                  ? colorForDay(p.dayIndex)
                  : colorForDay(p.dayIndex >= 0 ? p.dayIndex : 0);

              return (
                <AdvancedMarker
                  key={p.id}
                  position={{ lat: p.coords.lat, lng: p.coords.lng }}
                  onClick={() => setSelectedPoint(p)}
                >
                  <Pin
                    background={color}
                    glyph={
                      p.type === "destination"
                        ? "📍"
                        : p.type === "hotel"
                        ? "🏨"
                        : p.type === "day"
                        ? String(p.dayIndex + 1)
                        : "🏛"
                    }
                    scale={p.type === "destination" || p.type === "day" ? 1.2 : 1}
                  />
                </AdvancedMarker>
              );
            })}

            {routePath.length >= 2 && (
              <PolylinePath
                path={routePath}
                color={
                  !showAllDays && activeDay !== null
                    ? colorForDay(activeDay)
                    : "#0D5C75"
                }
              />
            )}

            <FitBounds points={visiblePoints} activeDay={showAllDays ? null : activeDay} />

            {selectedPoint?.coords && (
              <InfoWindow
                position={{
                  lat: selectedPoint.coords.lat,
                  lng: selectedPoint.coords.lng,
                }}
                onCloseClick={() => setSelectedPoint(null)}
              >
                <div className="p-2 max-w-[220px]">
                  <div className="font-semibold text-sm text-slate-800">
                    {selectedPoint.label}
                  </div>
                  {selectedPoint.sublabel && (
                    <div className="text-xs text-slate-500 mt-0.5">
                      {selectedPoint.sublabel}
                    </div>
                  )}
                  {selectedPoint.coords.formatted_address && (
                    <div className="text-xs text-slate-400 mt-1">
                      {selectedPoint.coords.formatted_address}
                    </div>
                  )}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      selectedPoint.label
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#0D5C75] font-medium mt-2 inline-flex items-center gap-1 hover:underline"
                  >
                    <Navigation size={12} />
                    Open in Google Maps
                  </a>
                </div>
              </InfoWindow>
            )}
          </Map>
        </APIProvider>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#0D5C75]" />
          Destinations
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#E76F51]" />
          Hotels
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#F4A261]" />
          Day locations
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#2A9D8F]" />
          Landmarks
        </span>
      </div>
    </div>
  );
}

function PolylinePath({ path, color }) {
  const map = useMap();

  useEffect(() => {
    if (!map || path.length < 2) return;

    const polyline = new window.google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: color,
      strokeOpacity: 0.6,
      strokeWeight: 3,
    });

    polyline.setMap(map);

    return () => {
      polyline.setMap(null);
    };
  }, [map, path, color]);

  return null;
}
