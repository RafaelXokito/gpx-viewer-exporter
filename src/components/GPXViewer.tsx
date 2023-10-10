import React, { useEffect, useRef, useState } from "react";
import {
  MapboxExportControl,
  Size,
  PageOrientation,
  Format,
  DPI,
} from "@watergis/mapbox-gl-export";
import "@watergis/mapbox-gl-export/css/styles.css";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import "./GPXViewer.css";
import * as toGeoJSON from "togeojson";
import { useTranslation } from "react-i18next";

mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN!;

const GPXViewer: React.FC = () => {
  const { t, i18n } = useTranslation();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const [colors, setColors] = useState<string[]>([]);
  const [trackNames] = useState<string[]>([]);
  const layersRef = useRef<mapboxgl.Layer[]>([]);
  const [layers, setLayers] = useState<mapboxgl.Layer[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (!map) {
      const mapInstance = new mapboxgl.Map({
        container: mapContainerRef.current!,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center: [0, 20],
        zoom: 2,
      });

      mapInstance.on("load", () => {
        setMap(mapInstance);

        mapInstance.on("click", function (e) {
          // Remove existing popups
          var popups = document.getElementsByClassName("mapboxgl-popup");
          if (popups[0]) popups[0].remove();

          // Query the track layers
          console.log(layersRef.current.map((layer) => layer.id));
          var features = mapInstance.queryRenderedFeatures(e.point, {
            layers: layersRef.current.map((layer) => layer.id), // Use dynamic layer IDs based on the layers state
          });

          if (!features.length) {
            return;
          }

          const feature = features[0];
          const trackName = feature.properties!.trackName;
          const totalDistance = feature.properties!.distance;

          // Create a Mapbox popup and display the information
          new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(
              `
                <h3>${trackName}</h3>
                <p>Distance: ${totalDistance.toFixed(2)} km</p>`
            )
            .addTo(mapInstance);
        });

        // Add the export control after the map has loaded
        mapInstance.addControl(
          new MapboxExportControl({
            PageSize: Size.LETTER,
            PageOrientation: PageOrientation.Landscape,
            Format: Format.PNG,
            DPI: DPI[400],
            Crosshair: true,
            PrintableArea: true,
          }),
          "top-right"
        );
      });
    }
  }, []);

  const changeLanguage = (lng: any) => {
    i18n.changeLanguage(lng);
  };

  function formatDateFromTrackName(trackName: String) {
    // Extract the date string from the beginning of the trackName
    const dateString = trackName.slice(0, 8);

    // Extract the day, month, and year from the dateString
    const day = dateString.slice(6, 8);
    const month = dateString.slice(4, 6);
    const year = dateString.slice(0, 4);

    const restString = trackName.slice(9);

    // Return the formatted date
    return `${day}/${month}/${year} - ${restString}`;
  }

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !map) return;

    const initialColors = Array.from(files).map(() => "#0c40eb");
    setColors(initialColors);

    let bounds = new mapboxgl.LngLatBounds();

    Array.from(files).forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(
          event.target!.result as string,
          "text/xml"
        );
        const geojson = toGeoJSON.gpx(xmlDoc);

        const trackName = formatDateFromTrackName(
          geojson.features[0].properties.name
        );

        let totalDistance = 0;
        let previousCoord: mapboxgl.LngLat | null = null;

        geojson.features[0].geometry.coordinates.forEach(
          (coord: [number, number]) => {
            const currentCoord = new mapboxgl.LngLat(coord[0], coord[1]);
            if (previousCoord) {
              totalDistance += previousCoord.distanceTo(currentCoord);
            }
            previousCoord = currentCoord;
          }
        );
        totalDistance = totalDistance / 1000;

        geojson.features[0].properties.trackName = trackName; // set the distance property
        trackNames.push(trackName);
        geojson.features[0].properties.distance = totalDistance; // set the distance property

        map!.addLayer({
          id: `track-${idx}`,
          type: "line",
          source: {
            type: "geojson",
            data: geojson,
          },
          layout: {},
          paint: {
            "line-color": initialColors[idx],
            "line-width": 3,
          },
        });

        setLayers((prevLayers) => {
          const updatedLayers = [
            ...prevLayers,
            { id: `track-${idx}`, type: "line" },
          ];
          layersRef.current = updatedLayers; // Update the ref
          return updatedLayers;
        });

        geojson.features.forEach((feature: any) => {
          if (feature.geometry && feature.geometry.coordinates) {
            feature.geometry.coordinates.forEach((coord: [number, number]) => {
              bounds.extend(coord);
            });
          }
        });

        if (bounds && !bounds.isEmpty()) {
          map!.fitBounds(bounds);
        }
      };
      reader.readAsText(file);
    });
  };

  return (
    <div>
      <button id="sidebarToggle" className="sidebar-toggle" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
        ☰ Menu
      </button>
      <div className="container">
        {/* Sidebar */}
        <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
          {/* File Input Section */}
          <section className="file-input-section">
            <h3>{t("ImportTracks")}</h3>
            {/* Hidden file input */}
            <input
              type="file"
              multiple
              onChange={handleFiles}
              id="hiddenFileInput"
              style={{ display: "none" }}
            />
            {/* Visible import button */}
            <button
              onClick={() =>
                document.getElementById("hiddenFileInput")!.click()
              }
            >
              {t("ImportFiles")}
            </button>
          </section>

          {/* Files List */}
          <section className="files-list-section">
            <h3>{t("UploadedTracks")}</h3>
            <ul>
              {colors.map((color, idx) => (
                <li key={idx} style={{ color: color }}>
                  <span>
                    {/* Replace with your actual track name variable */}
                    {trackNames[idx]}
                  </span>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => {
                      const newColor = e.target.value;
                      const newColors = [...colors];
                      newColors[idx] = newColor;
                      setColors(newColors);

                      if (layers[idx]) {
                        map!.setPaintProperty(
                          layers[idx].id,
                          "line-color",
                          newColor
                        );
                      }
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>
          {/* Language Switch */}
          <div className="language-switch">
            <button onClick={() => changeLanguage("en")}>🇬🇧 English</button>
            <button onClick={() => changeLanguage("pt")}>🇵🇹 Português</button>
          </div>
        </div>

        {/* Map */}
        <div id="map" ref={mapContainerRef} className="map"></div>
      </div>
    </div>
  );
};

export default GPXViewer;