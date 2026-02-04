import { useEffect, useRef, useState } from 'react';

export default function MapModal({ isOpen, onClose, onSelect, initialAddress }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [query, setQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(null); // { lat, lon, display_name }
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Init map if not exists
    if (!mapInstanceRef.current && mapRef.current) {
      const L = window.L;
      if (!L) return;

      const map = L.map(mapRef.current).setView([-17.8136, -50.5969], 13); // Santa Helena de Goiás default
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      }).addTo(map);

      map.on('click', async (e) => {
        const { lat, lng } = e.latlng;
        updateMarker(lat, lng);
        reverseGeocode(lat, lng);
      });

      mapInstanceRef.current = map;
    }

    // Wait for map to be ready then resize
    setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    }, 100);

    // If initial address provided, search it
    if (initialAddress && initialAddress.length > 3) {
      setQuery(initialAddress);
      searchLocation(initialAddress);
    }

    // Cleanup function
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOpen]);

  // Fix Leaflet icon issue
  useEffect(() => {
    const L = window.L;
    if (L) {
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
    }
  }, []);

  const formatAddress = (address) => {
    if (!address) return "";
    const parts = [
      address.road || address.street,
      address.house_number,
      address.suburb || address.neighborhood,
      address.city || address.town || address.village || address.municipality,
      address.state
    ];
    return parts.filter(Boolean).join(", ");
  };

  const updateMarker = (lat, lng) => {
    const L = window.L;
    if (!mapInstanceRef.current || !L) return;

    // Ensure icon options are set if they were missing
    const defaultIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      markerRef.current.setIcon(defaultIcon); // Force icon refresh
    } else {
      markerRef.current = L.marker([lat, lng], { icon: defaultIcon }).addTo(mapInstanceRef.current);
    }
    mapInstanceRef.current.panTo([lat, lng]);
  };

  const searchLocation = async (q, isRetry = false) => {
    if (!q) return;
    setLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const first = data[0];
        const lat = parseFloat(first.lat);
        const lon = parseFloat(first.lon);
        updateMarker(lat, lon);
        
        const shortName = formatAddress(first.address) || first.display_name;
        setSelectedLocation({ lat, lon, display_name: shortName });
      } else {
        // Fallback strategy: try to search for the city/region part if exact match fails
        if (!isRetry && q.includes(',')) {
            // Split by comma and try the last meaningful part (usually city - state)
            const parts = q.split(',');
            if (parts.length > 1) {
                // Try the part after the first comma (e.g. "Unnamed Rd,, Itumbiara - GO" -> " Itumbiara - GO")
                const fallbackQuery = parts.slice(1).join(',').trim();
                if (fallbackQuery.length > 3) {
                    console.log(`Retrying search with fallback: ${fallbackQuery}`);
                    await searchLocation(fallbackQuery, true);
                    return; // Exit here as the recursive call handles the rest
                }
            }
        }

        // Simple feedback for no results (only if retry also failed or wasn't attempted)
        const input = document.querySelector('input[placeholder*="Digite o endereço"]');
        if (input) {
            input.classList.add('input-error');
            setTimeout(() => input.classList.remove('input-error'), 2000);
        }
      }
    } catch (e) {
      console.error("Geocoding error", e);
    } finally {
      if (!isRetry) setLoading(false); // Only unset loading if we're not diving into a retry
    }
  };

  const reverseGeocode = async (lat, lon) => {
    setLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
      const data = await res.json();
      if (data) {
        const shortName = formatAddress(data.address) || data.display_name;
        setSelectedLocation({ lat, lon, display_name: shortName, full: data });
      }
    } catch (e) {
      console.error("Reverse geocoding error", e);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      onSelect(selectedLocation.display_name);
    }
    onClose();
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        updateMarker(latitude, longitude);
        reverseGeocode(latitude, longitude);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      }
    );
  };

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade ${isFullscreen ? 'p-0' : 'p-4'}`}>
      <div className={`bg-white dark:bg-slate-800 shadow-2xl flex flex-col border border-slate-200 dark:border-slate-700 overflow-hidden transition-all duration-300 ${
        isFullscreen 
          ? "w-screen h-screen rounded-none" 
          : "w-full max-w-7xl h-[90vh] rounded-xl"
      }`}>
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800">
          <div>
             <h3 className="font-bold text-xl text-slate-800 dark:text-white flex items-center gap-2">
               <span className="material-icons text-primary">map</span> Selecionar Localização
             </h3>
             <p className="text-xs text-slate-500 dark:text-slate-400">Busque um endereço ou clique no mapa</p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                setIsFullscreen(!isFullscreen);
                setTimeout(() => {
                  if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
                }, 300);
              }} 
              className="btn btn-ghost btn-sm btn-circle text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
            >
              <span className="material-icons">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
            </button>
            <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">
              <span className="material-icons">close</span>
            </button>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 flex gap-2 border-b border-slate-100 dark:border-slate-700">
          <div className="flex-1 relative">
            <input 
              className="input input-bordered w-full pl-10 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary transition-all" 
              placeholder="Digite o endereço (Rua, Cidade, Estado...)" 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchLocation(query)}
            />
            <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
          </div>
          <button 
            className="btn btn-primary px-6" 
            onClick={() => searchLocation(query)} 
            disabled={loading}
          >
            {loading ? <span className="loading loading-spinner loading-xs"></span> : "Buscar"}
          </button>
          <button 
            className="btn btn-square btn-outline btn-secondary" 
            onClick={handleLocateMe}
            title="Minha Localização"
          >
            <span className="material-icons">my_location</span>
          </button>
        </div>

        {/* Map Area */}
        <div className="flex-1 relative bg-slate-100 dark:bg-slate-900">
          <div ref={mapRef} className="absolute inset-0 z-0" />
          
          {/* Floating info if needed, currently empty */}
          {loading && (
             <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow-lg z-[400] flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
               <span className="loading loading-spinner loading-xs text-primary"></span>
               Carregando mapa...
             </div>
          )}
        </div>

        {/* Footer / Selection Info */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex-1 w-full">
            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider mb-1">Endereço Selecionado</div>
            <div className={`text-sm p-3 rounded-lg border ${selectedLocation ? 'bg-blue-50 border-blue-100 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200' : 'bg-slate-50 border-slate-100 text-slate-500 dark:bg-slate-800 dark:border-slate-700'}`}>
              {selectedLocation ? (
                <div className="flex items-start gap-2">
                  <span className="material-icons text-blue-500 text-sm mt-0.5">place</span>
                  <span className="font-medium">{selectedLocation.display_name}</span>
                </div>
              ) : (
                <span className="italic">Nenhum local selecionado. Clique no mapa ou busque acima.</span>
              )}
            </div>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto mt-2 md:mt-0">
            <button className="btn btn-ghost text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 flex-1 md:flex-none" onClick={onClose}>
              Cancelar
            </button>
            <button 
              className="btn btn-success text-white px-8 flex-1 md:flex-none shadow-lg hover:shadow-green-500/30 transition-all transform active:scale-95" 
              onClick={handleConfirm}
              disabled={!selectedLocation}
            >
              <span className="material-icons">check_circle</span> Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}