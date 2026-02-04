import { useEffect, useRef, useState } from 'react';

export default function RouteViewer({ isOpen, onClose, routeData, inline = false, onRouteSelect }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routeLayersRef = useRef([]);
  const [activeRouteIndex, setActiveRouteIndex] = useState(0);

  // Reset active route when routeData changes (new search)
  useEffect(() => {
    setActiveRouteIndex(0);
  }, [routeData]);

  // Init map
  useEffect(() => {
    if ((!isOpen && !inline) || !mapRef.current || mapInstanceRef.current) return;

    const L = window.L;
    if (!L) return;

    const map = L.map(mapRef.current).setView([-17.8136, -50.5969], 13); // Santa Helena de Goiás default
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);

    mapInstanceRef.current = map;

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        routeLayersRef.current = [];
      }
    };
  }, [isOpen, inline]);

  // Draw routes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !routeData) return;
    
    const L = window.L;

    // Clear old layers
    routeLayersRef.current.forEach(l => map.removeLayer(l));
    routeLayersRef.current = [];

    const routes = routeData.alternatives || [routeData];
    
    // Draw all routes
    routes.forEach((route, index) => {
        if (!route.geometry) return;
        
        const isActive = index === activeRouteIndex;
        // Active: Blue, Inactive: Gray
        const color = isActive ? '#2563eb' : '#94a3b8'; 
        const weight = isActive ? 5 : 4;
        const opacity = isActive ? 0.8 : 0.5;

        const layer = L.geoJSON(route.geometry, {
            style: { color, weight, opacity }
        }).addTo(map);

        if (isActive) {
            layer.bringToFront();
            try {
                map.fitBounds(layer.getBounds(), { padding: [50, 50] });
            } catch(e) {}
        }
        
        // Add click handler to layer to select it
        layer.on('click', () => {
             handleRouteClick(index, route);
        });

        routeLayersRef.current.push(layer);
    });
    
    // Add markers for start/end
    if (routeData.waypoints) {
         routeData.waypoints.forEach((wp, i) => {
            const [lon, lat] = wp.location;
            L.marker([lat, lon])
             .bindPopup(i === 0 ? "Origem" : "Destino")
             .addTo(map);
         });
    }

    // Resize map
    setTimeout(() => {
      if (map) map.invalidateSize();
    }, 100);

  }, [routeData, activeRouteIndex, isOpen, inline]);

  const handleRouteClick = (index, route) => {
    setActiveRouteIndex(index);
    if (onRouteSelect) {
        onRouteSelect(route);
    }
  };

  if (!isOpen && !inline) return null;

  const routes = routeData?.alternatives || (routeData ? [routeData] : []);
  const activeRoute = routes[activeRouteIndex] || routeData;

  const Controls = () => (
      <div className="absolute top-2 right-2 z-[400] flex flex-col gap-2 max-w-[200px]">
          {routes.length > 1 && routes.map((r, idx) => (
              <button 
                key={idx}
                onClick={(e) => { e.stopPropagation(); handleRouteClick(idx, r); }}
                className={`text-xs p-2 rounded shadow-lg text-left transition-all ${
                    activeRouteIndex === idx 
                    ? 'bg-primary text-white scale-105' 
                    : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'
                }`}
              >
                  <div className="font-bold">{r.summary || `Rota ${idx + 1}`}</div>
                  <div>{r.distanceKm} km • {Math.floor(r.durationMinutes / 60)}h {r.durationMinutes % 60}m</div>
              </button>
          ))}
      </div>
  );

  if (inline) {
    return (
      <div className="w-full h-full relative bg-slate-100 dark:bg-slate-900 group">
        <div ref={mapRef} className="absolute inset-0 z-0" />
        <Controls />
        {!activeRoute?.geometry && (
           <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm">
             <div className="text-center p-4">
               <span className="material-icons text-4xl text-slate-400 mb-2">map</span>
               <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Mapa indisponível para rota estimada</p>
               <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">A distância e duração foram calculadas manualmente</p>
             </div>
           </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-5xl flex flex-col h-[80vh] border border-slate-200 dark:border-slate-700 overflow-hidden relative">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 z-10 relative">
          <div>
             <h3 className="font-bold text-xl text-slate-800 dark:text-white flex items-center gap-2">
               <span className="material-icons text-primary">alt_route</span> Rota Calculada
             </h3>
             <div className="text-xs text-slate-500 dark:text-slate-400 flex gap-4 mt-1">
               <span>Distância: <b>{activeRoute?.distanceKm} km</b></span>
               <span>Duração Est.: <b>{Math.floor((activeRoute?.durationMinutes || 0)/60)}h {(activeRoute?.durationMinutes || 0)%60}m</b></span>
             </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
            <span className="material-icons">close</span>
          </button>
        </div>
        <div className="flex-1 relative bg-slate-100 dark:bg-slate-900">
           <div ref={mapRef} className="absolute inset-0 z-0" />
           <Controls />
           {!activeRoute?.geometry && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <div className="text-center p-4">
                  <span className="material-icons text-4xl text-slate-400 mb-2">map</span>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Mapa indisponível para rota estimada</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">A distância e duração foram calculadas manualmente</p>
                </div>
              </div>
           )}
        </div>
      </div>
    </div>
  );
}
