"use client"

import { useEffect, useState, useRef } from "react"
import dynamic from "next/dynamic"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import { depotCityCoords } from "@/data/depot-coordinates"
import { depotCityIds as defaultDepots } from "@/data/depot-cities"

// Leaflet'i client-side only yükle
const MapContainer = dynamic(() => import("react-leaflet").then(mod => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import("react-leaflet").then(mod => mod.TileLayer), { ssr: false })
const Marker = dynamic(() => import("react-leaflet").then(mod => mod.Marker), { ssr: false })
const Popup = dynamic(() => import("react-leaflet").then(mod => mod.Popup), { ssr: false })
const Circle = dynamic(() => import("react-leaflet").then(mod => mod.Circle), { ssr: false })
const Polyline = dynamic(() => import("react-leaflet").then(mod => mod.Polyline), { ssr: false })
const DivIcon = dynamic(() => import("leaflet").then(mod => ({ DivIcon: mod.DivIcon })), { ssr: false })
const useMapEvents = dynamic(() => import("react-leaflet").then(mod => ({ useMapEvents: mod.useMapEvents })), { ssr: false })

const RING_PALETTE = [
  "#ef4444", "#0ea5e9", "#22c55e", "#a855f7", "#f59e0b",
  "#e11d48", "#06b6d4", "#84cc16", "#f97316", "#8b5cf6",
  "#10b981", "#d946ef", "#eab308", "#14b8a6", "#fb7185",
]

type Props = {
  defaultSelectedCityIds?: string[]
  defaultRadiusKm?: number
  storeCounts?: Record<string, number>
}

type MeasurementPoint = {
  lat: number
  lon: number
  name: string
}

export default function WorldMap({
  defaultSelectedCityIds = defaultDepots,
  defaultRadiusKm = 150,
  storeCounts = {},
}: Props) {
  const [radiusKm, setRadiusKm] = useState<number>(defaultRadiusKm)
  const [showLabels, setShowLabels] = useState(true)
  const [isClient, setIsClient] = useState(false)
  const [isMeasuring, setIsMeasuring] = useState(false)
  const [measurementPoints, setMeasurementPoints] = useState<MeasurementPoint[]>([])
  const [measurementMode, setMeasurementMode] = useState<'air' | 'road'>('air')
  const [excludeMarmara, setExcludeMarmara] = useState(false)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const getRingColor = (id: string) => {
    const idx = defaultSelectedCityIds.indexOf(id)
    return RING_PALETTE[(idx >= 0 ? idx : 0) % RING_PALETTE.length]
  }

  const humanLabel = (id: string) => {
    if (id === "istanbul-avr") return "İstanbul - AVR"
    if (id === "istanbul-and") return "İstanbul - AND"
    return id.charAt(0).toUpperCase() + id.slice(1)
  }

  // Mesafe hesaplama fonksiyonu
  const calculateDistance = (point1: MeasurementPoint, point2: MeasurementPoint, mode: 'air' | 'road') => {
    const R = 6371 // Dünya yarıçapı (km)
    
    const lat1 = point1.lat * Math.PI / 180
    const lat2 = point2.lat * Math.PI / 180
    const deltaLat = (point2.lat - point1.lat) * Math.PI / 180
    const deltaLon = (point2.lon - point1.lon) * Math.PI / 180

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    
    const airDistance = R * c

    if (mode === 'air') {
      return airDistance
    } else {
      // Karayolu mesafesi için daha gerçekçi hesaplama
      // Türkiye'de karayolu mesafesi genellikle kuş uçuşu mesafenin 1.2-1.8 katı
      // Dağlık bölgelerde daha fazla, düz bölgelerde daha az
      const roadMultiplier = 1.4 // Ortalama çarpan
      return airDistance * roadMultiplier
    }
  }

  // En yakın şehri bul
  const findNearestCity = (lat: number, lon: number) => {
    let nearestCity = null
    let minDistance = Infinity

    defaultSelectedCityIds.forEach(id => {
      const coord = depotCityCoords[id]
      if (coord) {
        const distance = Math.sqrt(
          Math.pow(coord.lat - lat, 2) + Math.pow(coord.lon - lon, 2)
        )
        if (distance < minDistance) {
          minDistance = distance
          nearestCity = { id, coord }
        }
      }
    })

    return nearestCity
  }



  // Leaflet event handling component
  const MapClickHandler = () => {
    useMapEvents({
      click: (e) => {
        if (!isMeasuring) return

        const { lat, lng } = e.latlng
        const nearestCity = findNearestCity(lat, lng)
        
        const pointName = nearestCity ? humanLabel(nearestCity.id) : `Nokta ${measurementPoints.length + 1}`
        
        setMeasurementPoints(prev => [...prev, { lat, lon: lng, name: pointName }])
      },
    })
    return null
  }

  // Mesafe ölçümünü başlat
  const startMeasurement = () => {
    setIsMeasuring(true)
    setMeasurementPoints([])
  }

  // Mesafe ölçümünü durdur
  const stopMeasurement = () => {
    setIsMeasuring(false)
    setMeasurementPoints([])
  }

  if (!isClient) {
    return (
      <div className="flex flex-col gap-8">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Dünya Haritası Yükleniyor...</h3>
          </CardHeader>
          <CardContent>
            <div className="w-full h-[500px] bg-gray-100 rounded flex items-center justify-center">
              <p>Harita yükleniyor...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Dünya Haritası - Depo Konumları</h3>
        </CardHeader>
        <CardContent>
          <div className="relative w-full h-[500px] rounded overflow-hidden">
            <MapContainer
              center={[39, 35]} // Türkiye merkezi
              zoom={6}
              style={{ height: "100%", width: "100%" }}
              ref={mapRef}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              
              {/* Harita tıklama event handler */}
              <MapClickHandler />
              
              {defaultSelectedCityIds.map((id) => {
                const coord = depotCityCoords[id]
                if (!coord) return null
                
                // Sabit yarıçap kullanacak şehirler ve yarıçap değerleri (veritabanından + varsayılan)
                const fixedRadiusCities: Record<string, number> = {
                  "İstanbul - AVR": 150, // Dünya haritasında sabit kalacak
                  "İstanbul - AND": 150, 
                  "duzce": 150,
                  "bursa": 250,
                  "eskisehir": 250,
                  "diyarbakir": 375
                }
                
                const color = getRingColor(id) // Her depo farklı renk
                // Sabit yarıçap kullanacak şehirler için özel yarıçap, diğerleri için kullanıcının seçtiği yarıçap
                const effectiveRadius = fixedRadiusCities[id] || radiusKm
                const radiusMeters = effectiveRadius * 1000 / 3.5 // 3.5 çarpanı karayolu mesafesi için
                
                // Debug bilgisi
                if (fixedRadiusCities[id]) {
                  console.log(`🔍 Dünya haritasında ${id} şehri için: sabit yarıçap=${effectiveRadius}km`)
                }
                
                return (
                  <div key={id}>
                    {/* Daire */}
                    <Circle
                      center={[coord.lat, coord.lon]}
                      radius={radiusMeters}
                      pathOptions={{ 
                        color: color, 
                        fillColor: color, 
                        fillOpacity: 0.15, 
                        weight: 2 
                      }}
                    />
                    
                                         {/* Küçük Marker */}
                     <Marker 
                       position={[coord.lat, coord.lon]}
                       icon={(() => {
                         if (typeof window !== 'undefined') {
                           const L = require('leaflet')
                           return new L.DivIcon({
                             html: `<div style="
                               width: 12px; 
                               height: 12px; 
                               background-color: ${color}; 
                               border: 2px solid white; 
                               border-radius: 50%; 
                               box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                               cursor: ${isMeasuring ? 'pointer' : 'default'};
                             "></div>`,
                             className: '',
                             iconSize: [12, 12],
                             iconAnchor: [6, 6]
                           })
                         }
                         return undefined
                       })()}
                       eventHandlers={{
                         click: () => {
                           if (isMeasuring) {
                             const pointName = humanLabel(id)
                             setMeasurementPoints(prev => [...prev, { lat: coord.lat, lon: coord.lon, name: pointName }])
                           }
                         }
                       }}
                     >
                       <Popup>
                         <div className="text-center">
                           <strong style={{ color }}>{humanLabel(id)}</strong><br/>
                           {storeCounts && storeCounts[id] && (
                             <div style={{ fontSize: '14px', margin: '4px 0', fontWeight: 'bold' }}>
                               📍 Mağaza Sayısı: {storeCounts[id]}
                             </div>
                           )}
                           <small>
                             Lat: {coord.lat.toFixed(3)}<br/>
                             Lon: {coord.lon.toFixed(3)}<br/>
                             Yarıçap: {effectiveRadius}km
                           </small>
                           {isMeasuring && (
                             <div className="mt-2">
                               <Button
                                 size="sm"
                                 onClick={() => {
                                   const pointName = humanLabel(id)
                                   setMeasurementPoints(prev => [...prev, { lat: coord.lat, lon: coord.lon, name: pointName }])
                                 }}
                                 className="w-full text-xs bg-blue-600 hover:bg-blue-700"
                               >
                                 📍 Ölçüme Ekle
                               </Button>
                             </div>
                           )}
                         </div>
                       </Popup>
                     </Marker>
                  </div>
                )
              })}

              {/* Mesafe ölçüm noktaları */}
              {measurementPoints.map((point, index) => (
                <Marker
                  key={index}
                  position={[point.lat, point.lon]}
                  icon={(() => {
                    if (typeof window !== 'undefined') {
                      const L = require('leaflet')
                      return new L.DivIcon({
                        html: `<div style="
                          width: 16px; 
                          height: 16px; 
                          background-color: #ff4444; 
                          border: 3px solid white; 
                          border-radius: 50%; 
                          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                          display: flex;
                          align-items: center;
                          justify-content: center;
                          color: white;
                          font-weight: bold;
                          font-size: 10px;
                        ">${index + 1}</div>`,
                        className: '',
                        iconSize: [16, 16],
                        iconAnchor: [8, 8]
                      })
                    }
                    return undefined
                  })()}
                >
                  <Popup>
                    <div className="text-center">
                      <strong>{point.name}</strong><br/>
                      <small>
                        Lat: {point.lat.toFixed(3)}<br/>
                        Lon: {point.lon.toFixed(3)}
                      </small>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Mesafe ölçüm çizgileri */}
              {measurementPoints.length >= 2 && (
                <Polyline
                  positions={measurementPoints.map(point => [point.lat, point.lon])}
                  pathOptions={{
                    color: '#ff4444',
                    weight: 3,
                    opacity: 0.8,
                    dashArray: '10, 5'
                  }}
                />
              )}
            </MapContainer>

            {/* Mesafe Ölçüm Aracı */}
            <div className="absolute top-4 right-4 bg-white rounded-lg border border-gray-200 shadow-lg p-3 z-[1000]">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
                  <span className="text-blue-600 text-sm">📏</span>
                </div>
                <span className="text-sm font-medium text-gray-800">Mesafe Ölçümü</span>
              </div>
              
              <div className="space-y-2">
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={measurementMode === 'air' ? 'default' : 'outline'}
                    onClick={() => setMeasurementMode('air')}
                    className="text-xs"
                  >
                    🕊️ Kuş Uçuşu
                  </Button>
                  <Button
                    size="sm"
                    variant={measurementMode === 'road' ? 'default' : 'outline'}
                    onClick={() => setMeasurementMode('road')}
                    className="text-xs"
                  >
                    🛣️ Karayolu
                  </Button>
                </div>
                
                {!isMeasuring ? (
                  <Button
                    size="sm"
                    onClick={startMeasurement}
                    className="w-full text-xs bg-green-600 hover:bg-green-700"
                  >
                    📍 Ölçüm Başlat
                  </Button>
                ) : (
                  <div className="space-y-1">
                    <Button
                      size="sm"
                      onClick={stopMeasurement}
                      className="w-full text-xs bg-red-600 hover:bg-red-700"
                    >
                      ❌ Ölçümü Durdur
                    </Button>
                    <div className="text-xs text-gray-600 text-center">
                      Haritaya tıklayarak nokta ekleyin
                    </div>
                  </div>
                )}
              </div>

              {/* Ölçüm Sonuçları */}
              {measurementPoints.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-xs font-medium text-gray-700 mb-1">
                    Ölçüm Noktaları ({measurementPoints.length})
                  </div>
                  <div className="space-y-1 max-h-20 overflow-y-auto">
                    {measurementPoints.map((point, index) => (
                      <div key={index} className="text-xs text-gray-600">
                        {index + 1}. {point.name}
                      </div>
                    ))}
                  </div>
                  {measurementPoints.length >= 2 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="text-xs font-medium text-gray-700">
                        Toplam Mesafe: {measurementPoints.reduce((total, point, index) => {
                          if (index === 0) return 0
                          return total + calculateDistance(measurementPoints[index - 1], point, measurementMode)
                        }, 0).toFixed(1)} km
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="flex items-center justify-between">
            <Label htmlFor="world-labels">Etiketleri Göster</Label>
            <Switch 
              id="world-labels" 
              checked={showLabels} 
              onCheckedChange={setShowLabels} 
            />
          </div>

          <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 text-lg">🎯</span>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="world-radius" className="text-base font-medium text-gray-800">Görselleştirme Yarıçapı</Label>
                <div className="relative group">
                  <span className="text-yellow-600 text-sm cursor-help">⚠️</span>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                    <div className="text-center">
                      <div className="font-semibold mb-1">Bilgilendirme</div>
                      <div>Bu ayar sadece görsel amaçlıdır.</div>
                      <div>Gerçek yarıçap değişiklikleri için</div>
                      <div>depo konumlarını düzenleyin.</div>
                    </div>
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                  </div>
                </div>
              </div>
              <p className="text-sm text-gray-500">Dünya haritasında görsel yarıçap boyutu</p>
            </div>
            <div className="flex items-center gap-3">
              <Input
                id="world-radius"
                type="number"
                min={50}
                max={500}
                step={50}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="w-32 text-center font-medium border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-600">km</span>
            </div>
          </div>

          <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <span className="text-red-600 text-lg">🚫</span>
              </div>
              <div>
                <Label htmlFor="world-exclude-marmara" className="text-base font-medium text-gray-800">Marmara Bölgesini Katma</Label>
                <p className="text-sm text-gray-500">İST-AVR, İST-AND, Düzce dairelerini sabit tut</p>
              </div>
            </div>
            <Switch 
              id="world-exclude-marmara" 
              checked={excludeMarmara} 
              onCheckedChange={setExcludeMarmara}
              className="data-[state=checked]:bg-blue-600"
            />
          </div>



          <div className="space-y-3">
            <Label>Depo Konumları (Global Koordinatlar)</Label>
            <div className="flex flex-wrap gap-2">
              {defaultSelectedCityIds.map((id) => {
                const coord = depotCityCoords[id]
                const color = getRingColor(id) // Her depo farklı renk
                const storeCount = storeCounts && storeCounts[id] ? storeCounts[id] : 0
                return (
                  <Badge 
                    key={id} 
                    variant="secondary" 
                    className="text-xs flex flex-col items-center p-2"
                    style={{ borderColor: color, minWidth: '120px' }}
                  >
                    <div style={{ color, fontWeight: 'bold' }}>{humanLabel(id)}</div>
                    {coord && (
                      <div className="text-gray-600">
                        ({coord.lat.toFixed(3)}, {coord.lon.toFixed(3)})
                      </div>
                    )}

                  </Badge>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
