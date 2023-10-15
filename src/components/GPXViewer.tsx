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

// @ts-ignore
// eslint-disable-next-line import/no-webpack-loader-syntax
mapboxgl.workerClass =
  require("worker-loader!mapbox-gl/dist/mapbox-gl-csp-worker").default;

const loadStateFromLocalStorage = (key: string) => {
  try {
    const serializedState = localStorage.getItem(key);
    if (serializedState === null) {
      return undefined;
    }
    return JSON.parse(serializedState);
  } catch (err) {
    console.error("Could not load state", err);
    return undefined;
  }
};

const GPXViewer: React.FC = () => {
  const { t, i18n } = useTranslation();

  const [colors, setColors] = useState<string[]>(() => {
    const savedColors = loadStateFromLocalStorage("colors");
    return savedColors ? savedColors : [];
  });

  const [trackNames, setTrackNames] = useState<string[]>(() => {
    const savedTrackNames = loadStateFromLocalStorage("trackNames");
    return savedTrackNames ? savedTrackNames : [];
  });

  const [layers, setLayers] = useState<mapboxgl.Layer[]>(() => {
    const savedLayers = loadStateFromLocalStorage("layers");
    return savedLayers ? savedLayers : [];
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    const savedIsSidebarOpen = loadStateFromLocalStorage("isSidebarOpen");
    return savedIsSidebarOpen !== undefined ? savedIsSidebarOpen : false;
  });

  const [allGeoJSONData, setAllGeoJSONData] = useState<
    GeoJSON.FeatureCollection[]
  >(() => {
    const savedAllGeoJSONData = loadStateFromLocalStorage("allGeoJSONData");
    return savedAllGeoJSONData || [];
  });

  const [bounds, setBounds] = useState<mapboxgl.LngLatBounds | null>(() => {
    const savedBounds = loadStateFromLocalStorage("bounds");
    return savedBounds
      ? new mapboxgl.LngLatBounds(savedBounds[0], savedBounds[1])
      : null;
  });

  // map, mapContainerRef, and refs (like layersRef, allGeoJSONDataRef) should not be saved/loaded from localStorage.
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  const layersRef = useRef<mapboxgl.Layer[]>([]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Saving states to local storage
    saveStateToLocalStorage("colors", colors);
    saveStateToLocalStorage("trackNames", trackNames);
    saveStateToLocalStorage("layers", layers);
    saveStateToLocalStorage("isSidebarOpen", isSidebarOpen);
    saveStateToLocalStorage("allGeoJSONData", allGeoJSONData);

    if (bounds) {
      const serializedBounds = [
        [bounds?.getSouthWest()?.lng, bounds?.getSouthWest()?.lat],
        [bounds?.getNorthEast()?.lng, bounds?.getNorthEast()?.lat],
      ];
      saveStateToLocalStorage("bounds", serializedBounds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colors, trackNames, layers, isSidebarOpen, bounds]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Initialize map instance if it doesn't exist
    if (!map) {
      initializeMap();
    }

    // Add layers to map
    allGeoJSONData.forEach((geojson, index) => {
      const trackIndex = trackNames[index]
        ? trackNames.indexOf(trackNames[index])
        : index;
      const color = colors[index];
      addLayerToMap(geojson, trackIndex, color);
    });

    if (map && bounds && bounds.getSouthWest().lng !== 0) {
      map.fitBounds(bounds, {
        padding: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  const initializeMap = () => {
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
  };

  const saveStateToLocalStorage = (key: string, state: any) => {
    try {
      const serializedState = JSON.stringify(state);
      localStorage.setItem(key, serializedState);
    } catch (err) {
      console.error("Could not save state", err);
    }
  };

  const addLayerToMap = (
    geojson: GeoJSON.FeatureCollection,
    trackIndex: number,
    color: string
  ) => {
    if (map) {
      map.addLayer({
        id: `track-${trackIndex}`,
        type: "line",
        source: {
          type: "geojson",
          data: geojson,
        },
        layout: {},
        paint: {
          "line-color": color,
          "line-width": 3,
        },
      });
    }
  };

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

    const initialColor = "#0c40eb";

    setColors((prevColors) => [
      ...prevColors,
      ...Array.from(files).map(() => initialColor),
    ]);

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
          // Using the length of trackNames to generate unique IDs for each track layer.
          id: `track-${trackNames.length}`,
          type: "line",
          source: {
            type: "geojson",
            data: geojson,
          },
          layout: {},
          paint: {
            "line-color": initialColor,
            "line-width": 3,
          },
        });

        setLayers((prevLayers) => {
          const updatedLayers = [
            ...prevLayers,
            { id: `track-${trackNames.length}`, type: "line" }, // Updated the id
          ];
          layersRef.current = updatedLayers; // Update the ref
          return updatedLayers;
        });

        allGeoJSONData.push(geojson);
        updateBoundsToFitAllTracks();
        saveStateToLocalStorage("colors", colors);
        saveStateToLocalStorage("trackNames", trackNames);
        saveStateToLocalStorage("layers", layers);
        saveStateToLocalStorage("isSidebarOpen", isSidebarOpen);
      };
      reader.readAsText(file);
    });

    if (isSidebarOpen) {
      setIsSidebarOpen(!isSidebarOpen);
    }
  };

  const handleReset = () => {
    // Clear local storage
    localStorage.clear();

    window.location.reload();

    // // Reset the map view to some default
    // if (map) {
    //   map.flyTo({
    //     center: [0, 20], // Default center
    //     zoom: 2, // Default zoom level
    //   });

    //   // Remove all custom layers, sources, etc. from the map if needed
    //   layers.forEach((layer) => {
    //     if (map.getLayer(layer.id)) {
    //       map.removeLayer(layer.id);
    //     }
    //     if (map.getSource(layer.id)) {
    //       map.removeSource(layer.id);
    //     }
    //   });
    // }

    // // Reset the state
    // setColors([]);
    // setLayers([]);
    // setTrackNames([]);
    // setBounds(new mapboxgl.LngLatBounds()); // Or set to some default bounds
    // setIsSidebarOpen(false);
    // setAllGeoJSONData([]);
  };

  const updateBoundsToFitAllTracks = () => {
    if (!map) return;

    let bounds = new mapboxgl.LngLatBounds();

    // Iterate over all added geojson data to extend the bounds
    allGeoJSONData.forEach((data) => {
      data.features.forEach((feature: any) => {
        if (feature.geometry && feature.geometry.coordinates) {
          feature.geometry.coordinates.forEach((coord: [number, number]) => {
            bounds.extend(coord);
          });
        }
      });
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, {
        padding: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50,
        },
      });
    }

    // Serialize bounds before saving to local storage
    const serializedBounds = [
      [bounds.getSouthWest().lng, bounds.getSouthWest().lat],
      [bounds.getNorthEast().lng, bounds.getNorthEast().lat],
    ];
    saveStateToLocalStorage("bounds", serializedBounds);
  };

  const updateTrackColor = (index: number, newColor: string) => {
    // Update local state
    const updatedColors = [...colors];
    updatedColors[index] = newColor;
    setColors(updatedColors);

    // Update map color
    if (layers[index]) {
      map!.setPaintProperty(layers[index].id, "line-color", newColor);
    }
  };

  return (
    <div>
      <button
        id="sidebarToggle"
        className="sidebar-toggle"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        ☰ Menu
      </button>
      <div className="container">
        {/* Sidebar */}
        <div className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
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
                    onChange={(e) => updateTrackColor(idx, e.target.value)}
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
          <button onClick={handleReset}>{t("ResetMap")}</button>
        </div>

        {/* Map */}
        <div id="map" ref={mapContainerRef} className="map"></div>
      </div>
    </div>
  );
};

export default GPXViewer;
