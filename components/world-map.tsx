"use client"

import { useEffect, useState, useRef } from "react"
import dynamic from "next/dynamic"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"

import { depotCityCoords } from "@/data/depot-coordinates"
import { depotCityIds as defaultDepots } from "@/data/depot-cities"

// Leaflet'i client-side only yükle
const MapContainer = dynamic(() => import("react-leaflet").then(mod => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import("react-leaflet").then(mod => mod.TileLayer), { ssr: false })
const Marker = dynamic(() => import("react-leaflet").then(mod => mod.Marker), { ssr: false })
const Popup = dynamic(() => import("react-leaflet").then(mod => mod.Popup), { ssr: false })
const Circle = dynamic(() => import("react-leaflet").then(mod => mod.Circle), { ssr: false })
const DivIcon = dynamic(() => import("leaflet").then(mod => ({ DivIcon: mod.DivIcon })), { ssr: false })

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

export default function WorldMap({
  defaultSelectedCityIds = defaultDepots,
  defaultRadiusKm = 150,
  storeCounts = {},
}: Props) {
  const [radiusKm, setRadiusKm] = useState<number>(defaultRadiusKm)
  const [showLabels, setShowLabels] = useState(true)
  const [isClient, setIsClient] = useState(false)


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
          <div className="w-full h-[500px] rounded overflow-hidden">
            <MapContainer
              center={[39, 35]} // Türkiye merkezi
              zoom={6}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              
              {defaultSelectedCityIds.map((id) => {
                const coord = depotCityCoords[id]
                if (!coord) return null
                
                const color = getRingColor(id) // Her depo farklı renk
                const radiusMeters = radiusKm * 1000 / 3.5 // 3.5 çarpanı karayolu mesafesi için
                
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
                            "></div>`,
                            className: '',
                            iconSize: [12, 12],
                            iconAnchor: [6, 6]
                          })
                        }
                        return undefined
                      })()}
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
                            Yarıçap: {radiusKm}km
                          </small>
                        </div>
                      </Popup>
                    </Marker>
                  </div>
                )
              })}
            </MapContainer>
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

          <div className="space-y-2">
            <Label htmlFor="world-radius">Görselleştirme Yarıçapı</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="world-radius"
                type="number"
                min={50}
                max={500}
                step={50}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="w-32"
              />
              <span className="text-xs text-muted-foreground">
                Dünya haritasında görsel yarıçap boyutu
              </span>
            </div>
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
