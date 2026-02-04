import { useEffect, useRef, useState } from 'react';

export default function RouteViewer({ isOpen, onClose, routeData, inline = false, onRouteSelect, isLoading = false }) {
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
    if ((!isOpen && !inline) || !mapRef.current) return;
    if (mapInstanceRef.current) return; // Map already initialized

    const L = window.L;
    if (!L) return;

    try {
        const map = L.map(mapRef.current, {
            zoomControl: false, // Add zoom control manually if needed or keep clean
            attributionControl: false
        }).setView([-17.8136, -50.5969], 13); // Santa Helena de Goiás default
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        mapInstanceRef.current = map;

        // Force a resize check immediately and periodically to handle modal transitions
        const forceResize = () => {
            if (map && map._container) {
                map.invalidateSize();
            }
        };

        // Multiple checks to catch animation frames
        setTimeout(forceResize, 10);
        setTimeout(forceResize, 100);
        setTimeout(forceResize, 300);
        setTimeout(forceResize, 500);
        setTimeout(forceResize, 1000);

        // ResizeObserver for robustness
        const resizeObserver = new ResizeObserver(() => {
            forceResize();
        });
        resizeObserver.observe(mapRef.current);
        
        // Save observer to ref for cleanup if needed, though closure handles it
        map._resizeObserver = resizeObserver;

    } catch (err) {
        console.error("Error initializing map:", err);
    }

    // Cleanup
    return () => {
      if (mapInstanceRef.current) {
        // Stop observer
        if (mapInstanceRef.current._resizeObserver) {
            mapInstanceRef.current._resizeObserver.disconnect();
        }
        
        // Remove map
        try {
            mapInstanceRef.current.remove();
        } catch (e) {
            console.warn("Error removing map:", e);
        }
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

    // Clear old layers safely
    if (routeLayersRef.current) {
        routeLayersRef.current.forEach(l => {
            try { map.removeLayer(l); } catch(e) {}
        });
        routeLayersRef.current = [];
    }

    const routes = routeData.alternatives || [routeData];
    
    // Draw all routes
    routes.forEach((route, index) => {
        if (!route.geometry) return;
        
        const isActive = index === activeRouteIndex;
        // Active: Blue, Inactive: Gray
        const color = isActive ? '#2563eb' : '#94a3b8'; 
        const weight = isActive ? 5 : 4;
        const opacity = isActive ? 0.8 : 0.5;

        try {
            const layer = L.geoJSON(route.geometry, {
                style: { color, weight, opacity }
            }).addTo(map);

            if (isActive) {
                layer.bringToFront();
                // Fit bounds with delay to ensure map size is correct
                setTimeout(() => {
                    try {
                        if (map && map._container) {
                            map.fitBounds(layer.getBounds(), { padding: [20, 20] });
                            map.invalidateSize(); // Ensure size is correct before fitting
                        }
                    } catch(e) {}
                }, 100);
            }
            
            // Add click handler to layer to select it
            layer.on('click', () => {
                 handleRouteClick(index, route);
            });

            routeLayersRef.current.push(layer);
        } catch (e) {
            console.error("Error drawing route layer:", e);
        }
    });
    
    // Add markers for start/end
    if (routeData.waypoints) {
         routeData.waypoints.forEach((wp, i) => {
            const [lon, lat] = wp.location;
            try {
                L.marker([lat, lon])
                 .bindPopup(i === 0 ? "Origem" : "Destino")
                 .addTo(map);
            } catch (e) {}
         });
    }

    // Explicitly invalidate size after drawing
    setTimeout(() => {
        if (map) map.invalidateSize();
    }, 50);

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
        {isLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3 animate-pulse">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-slate-500 text-sm font-medium">Carregando mapa...</span>
                </div>
            </div>
        )}
        {!activeRoute?.geometry && !isLoading && (
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
           {isLoading && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-3 animate-pulse">
                        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-slate-500 text-sm font-medium">Carregando mapa...</span>
                    </div>
                </div>
            )}
           {!activeRoute?.geometry && !isLoading && (
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
