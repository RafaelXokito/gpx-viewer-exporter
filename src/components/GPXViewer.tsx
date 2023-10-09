import React, { useEffect, useRef } from "react";
import * as L from "leaflet";
import * as toGeoJSON from "togeojson";
import "./GPXViewer.css";
import leafletImage from "leaflet-image";
import html2canvas from "html2canvas";
import { fabric } from "fabric";

const GPXViewer: React.FC = () => {
  //const mapRef = useRef(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const [trackBounds, setTrackBounds] = React.useState<L.LatLngBounds | null>(
    null
  );

  // Use useEffect to create the map instance once the component is mounted
  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current).setView([20, 0], 2);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(
        map
      );

      mapInstanceRef.current = map;

      // Return a cleanup function
      return () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
      };
    }
  }, []);

  const [colors, setColors] = React.useState<string[]>([]);

  const [layers, setLayers] = React.useState<L.GeoJSON[]>([]);

  const exportImage = async () => {
    const mapElement = document.getElementById("map");
    console.log(mapElement);
    if (!mapElement) return;

    // 1. Backup the original styles and get the translation values
    const backupStyles: any = [];
    const translations = [];
    const trackElementsWithTransform = mapElement.querySelectorAll(
      ".leaflet-overlay-pane svg[style*='transform']"
    );

    trackElementsWithTransform.forEach((element: any, idx) => {
      const transformValue = element.style.transform;
      backupStyles[idx] = transformValue;

      const match = transformValue.match(
        /translate3d\((-?\d+)px, (-?\d+)px, 0px\)/
      );
      if (match) {
        let x = parseInt(match[1], 10);
        let y = parseInt(match[2], 10);

        // Apply manual correction based on your observations
        const xOffset = 8; // Adjust as needed
        const yOffset = 8; // Adjust as needed
        x += xOffset;
        y += yOffset;

        translations[idx] = { x, y };

        // 2. Apply the inverse translation in 4K image
        element.style.transform = `translate3d(-128.26px, -71.28px, 0px)`;
        // element.style.transform = `translate3d(-28.5px, -6.5px, 0px)`;
        // element.style.transform=`translate3d(-64.13px, -35.64px, 0px)`;
        // element.style.transform = `translate3d(50px, 0px, 0px)`;
      }
    });

    // Capture the image
    html2canvas(mapElement, {
      allowTaint: true,
      useCORS: true,
    }).then((canvas) => {
      const imgData = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = imgData;
      link.download = "map.png";
      link.click();

      // 3. Restore the original styles
      trackElementsWithTransform.forEach((element: any, idx) => {
        element.style.transform = backupStyles[idx];
      });
    });
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !mapContainerRef.current) return;

    // Duplicate the first file if only one is present
    if (files.length === 1) {
      const file = files[0];
      files.push(file);
    }

    // Initialize colors array based on the number of selected files
    const initialColors = Array.from(files).map(() => "#000000"); // default to black
    setColors(initialColors);

    let bounds: L.LatLngBounds | null = null;

    Array.from(files).forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(
          event.target!.result as string,
          "text/xml"
        );
        const geojson = toGeoJSON.gpx(xmlDoc);

        // 1. Extract the name
        const trackName = geojson.features[0].properties.name;

        // 2. Calculate the distance
        let totalDistance = 0;
        let previousCoord: L.LatLng | null = null;
        geojson.features[0].geometry.coordinates.forEach(
          (coord: [number, number]) => {
            const currentCoord = L.latLng(coord[1], coord[0]);
            if (previousCoord) {
              totalDistance += previousCoord.distanceTo(currentCoord);
            }
            previousCoord = currentCoord;
          }
        );
        // Convert the distance from meters to kilometers
        totalDistance = totalDistance / 1000;

        var myStyle = {
          // Define your style object
          color: initialColors[idx],
        };

        const newLayer = L.geoJSON(geojson, {
          style: myStyle,
          onEachFeature: function (feature, layer) {
            // 3. Update the popup
            layer.bindPopup(
              `${trackName}<br>Distance: ${totalDistance.toFixed(2)} km`
            );
          },
        }).addTo(mapInstanceRef.current!);

        setLayers((prevLayers) => [...prevLayers, newLayer as L.GeoJSON]);

        geojson.features.forEach((feature: any) => {
          if (feature.geometry && feature.geometry.coordinates) {
            feature.geometry.coordinates.forEach((coord: [number, number]) => {
              if (!bounds) {
                bounds = L.latLngBounds(
                  [coord[1], coord[0]],
                  [coord[1], coord[0]]
                );
              } else {
                bounds.extend([coord[1], coord[0]]);
              }
            });
          }
        });

        setTrackBounds(bounds);

        if (bounds && bounds.isValid()) {
          mapInstanceRef.current!.fitBounds(bounds);
        }
      };
      reader.readAsText(file);
    });
  };

  return (
    <div>
      <input type="file" multiple onChange={handleFiles} />

      {colors.map((color, idx) => (
        <input
          key={idx}
          type="color"
          value={color}
          onChange={(e) => {
            const newColor = e.target.value;
            const newColors = [...colors];
            newColors[idx] = newColor;
            setColors(newColors);

            // Update the style of the associated layer
            if (layers[idx]) {
              layers[idx].setStyle({
                color: newColor,
              });
            }
          }}
        />
      ))}

      <button onClick={exportImage}>Export to 4K</button>

      <div id="map" ref={mapContainerRef} className="map"></div>
    </div>
  );
};

export default GPXViewer;
