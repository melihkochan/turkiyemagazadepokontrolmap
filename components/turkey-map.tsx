"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { referenceColors } from "@/data/reference-colors"
import { depotCityIds as defaultDepots } from "@/data/depot-cities"
import { depotCityCoords } from "@/data/depot-coordinates"
import { getDynamicStoreCounts } from "@/data/store-counts"
import { getCityStoreCounts, updateCityStoreCount, updateMultipleCityStoreCounts, initializeDatabase, clearAllData, getCityColors, updateCityColor, updateMultipleCityColors, clearAllCityColors, getCityRadii, updateCityRadius, clearAllCityRadii } from "@/lib/supabase"
import jsPDF from "jspdf"

const RING_PALETTE = [
  "#ef4444",
  "#0ea5e9",
  "#22c55e",
  "#a855f7",
  "#f59e0b",
  "#e11d48",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#8b5cf6",
  "#10b981",
  "#d946ef",
  "#eab308",
  "#14b8a6",
  "#fb7185",
  "#65a30d",
  "#1f2937",
  "#64748b",
]

type CityPos = { id: string; name: string; cx: number; cy: number }

type Props = {
  defaultSelectedCityIds?: string[]
  defaultRadiusKm?: number
  mapHeightClass?: string
}

/** Türkiye yaklaşık bbox — lat/lon <-> SVG dönüşümü için */
const TR_BOUNDS = { minLon: 26.0, maxLon: 44.8, minLat: 35.8, maxLat: 42.1 }

function latlonToSvg(lat: number, lon: number, svg: SVGSVGElement) {
  const vb = svg.viewBox.baseVal
  const x = vb.x + ((lon - TR_BOUNDS.minLon) / (TR_BOUNDS.maxLon - TR_BOUNDS.minLon)) * vb.width
  const y = vb.y + ((TR_BOUNDS.maxLat - lat) / (TR_BOUNDS.maxLat - TR_BOUNDS.minLat)) * vb.height
  return { x, y }
}
function svgToLatLon(x: number, y: number, svg: SVGSVGElement) {
  const vb = svg.viewBox.baseVal
  const lon = TR_BOUNDS.minLon + ((x - vb.x) / vb.width) * (TR_BOUNDS.maxLon - TR_BOUNDS.minLon)
  const lat = TR_BOUNDS.maxLat - ((y - vb.y) / vb.height) * (TR_BOUNDS.maxLat - TR_BOUNDS.minLat)
  return { lat, lon }
}

/** Gerçek jeodezik halka (path d) - Dünya'nın eğriliği hesaba katılarak */
function geodesicCirclePath(lat: number, lon: number, radiusKm: number, svg: SVGSVGElement, stepDeg = 3) {
  // Karayolu 150km = kuş uçuşu ~40km (görsellerle uyumlu küçük daireler)
  const airDistanceKm = radiusKm / 3.5
  
  // Dünya'nın yarıçapı (km)
  const R = 6371
  
  // Merkez nokta koordinatları (radyan)
  const φ1 = (lat * Math.PI) / 180  // Enlem
  const λ1 = (lon * Math.PI) / 180  // Boylam
  
  // Açısal mesafe (radyan)
  const δ = airDistanceKm / R

  const points: { x: number; y: number }[] = []
  
  // Her yöne (0°-360°) noktalar hesapla
  for (let bearing = 0; bearing <= 360; bearing += stepDeg) {
    const θ = (bearing * Math.PI) / 180  // Yön açısı (radyan)
    
    // Trigonometrik hesaplamalar
    const sinφ1 = Math.sin(φ1)
    const cosφ1 = Math.cos(φ1)
    const sinδ = Math.sin(δ)
    const cosδ = Math.cos(δ)

    // Yeni nokta koordinatları (jeodezik formül)
    const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ)
    const φ2 = Math.asin(sinφ2)
    const y = Math.sin(θ) * sinδ * cosφ1
    const x = cosδ - sinφ1 * sinφ2
    const λ2 = λ1 + Math.atan2(y, x)

    // Radyan -> derece
    const lat2 = (φ2 * 180) / Math.PI
    const lon2 = (λ2 * 180) / Math.PI
    
    // SVG koordinatlarına çevir
    const p = latlonToSvg(lat2, lon2, svg)
    points.push({ x: p.x, y: p.y })
  }
  
  if (!points.length) return ""
  
  // SVG path oluştur
  const [p0, ...rest] = points
  return (
    `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} ` +
    rest.map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") +
    " Z"
  )
}

export default function TurkeyMap({
  defaultSelectedCityIds = defaultDepots,
  defaultRadiusKm = 150,
  mapHeightClass = "min-h-[100vh]", // Haritayı tam ekran yaptım
}: Props) {
  const [selectedCityIds, setSelectedCityIds] = useState<Set<string>>(new Set(defaultSelectedCityIds))
  const [radiusKm, setRadiusKm] = useState(defaultRadiusKm)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [cityColors, setCityColors] = useState<Record<string, string>>({})
  const [defaultColors, setDefaultColors] = useState<Record<string, string>>({})
  const [cityRadii, setCityRadii] = useState<Record<string, number>>({})
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [dbLoading, setDbLoading] = useState(false)
  const [colorLoading, setColorLoading] = useState(false)
  const [radiusLoading, setRadiusLoading] = useState(false)
  const [selectedCityForColor, setSelectedCityForColor] = useState<string>("")
  const [newColor, setNewColor] = useState<string>("#ef4444")
  const [debouncedColor, setDebouncedColor] = useState<string>("#ef4444")
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false)
  const [excludeMarmara, setExcludeMarmara] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [loading, setLoading] = useState(true)
  const [cities, setCities] = useState<CityPos[]>([])
  const [showLabels, setShowLabels] = useState(true)
  const [searchEditor, setSearchEditor] = useState("")

  const getRingColor = (id: string) => {
    // Daireler için sabit renkler kullan (karışıklık olmasın)
    const idx = Array.from(selectedCityIds).indexOf(id)
    return RING_PALETTE[(idx >= 0 ? idx : 0) % RING_PALETTE.length]
  }

  useEffect(() => {
    let cancelled = false
    async function loadSvgHtml() {
      try {
        const res = await fetch("/assets/index.html")
        const html = await res.text()
        if (cancelled) return
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, "text/html")
        const svg = doc.querySelector("svg") as SVGSVGElement | null
        if (!svg) {
          console.error("SVG not found at /assets/index.html")
          return
        }
        const container = containerRef.current
        if (!container) return
        container.innerHTML = ""
        container.appendChild(svg)
        svgRef.current = svg
        
        // Haritayı biraz uzaklaştır (zoom out) - daha geniş görünüm
        const originalViewBox = svg.getAttribute("viewBox") || "0 0 1000 618"
        const [x, y, w, h] = originalViewBox.split(" ").map(Number)
        // %15 zoom out (daha geniş alan göster)
        const zoomFactor = 1.15
        const newW = w * zoomFactor
        const newH = h * zoomFactor
        const offsetX = (newW - w) / 2
        const offsetY = (newH - h) / 2
        svg.setAttribute("viewBox", `${x - offsetX} ${y - offsetY} ${newW} ${newH}`)

        // Layers
        const ringsLayer = document.createElementNS("http://www.w3.org/2000/svg", "g")
        ringsLayer.setAttribute("id", "rings-layer")
        svg.appendChild(ringsLayer)

        const labelsLayer = document.createElementNS("http://www.w3.org/2000/svg", "g")
        labelsLayer.setAttribute("id", "labels-layer")
        svg.appendChild(labelsLayer)

        // Detect provinces
        const cityGroups = Array.from(svg.querySelectorAll("#turkiye > g[id]")) as SVGGElement[]
        const detected: CityPos[] = cityGroups.map((g) => {
          const b = g.getBBox()
          const cx = b.x + b.width / 2
          const cy = b.y + b.height / 2
          const name = (g.getAttribute("data-iladi") || g.id || "").trim()
          const id = g.id.toLowerCase()
          return { id, name, cx, cy }
        })

        console.log('🔍 SVG\'de tespit edilen şehirler:', detected)
        setCities(detected)

        // paintAllDefault'i kaldırdık - renkler useEffect ile uygulanacak
        // paintAllDefault(svg)

        if (showLabels) {
          renderLabels(labelsLayer, detected, counts, svg, new Set(selectedCityIds))
        }

      } catch (e) {
        console.error(e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadSvgHtml()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Component mount olduğunda verileri otomatik yükle
  useEffect(() => {
    // Önce veritabanından renkleri ve yarıçapları yükle, sonra SVG'yi yükle
    const loadData = async () => {
      await loadColorsFromDatabase()
      await loadRadiiFromDatabase()
      await loadFromDatabase()
    }
    loadData()
    
    // Environment variables kontrolü
    console.log('🔍 Environment Variables Check:')
    console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Not Set')
    console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Not Set')
  }, [])

  // SVG yüklendiğinde renkleri uygula
  useEffect(() => {
    if (svgRef.current && (Object.keys(cityColors).length > 0 || Object.keys(defaultColors).length > 0)) {
      console.log('SVG yüklendi, renkler uygulanıyor:', { cityColors, defaultColors })
      
      if (Object.keys(cityColors).length > 0) {
        // Veritabanından gelen renkleri şehir haritalarına uygula
        Object.entries(cityColors).forEach(([cityName, color]) => {
          console.log(`${cityName} şehri için renk uygulanıyor: ${color}`)
          // Şehir adını kullanarak SVG'deki grubu bul ve renk uygula
          setGroupColor(svgRef.current!, cityName, color)
        })
      } else if (Object.keys(defaultColors).length > 0) {
        // Veritabanından gelen default renkleri kullan
        Object.entries(defaultColors).forEach(([cityName, color]) => {
          console.log(`${cityName} şehri için default renk uygulanıyor: ${color}`)
          // Şehir adını kullanarak SVG'deki grubu bul ve renk uygula
          setGroupColor(svgRef.current!, cityName, color)
        })
      }
    } else if (svgRef.current && Object.keys(cityColors).length === 0 && Object.keys(defaultColors).length === 0) {
      // Hiç renk yüklenmemişse, reference colors'ı uygula
      console.log('Veritabanından renk yüklenmedi, reference colors uygulanıyor')
      console.log('🔍 Reference colors:', referenceColors)
      applyReferenceColors(svgRef.current, referenceColors)
    }
  }, [cityColors, defaultColors, svgRef.current])

  // SVG yüklendiğinde ve hiç renk yoksa reference colors'ı uygula
  useEffect(() => {
    if (svgRef.current && !loading && Object.keys(cityColors).length === 0 && Object.keys(defaultColors).length === 0) {
      console.log('SVG yüklendi ama renk yok, reference colors uygulanıyor')
      applyReferenceColors(svgRef.current, referenceColors)
    }
  }, [loading, cityColors, defaultColors, svgRef.current])

  // Veritabanından veri çek
  const loadFromDatabase = async () => {
    setDbLoading(true)
    try {
      console.log('Environment variables:', {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '***' : 'undefined'
      })
      
      const dbCounts = await getDynamicStoreCounts()
      setCounts(dbCounts)
      console.log('Veritabanından veriler yüklendi:', dbCounts)
      console.log('🔍 Veritabanından gelen mağaza sayısı:', Object.keys(dbCounts).length)
      console.log('🔍 Örnek veriler:', Object.entries(dbCounts).slice(0, 5))
    } catch (error) {
      console.error('Veri yükleme hatası:', error)
    } finally {
      setDbLoading(false)
    }
  }

  const loadColorsFromDatabase = async () => {
    setColorLoading(true)
    try {
      const dbColors = await getCityColors()
      setCityColors(dbColors)
      setDefaultColors(dbColors) // Veritabanından gelen renkleri default olarak da sakla
      console.log('Veritabanından şehir renkleri yüklendi:', dbColors)
      console.log('🔍 Veritabanından gelen renk sayısı:', Object.keys(dbColors).length)
    } catch (error) {
      console.error('Veritabanından renk yükleme hatası:', error)
    } finally {
      setColorLoading(false)
    }
  }

  const loadRadiiFromDatabase = async () => {
    setRadiusLoading(true)
    try {
      const dbRadii = await getCityRadii()
      setCityRadii(dbRadii)
      console.log('Veritabanından şehir yarıçapları yüklendi:', dbRadii)
      console.log('🔍 Veritabanından gelen yarıçap sayısı:', Object.keys(dbRadii).length)
    } catch (error) {
      console.error('Veritabanından yarıçap yükleme hatası:', error)
    } finally {
      setRadiusLoading(false)
    }
  }

  // Veritabanını başlat
  const initializeDatabaseHandler = async () => {
    setDbLoading(true)
    try {
      const success = await initializeDatabase()
      if (success) {
        // Başlatıldıktan sonra verileri yükle
        await loadFromDatabase()
        await loadColorsFromDatabase()
        await loadRadiiFromDatabase()
        console.log('Veritabanı başlatıldı ve tüm veriler yüklendi')
      }
    } catch (error) {
      console.error('Veritabanı başlatma hatası:', error)
    } finally {
      setDbLoading(false)
    }
  }



  // Tek şehir güncelleme
  const updateCityCount = async (cityId: string, newCount: number) => {
    setDbLoading(true)
    try {
      const success = await updateCityStoreCount(cityId, newCount)
      if (success) {
        setCounts(prev => ({ ...prev, [cityId]: newCount }))
        console.log(`${cityId} şehri için mağaza sayısı güncellendi: ${newCount}`)
      } else {
        console.error(`${cityId} şehri için mağaza sayısı güncellenemedi`)
      }
    } catch (error) {
      console.error('Mağaza sayısı güncelleme hatası:', error)
    } finally {
      setDbLoading(false)
    }
  }

  // Debounced color update
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedColor(newColor)
    }, 300) // 300ms gecikme

    return () => clearTimeout(timer)
  }, [newColor])

  const updateCityColorHandler = async (cityName: string, newColor: string) => {
    console.log('Renk güncelleme başlatılıyor:', { cityName, newColor })
    setColorLoading(true)
    try {
      const success = await updateCityColor(cityName, newColor)
      console.log('Renk güncelleme sonucu:', success)
      
      if (success) {
        // Sadece state'i güncelle, useEffect otomatik olarak SVG'yi güncelleyecek
        setCityColors(prev => ({ ...prev, [cityName]: newColor }))
        console.log(`${cityName} şehri için renk güncellendi: ${newColor}`)
      } else {
        console.error(`${cityName} şehri için renk güncellenemedi`)
      }
    } catch (error) {
      console.error('Renk güncelleme hatası:', error)
    } finally {
      setColorLoading(false)
    }
  }

  const resetAllColors = async () => {
    setColorLoading(true)
    try {
      const success = await clearAllCityColors()
      if (success) {
        setCityColors({})
        setDefaultColors({}) // defaultColors state'ini de temizle
        console.log('Tüm şehir renkleri sıfırlandı')
        
        // SVG'de varsayılan renkleri uygula
        if (svgRef.current) {
          const { referenceColors } = await import('@/data/reference-colors')
          applyReferenceColors(svgRef.current, referenceColors)
          
          // cityColors state'ini temizle ki SVG'de doğru renkler görünsün
          setCityColors({})
        }
      } else {
        console.error('Şehir renkleri sıfırlanamadı')
      }
    } catch (error) {
      console.error('Renk sıfırlama hatası:', error)
    } finally {
      setColorLoading(false)
    }
  }

  // Debounce için timeout'ları sakla
  const radiusUpdateTimeouts = useRef<Record<string, NodeJS.Timeout>>({})

  // Şehir yarıçap değerini güncelle (debounced)
  const updateCityRadiusHandler = async (cityName: string, newRadius: number) => {
    // Önceki timeout'u temizle
    if (radiusUpdateTimeouts.current[cityName]) {
      clearTimeout(radiusUpdateTimeouts.current[cityName])
    }

    // Yeni timeout ayarla (500ms sonra güncelle)
    radiusUpdateTimeouts.current[cityName] = setTimeout(async () => {
      console.log('Yarıçap güncelleme başlatılıyor:', { cityName, newRadius })
      setRadiusLoading(true)
      try {
        const success = await updateCityRadius(cityName, newRadius)
        console.log('Yarıçap güncelleme sonucu:', success)
        
        if (success) {
          // Sadece state'i güncelle, useEffect otomatik olarak daireleri güncelleyecek
          setCityRadii(prev => ({ ...prev, [cityName]: newRadius }))
          console.log(`${cityName} şehri için yarıçap güncellendi: ${newRadius}km`)
        } else {
          console.error(`${cityName} şehri için yarıçap güncellenemedi`)
        }
      } catch (error) {
        console.error('Yarıçap güncelleme hatası:', error)
      } finally {
        setRadiusLoading(false)
      }
    }, 500) // 500ms debounce
  }

  // Re-render labels on toggle/data change
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const labelsLayer = svg.querySelector("#labels-layer") as SVGGElement | null
    if (!labelsLayer) return
    labelsLayer.innerHTML = ""
    if (showLabels) {
      renderLabels(labelsLayer, cities, counts, svg, new Set(selectedCityIds))
    }
  }, [showLabels, cities, counts, selectedCityIds])

  // Draw geodesic rings from depot dots next to city labels
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const ringsLayer = svg.querySelector("#rings-layer") as SVGGElement | null
    if (!ringsLayer) return
    ringsLayer.innerHTML = ""

    // Sabit yarıçap kullanacak şehirler ve yarıçap değerleri (veritabanından + varsayılan)
    const fixedRadiusCities: Record<string, number> = {
      "İstanbul - AVR": cityRadii["İstanbul - AVR"] || 150,
      "İstanbul - AND": cityRadii["İstanbul - AND"] || 150, 
      "duzce": cityRadii["Düzce"] || 150,
      "bursa": cityRadii["Bursa"] || 250,
      "eskisehir": cityRadii["Eskişehir"] || 250,
      "diyarbakir": cityRadii["Diyarbakır"] || 375
    }

    selectedCityIds.forEach((id) => {
      const dotPos = getDepotDotPosition(id, cities, svg)
      if (!dotPos) return
      
      // Nokta konumunu lat/lon'a çevir (daire bu konumdan çizilsin)
      const { lat, lon } = svgToLatLon(dotPos.cx, dotPos.cy, svg)
      const color = getRingColor(id) // Her depo farklı renk
      const label = humanLabel(id)
      
      // Sabit yarıçap kullanacak şehirler için özel yarıçap, diğerleri için kullanıcının seçtiği yarıçap
      const effectiveRadius = fixedRadiusCities[id] || radiusKm
      
      // Debug bilgisi
      if (fixedRadiusCities[id]) {
        console.log(`🔍 ${id} şehri için: sabit yarıçap=${effectiveRadius}km`)
      }
      
      const d = geodesicCirclePath(lat, lon, effectiveRadius, svg, 3)
      drawRingWithDot(ringsLayer, dotPos.cx, dotPos.cy, d, color, label)
    })
  }, [selectedCityIds, radiusKm, cities, excludeMarmara, cityRadii])

  async function exportPDF() {
    const svg = svgRef.current
    if (!svg) return
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute("version", "1.1")
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink")

    const vb = svg.viewBox.baseVal
    const vbW = vb?.width || svg.clientWidth || 1600
    const vbH = vb?.height || svg.clientHeight || 800

    const xml = new XMLSerializer().serializeToString(clone)
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(blob)

    const scale = 2
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(vbW * scale)
    canvas.height = Math.round(vbH * scale)
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      URL.revokeObjectURL(url)
      return
    }
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const img = new Image()
    img.crossOrigin = "anonymous"
    const done = new Promise<void>((resolve, reject) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve()
      }
      img.onerror = reject
    })
    img.src = url
    await done
    URL.revokeObjectURL(url)

    const dataUrl = canvas.toDataURL("image/png")
    const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a3" })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const margin = 24
    const maxW = pageW - margin * 2
    const maxH = pageH - margin * 2
    const imgW = canvas.width
    const imgH = canvas.height
    const ratio = Math.min(maxW / imgW, maxH / imgH)
    const drawW = imgW * ratio
    const drawH = imgH * ratio
    const x = (pageW - drawW) / 2
    const y = (pageH - drawH) / 2
    pdf.addImage(dataUrl, "PNG", x, y, drawW, drawH)
    pdf.save("turkiye-harita-a3.pdf")
  }

  const humanLabel = (id: string) => {
    if (id === "İstanbul - AVR") return "İstanbul - AVR"
    if (id === "İstanbul - AND") return "İstanbul - AND"
    const found = cities.find((c) => c.id === id)
    return found?.name || id
  }

  const toggleFullscreen = () => {
    const mapCard = containerRef.current?.closest('.flex.flex-col.gap-8')?.firstElementChild as HTMLElement
    
    if (!isFullscreen) {
      // Tam ekrana geç
      if (mapCard?.requestFullscreen) {
        mapCard.requestFullscreen()
        setIsFullscreen(true)
      } else if ((mapCard as any)?.webkitRequestFullscreen) {
        (mapCard as any).webkitRequestFullscreen()
        setIsFullscreen(true)
      } else if ((mapCard as any)?.msRequestFullscreen) {
        (mapCard as any).msRequestFullscreen()
        setIsFullscreen(true)
      }
    } else {
      // Tam ekrandan çık
      if (document.exitFullscreen) {
        document.exitFullscreen()
        setIsFullscreen(false)
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen()
        setIsFullscreen(false)
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen()
        setIsFullscreen(false)
      }
    }
  }

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('msfullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('msfullscreenchange', handleFullscreenChange)
    }
  }, [])



  const editorList = useMemo(() => {
    // Sadece counts'tan gelen key'leri kullan, duplicate olmasın
    const keys = Object.keys(counts)
    
    const q = searchEditor.trim().toLowerCase()
    const filtered = q.length ? keys.filter((k) => k.includes(q) || humanLabel(k).toLowerCase().includes(q)) : keys
    filtered.sort((a, b) => humanLabel(a).localeCompare(humanLabel(b), "tr"))
    return filtered
  }, [counts, searchEditor, cities])

  // Renk seçici için mouse event handlers - useCallback ile optimize edildi
  const handleColorMouseDown = useCallback(() => {
    setIsColorPickerOpen(true)
  }, [])

  const handleColorMouseUp = useCallback(() => {
    setIsColorPickerOpen(false)
    // Mouse up'ta final rengi güncelle
    setDebouncedColor(newColor)
  }, [newColor])

  const handleColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value
    setNewColor(color)
    // Real-time güncellemeyi kaldırdık - sadece mouse up'ta güncelleniyor
  }, [])

  // Touch events için de optimize edelim
  const handleColorTouchStart = useCallback(() => {
    setIsColorPickerOpen(true)
  }, [])

  const handleColorTouchEnd = useCallback(() => {
    setIsColorPickerOpen(false)
    // Touch end'de final rengi güncelle
    setDebouncedColor(newColor)
  }, [newColor])

  // Renk seçici için memoized değerler
  const colorPickerProps = useMemo(() => ({
    value: newColor,
    onChange: handleColorChange,
    onMouseDown: handleColorMouseDown,
    onMouseUp: handleColorMouseUp,
    onTouchStart: handleColorTouchStart,
    onTouchEnd: handleColorTouchEnd,
    className: "w-12 h-8 rounded border border-gray-300 cursor-pointer transition-colors duration-150 will-change-auto"
  }), [newColor, handleColorChange, handleColorMouseDown, handleColorMouseUp, handleColorTouchStart, handleColorTouchEnd])

  return (
    <div className="flex flex-col gap-8">
      <Card>
                 <CardHeader className="flex flex-row items-center justify-between gap-4 p-6 bg-gradient-to-r from-gray-50 to-blue-50 border-b border-gray-200">
           <div className="flex items-center gap-4">
             <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
               <div className="flex items-center gap-2">
                 <Label htmlFor="header-radius" className="text-sm font-medium text-gray-700">🎯 Kapsama Yarıçapı:</Label>
                 <div className="relative group">
                   <span className="text-yellow-600 text-sm cursor-help">⚠️</span>
                   <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
                     <div className="text-center">
                       <div className="font-semibold mb-1">Bilgilendirme</div>
                       <div>Bu ayar sadece görsel amaçlıdır.</div>
                       <div>Gerçek yarıçap değişiklikleri için</div>
                       <div>aşağıdaki depo konumlarını kullanın.</div>
                     </div>
                     <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
                   </div>
                 </div>
               </div>
            <Input
              id="header-radius"
              type="number"
              min={10}
              max={600}
              step={10}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
                 className="w-20 text-center font-medium border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
               <span className="text-sm font-medium text-gray-600">km</span>
          </div>
          
          <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm">
            <Switch 
              id="exclude-marmara" 
              checked={excludeMarmara} 
              onCheckedChange={setExcludeMarmara}
              className="data-[state=checked]:bg-blue-600"
            />
            <Label htmlFor="exclude-marmara" className="text-sm font-medium text-gray-700">
              🚫 Marmara Bölgesini Katma
            </Label>
          </div>
           </div>
           <div className="flex gap-3">
             <Button 
               variant="outline" 
               size="sm" 
               onClick={toggleFullscreen}
               className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 hover:text-gray-800"
             >
               {isFullscreen ? "🗗 Tam Ekrandan Çık" : "🔍 Tam Ekran"}
            </Button>
             <Button 
               variant="outline" 
               onClick={exportPDF}
               className="bg-white border-blue-300 text-blue-700 hover:bg-blue-50 hover:border-blue-400"
             >
               📄 PDF (A3) İndir
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Harita Container */}
          <div className="flex gap-6">
            <div className="flex-[2] relative bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
                <div
                  ref={containerRef}
                  className={`w-full ${mapHeightClass} bg-white`}
                  style={{ minHeight: '600px' }}
                />
              
            {loading && (
                <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground bg-white/80">
                  Harita yükleniyor...
                </div>
              )}
            </div>
            
            {/* Sağ tarafta renk değiştirme kontrolleri - PDF'de görünmez */}
            <div className="w-72 bg-white rounded-xl border border-gray-200 shadow-lg p-5 max-h-[80vh] overflow-y-auto flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                    <span className="text-white text-lg">🎨</span>
                  </div>
                  <Label className="text-lg font-bold text-gray-800">Şehir Renkleri</Label>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-semibold text-gray-700 mb-2 block">Şehir Seç</Label>
                  <select
                    value={selectedCityForColor}
                    onChange={(e) => setSelectedCityForColor(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  >
                    <option value="">Şehir seçin...</option>
                    {[
                      // Tüm Türkiye şehirleri
                      "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara", "Antalya", "Ardahan", "Artvin", "Aydın", "Balıkesir", "Bartın", "Batman", "Bayburt", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Düzce", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Iğdır", "Isparta", "İstanbul", "İzmir", "Kahramanmaraş", "Karabük", "Karaman", "Kars", "Kastamonu", "Kayseri", "Kırıkkale", "Kırklareli", "Kırşehir", "Kilis", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Mardin", "Mersin", "Muğla", "Muş", "Nevşehir", "Niğde", "Ordu", "Osmaniye", "Rize", "Sakarya", "Samsun", "Şanlıurfa", "Siirt", "Sinop", "Sivas", "Şırnak", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Uşak", "Van", "Yalova", "Yozgat", "Zonguldak"
                    ].map((cityName) => {
                      const defaultColor = (() => {
                        // Veritabanından gelen default renkleri kullan
                        return defaultColors[cityName.toLowerCase()] || cityColors[cityName.toLowerCase()] || referenceColors[cityName.toLowerCase()] || '#d1d5db'
                      })()
                      
                                             return (
                         <option key={cityName} value={cityName}>
                           {cityName}
                         </option>
                       )
                    })}
                  </select>
                </div>
                
                {/* Seçilen şehrin mevcut rengini göster */}
                {selectedCityForColor && (
                  <div className="p-4 bg-gradient-to-r from-gray-50 to-blue-50 rounded-xl border border-gray-200">
                    <Label className="text-sm font-semibold text-gray-700 mb-3 block">Mevcut Renk</Label>
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-12 h-12 rounded-xl border-2 border-gray-300 shadow-lg" 
                        style={{ 
                          backgroundColor: cityColors[selectedCityForColor] || defaultColors[selectedCityForColor.toLowerCase()] || referenceColors[selectedCityForColor.toLowerCase()] || '#d1d5db'
                        }}
                      />
                      <div className="flex-1">
                        <div className="text-sm font-bold text-gray-800 mb-1">{selectedCityForColor}</div>
                        <code className="text-xs font-mono text-gray-600 bg-white px-2 py-1 rounded border">
                          {cityColors[selectedCityForColor] || defaultColors[selectedCityForColor.toLowerCase()] || referenceColors[selectedCityForColor.toLowerCase()] || 'Veritabanında kayıtlı değil'}
                        </code>
                      </div>
                    </div>
                  </div>
                )}
                
                <div>
                  <Label className="text-sm font-semibold text-gray-700 mb-2 block">Yeni Renk</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      {...colorPickerProps}
                      className="w-16 h-12 rounded-lg border-2 border-gray-300 cursor-pointer transition-all hover:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="text-xs font-medium text-gray-600 mb-1">Seçilen Renk</div>
                      <code className="text-sm font-mono text-gray-800 bg-gray-100 px-3 py-2 rounded-lg border">
                        {debouncedColor}
                      </code>
                    </div>
                  </div>
                  
                  {/* Hex input ekle */}
                  <div className="mt-3">
                    <Label className="text-xs font-medium text-gray-600 mb-1 block">Hex Kodu ile Gir</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm">#</span>
                      <Input
                        type="text"
                        placeholder="fde047"
                        value={debouncedColor.replace('#', '')}
                        onChange={(e) => {
                          const value = e.target.value.replace('#', '')
                          if (/^[0-9A-Fa-f]{6}$/.test(value)) {
                            setDebouncedColor(`#${value}`)
                          }
                        }}
                        className="flex-1 text-center font-mono text-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                        maxLength={6}
                      />
                    </div>
                  </div>
                </div>
                
                {selectedCityForColor && (
                  <div>
                    <Button
                      onClick={() => updateCityColorHandler(selectedCityForColor, debouncedColor)}
                      disabled={!selectedCityForColor || colorLoading}
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 rounded-xl shadow-lg transition-all transform hover:scale-105"
                    >
                      {colorLoading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Güncelleniyor...
                        </div>
                      ) : (
                        `${humanLabel(selectedCityForColor)} Rengini Değiştir`
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-6 pt-6">
                     <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                 <span className="text-blue-600 text-lg">🏷️</span>
               </div>
               <div>
                 <Label htmlFor="labels" className="text-base font-medium text-gray-800">Şehir İsimlerini Göster</Label>
                 <p className="text-sm text-gray-500">Haritada şehir isimlerini ve mağaza sayılarını göster/gizle</p>
               </div>
             </div>
            <Switch id="labels" checked={showLabels} onCheckedChange={setShowLabels} />
          </div>

                     <div className="space-y-4">
             <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
               <div className="flex items-start gap-3">
                 <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                   <span className="text-blue-600 text-sm">📏</span>
                 </div>
            <div>
                   <p className="text-sm text-blue-800 font-medium mb-1">
              Her daire şehir merkezlerinden karayolu mesafe yaklaşımıyla çizilir.
                   </p>
                   <p className="text-xs text-blue-700">
              (Kuş uçuşu mesafenin ~3.5 katı olarak hesaplanır)
                   </p>
            </div>
              </div>
            </div>
             
             <div className="grid gap-4 md:grid-cols-2">
               <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-300 shadow-sm">
                 <div className="flex items-start gap-3">
                   <div className="w-8 h-8 bg-blue-200 rounded-lg flex items-center justify-center flex-shrink-0">
                     <span className="text-blue-700 text-sm">ℹ️</span>
                   </div>
                   <div>
                     <h4 className="font-medium text-blue-800 mb-2">Daireler Neden Elips Görünüyor?</h4>
                     <ul className="text-xs text-blue-700 space-y-1">
                       <li>• Dünya yuvarlak, harita düz olduğu için daireler elips görünür</li>
                       <li>• Bu normal bir durumdur - her yöne 150km mesafe doğru hesaplanır</li>
                       <li>• Harita projeksiyonu nedeniyle kuzey-güney yönünde biraz uzar</li>
                       <li>• Mesafe hesaplaması matematiksel olarak doğrudur</li>
                     </ul>
              </div>
            </div>
          </div>

               <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-300 shadow-sm">
                 <div className="flex items-start gap-3">
                   <div className="w-8 h-8 bg-green-200 rounded-lg flex items-center justify-center flex-shrink-0">
                     <span className="text-green-700 text-sm">🔬</span>
                   </div>
                   <div>
                     <h4 className="font-medium text-green-800 mb-2">Teknik Detaylar</h4>
                     <ul className="text-xs text-green-700 space-y-1">
                       <li>• Jeodezik hesaplama kullanılıyor (Dünya'nın eğriliği hesaba katılıyor)</li>
                       <li>• Her 3° açıda bir nokta hesaplanıyor (toplam 120 nokta)</li>
                       <li>• Dünya yarıçapı: 6,371 km</li>
                       <li>• Mesafe: Havadan 40km = Karayolu ~150km</li>
                     </ul>
                   </div>
                 </div>
               </div>
             </div>
           </div>

                     <div className="space-y-4">
             <div className="flex items-center justify-between">
               <Label className="text-lg font-semibold text-gray-800">📍 Depo Konumları</Label>
               <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                 {selectedCityIds.size} Depo
               </Badge>
             </div>
                           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from(selectedCityIds).map((id) => {
                 const coord = depotCityCoords[id]
                 const cityName = humanLabel(id)
                 const currentRadius = cityRadii[cityName] || (() => {
                   // Varsayılan yarıçap değerleri
                   if (id === "İstanbul - AVR" || id === "İstanbul - AND") return 150
                   if (id === "duzce") return 150
                   if (id === "bursa") return 250
                   if (id === "eskisehir") return 250
                   if (id === "diyarbakir") return 375
                   return radiusKm // Diğer şehirler için genel yarıçap
                 })()
                 
                 return (
                    <div key={id} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-3 border border-gray-200 hover:border-blue-300 transition-all duration-200 hover:shadow-md">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-800">{cityName}</span>
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      </div>
                      {coord && (
                        <div className="text-xs text-gray-600 font-mono bg-white px-2 py-1 rounded border mb-2">
                          {coord.lat.toFixed(3)}, {coord.lon.toFixed(3)}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={currentRadius}
                          onChange={(e) => {
                            const v = Number(e.target.value)
                            if (Number.isFinite(v) && v > 0) {
                              // Anında state'i güncelle (UI'da hemen görünsün)
                              setCityRadii(prev => ({ ...prev, [cityName]: v }))
                              // Veritabanına kaydetmeyi geciktir
                              updateCityRadiusHandler(cityName, v)
                            }
                          }}
                          className="w-20 text-center font-semibold border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm bg-white shadow-sm"
                          min="10"
                          max="1000"
                          step="10"
                        />
                        <span className="text-sm text-gray-700 font-semibold">km</span>
                      </div>
                    </div>
                 )
               })}
             </div>
          </div>

          <div className="space-y-4">
             <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Label className="text-lg font-semibold text-gray-800">🏪 Mağaza Sayıları</Label>
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                    {Object.values(counts).reduce((sum, count) => sum + count, 0)} Toplam
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
               <Button 
                 variant="outline" 
                    size="sm"
                    onClick={initializeDatabaseHandler}
                    disabled={dbLoading}
                    className="text-xs bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
                  >
                    {dbLoading ? "Başlatılıyor..." : "🚀 Veritabanını Başlat"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                 onClick={loadFromDatabase}
                 disabled={dbLoading}
                    className="text-xs"
               >
                    {dbLoading ? "Yükleniyor..." : "Veritabanından Yükle"}
                </Button>
               <Button
                    variant="outline"
                    size="sm"
                                         onClick={async () => {
                       setDbLoading(true)
                       try {
                         await clearAllData()
                         await clearAllCityColors()
                         await clearAllCityRadii()
                         setCounts({})
                         setCityColors({})
                         setDefaultColors({}) // defaultColors state'ini de temizle
                         setCityRadii({})
                         console.log('Tüm veriler temizlendi')
                       } catch (error) {
                         console.error('Temizleme hatası:', error)
                       } finally {
                         setDbLoading(false)
                       }
                     }}
                    disabled={dbLoading}
                    className="text-xs"
                  >
                    {dbLoading ? "Temizleniyor..." : "Temizle"}
               </Button>
                </div>
             </div>

              {/* Renk Değiştirme Kontrolleri */}
              {/* Moved to the right sidebar */}

                         <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
               {[
                 // Tüm Türkiye şehirleri
                 "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara", "Antalya", "Ardahan", "Artvin", "Aydın", "Balıkesir", "Bartın", "Batman", "Bayburt", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Düzce", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Iğdır", "Isparta", "İstanbul", "İzmir", "Kahramanmaraş", "Karabük", "Karaman", "Kars", "Kastamonu", "Kayseri", "Kırıkkale", "Kırklareli", "Kırşehir", "Kilis", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Mardin", "Mersin", "Muğla", "Muş", "Nevşehir", "Niğde", "Ordu", "Osmaniye", "Rize", "Sakarya", "Samsun", "Şanlıurfa", "Siirt", "Sinop", "Sivas", "Şırnak", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Uşak", "Van", "Yalova", "Yozgat", "Zonguldak"
               ].map((cityName) => {
                 const displayColor = cityColors[cityName.toLowerCase()] || defaultColors[cityName.toLowerCase()] || referenceColors[cityName.toLowerCase()] || '#d1d5db'
                 
                 return (
                   <div key={cityName} className="bg-white rounded-lg p-4 border border-gray-200 hover:border-blue-300 transition-all duration-200 hover:shadow-md group">
                                           <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800">{cityName}</span>
                        </div>
                       <div className="w-2 h-2 bg-green-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                     </div>
                     <div className="flex items-center gap-2">
                  <Input
                    type="number"
                         value={Number.isFinite(counts[cityName]) ? counts[cityName] : 0}
                                         onChange={(e) => {
                       const v = Number(e.target.value)
                           const newCounts = { ...counts, [cityName]: Number.isFinite(v) ? v : 0 }
                       setCounts(newCounts)
                       
                       // Otomatik olarak veritabanına kaydet
                       if (Number.isFinite(v)) {
                             updateCityCount(cityName, v)
                       }
                     }}
                         className="w-20 text-center font-semibold border-2 border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-sm bg-white shadow-sm"
                         min="0"
                  />
                       <span className="text-xs text-gray-500 font-medium">mağaza</span>
                </div>
                   </div>
                 )
               })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ---------- Renkleme ---------- */

function paintAllDefault(svg: SVGSVGElement) {
  const allPaths = Array.from(svg.querySelectorAll("#turkiye > g[id] path")) as SVGPathElement[]
  allPaths.forEach((p) => {
    p.setAttribute("fill", "#f3f4f6")
    p.setAttribute("stroke", "#111")
    p.setAttribute("stroke-width", "0.7")
  })
}
function setGroupColor(svg: SVGSVGElement, groupId: string, fill: string) {
  // groupId'yi küçük harfe çevir (SVG ID'leri küçük harf)
  const normalizedId = groupId.toLowerCase()
  console.log(`🔍 SVG'de ${normalizedId} grubu aranıyor...`)
  
  // SVG'deki tüm g elementlerini kontrol et
  const allGroups = Array.from(svg.querySelectorAll("#turkiye > g[id]")) as SVGGElement[]
  console.log(`🔍 SVG'de bulunan tüm gruplar:`, allGroups.map(g => g.id))
  
  const group = svg.querySelector(`#${normalizedId}`) as SVGGElement | null
  if (!group) {
    console.warn(`❌ ${normalizedId} grubu SVG'de bulunamadı`)
    // Alternatif olarak, şehir adına göre arama yap
    const alternativeGroup = allGroups.find(g => {
      const name = g.getAttribute("data-iladi") || g.id || ""
      return name.toLowerCase() === groupId.toLowerCase()
    })
    
    if (alternativeGroup) {
      console.log(`✅ Alternatif yöntemle ${groupId} grubu bulundu: ${alternativeGroup.id}`)
      const paths = Array.from(alternativeGroup.querySelectorAll("path")) as SVGPathElement[]
      paths.forEach((p) => {
        p.setAttribute("fill", fill)
        p.setAttribute("stroke", "#111")
        p.setAttribute("stroke-width", "0.7")
      })
      return
    }
    
    console.warn(`❌ ${groupId} şehri hiçbir yöntemle bulunamadı`)
    return
  }
  
  console.log(`✅ ${normalizedId} grubu bulundu, renk uygulanıyor: ${fill}`)
  const paths = Array.from(group.querySelectorAll("path")) as SVGPathElement[]
  paths.forEach((p) => {
    p.setAttribute("fill", fill)
    p.setAttribute("stroke", "#111")
    p.setAttribute("stroke-width", "0.7")
  })
}
function applyReferenceColors(svg: SVGSVGElement, palette: Record<string, string>) {
  console.log('🎨 Reference colors uygulanıyor:', palette)
  Object.entries(palette).forEach(([id, color]) => {
    console.log(`🎨 ${id} şehri için reference color uygulanıyor: ${color}`)
    setGroupColor(svg, id, color)
  })
}

/* ---------- Depo nokta konumu hesaplama ---------- */

function getDepotDotPosition(
  id: string,
  cities: CityPos[],
  svg: SVGSVGElement | null,
): { cx: number; cy: number } | null {
  if (!svg) return null

  // İstanbul özel durumu - farklı bölgelerde iki depo
  if (id === "İstanbul - AVR" || id === "İstanbul - AND") {
    const g = svg.querySelector("#istanbul") as SVGGElement | null
    if (!g) return null
    const b = g.getBBox()
    if (id === "İstanbul - AVR") {
      return { cx: b.x + b.width * 0.15, cy: b.y + b.height * 0.45 } // Biraz sağ yukarı
    }
    return { cx: b.x + b.width * 0.73, cy: b.y + b.height * 0.85 } // Aşağıya kaydır
  }

  // Diğer şehirler için şehir merkezini kullan
  const city = cities.find((c) => c.id === id)
  if (!city) return null

  // Bazı şehirler için manuel pozisyon düzeltmesi
  let adjustedCx = city.cx
  let adjustedCy = city.cy

  // Belirtilen şehirler için özel ayarlamalar
  if (["diyarbakir", "erzurum", "konya"].includes(id)) {
    // Bu şehirler için değişiklik yok - yazının ortası
    return { cx: city.cx, cy: city.cy }
  }

  // İzmir özel konumu - 62 yazısının altına
  if (id === "izmir") {
    adjustedCx = city.cx // X değişmez
    adjustedCy = city.cy + 25 // 62 yazısının altına
    return { cx: adjustedCx, cy: adjustedCy }
  }

  // Eskişehir özel konumu - sola ve yukarı kaydır
  if (id === "eskisehir") {
    adjustedCx = city.cx - 20 // Sola kaydır
    adjustedCy = city.cy - 15 // Yukarı kaydır
    return { cx: adjustedCx, cy: adjustedCy }
  }

  // Ankara özel konumu - sağa kaydır
  if (id === "ankara") {
    adjustedCx = city.cx + 25 // Sağa kaydır
    adjustedCy = city.cy - 5  // Biraz yukarı
    return { cx: adjustedCx, cy: adjustedCy }
  }



  // Bursa özel konumu - 26 yazısının az sağ yukarısında
  if (id === "bursa") {
    adjustedCx = city.cx + 12 // Az sağa kaydır (26'nın sağı)
    adjustedCy = city.cy - 8  // Az yukarı kaydır (26'nın üstü)
    return { cx: adjustedCx, cy: adjustedCy }
  }

  // Adana özel konumu - sola (batıya) kaydır
  if (id === "adana") {
    adjustedCx = city.cx - 30 // Sola (batıya) kaydır
    adjustedCy = city.cy + 10 // Biraz aşağı
    return { cx: adjustedCx, cy: adjustedCy }
  }

  // Kayseri özel konumu - kuzeybatıya kaydır
  if (id === "kayseri") {
    adjustedCx = city.cx - 25 // Batıya kaydır
    adjustedCy = city.cy - 15 // Yukarı kaydır
    return { cx: adjustedCx, cy: adjustedCy }
  }
  
  // Muğla özel konumu - yazının üstünde
  if (id === "mugla" || id === "muğla") {
    adjustedCx = city.cx // X değişmez
    adjustedCy = city.cy - 20 // Yukarı kaydır (yazının üstü)
    return { cx: adjustedCx, cy: adjustedCy }
  }

  // Özel ayarlama gereken şehirler
  if (["antalya", "gaziantep"].includes(id)) {
    // Bu şehirler için nokta konumunu yukarı taşı
    adjustedCy = city.cy - 8
    return { cx: adjustedCx, cy: adjustedCy }
  }

  // Diğer şehirler için özel ayarlamalar
  switch (id) {
    default:
      // Varsayılan olarak orijinal konumu kullan
      break
  }

  return { cx: adjustedCx, cy: adjustedCy }
}

/* ---------- Etiketler ---------- */

function renderLabels(
  layer: SVGGElement,
  cities: CityPos[],
  counts: Record<string, number>,
  svg: SVGSVGElement | null,
  selectedIds: Set<string>,
) {
  const ns = "http://www.w3.org/2000/svg"

  cities.forEach((c) => {
    if (c.id !== "istanbul") {
      const name = document.createElementNS(ns, "text")
      name.setAttribute("x", String(c.cx))
      name.setAttribute("y", String(c.cy - 10))
      name.setAttribute("text-anchor", "middle")
      name.setAttribute("dominant-baseline", "central")
      name.setAttribute("font-size", "9")
      name.setAttribute("font-weight", "500")
      name.setAttribute(
        "font-family",
        "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'",
      )
      name.setAttribute("fill", "#111")
      name.setAttribute("paint-order", "stroke")
      name.setAttribute("stroke", "rgba(255,255,255,0.8)")
      name.setAttribute("stroke-width", "2")
      name.textContent = c.name
      layer.appendChild(name)
    }

    if (c.id !== "istanbul") {
      // Mağaza sayısını bul - hem ID hem de şehir adıyla eşleştir
      let count = counts[c.id]
      if (typeof count !== "number") {
        // ID bulunamadıysa şehir adıyla dene
        count = counts[c.name]
      }
      if (typeof count !== "number") {
        // Şehir adı da bulunamadıysa küçük harfle dene
        count = counts[c.name.toLowerCase()]
      }
      if (typeof count !== "number") {
        // Türkçe karakterleri normalize et
        const normalizedName = c.name.toLowerCase()
          .replace('ı', 'i')
          .replace('ğ', 'g')
          .replace('ü', 'u')
          .replace('ş', 's')
          .replace('ö', 'o')
          .replace('ç', 'c')
        count = counts[normalizedName]
      }
      
      if (typeof count === "number") {
        const qty = document.createElementNS(ns, "text")
        qty.setAttribute("x", String(c.cx))
        qty.setAttribute("y", String(c.cy + 6))
        qty.setAttribute("text-anchor", "middle")
        qty.setAttribute("dominant-baseline", "hanging")
        qty.setAttribute("font-size", "9")
        qty.setAttribute("font-weight", "600")
        qty.setAttribute("fill", "#111")
        qty.setAttribute("paint-order", "stroke")
        qty.setAttribute("stroke", "rgba(255,255,255,0.8)")
        qty.setAttribute("stroke-width", "2")
        qty.textContent = String(count)
        layer.appendChild(qty)
      }
    }
  })

  // AVR/AND yazıları (sadece bilgilendirme — ring merkezleri yukarıda ayarlandı)
  const avrCount = counts["İstanbul - AVR"]
  const andCount = counts["İstanbul - AND"]
  if (svg) {
    // İstanbul SVG elementini bul
    const istanbulElement = svg.querySelector("#istanbul") as SVGGElement | null
    if (istanbulElement) {
      const b = istanbulElement.getBBox()
      
      // AVR etiketi
      if (typeof avrCount === "number") {
        const avrX = b.x + b.width * 0.15
        const avrY = b.y + b.height * 0.45
        const t = document.createElementNS(ns, "text")
        t.setAttribute("x", String(avrX))
        t.setAttribute("y", String(avrY - 14))
        t.setAttribute("text-anchor", "middle")
        t.setAttribute("dominant-baseline", "central")
        t.setAttribute("font-size", "9")
        t.setAttribute("font-weight", "600")
        t.setAttribute("fill", "#000000")
        t.setAttribute("paint-order", "stroke")
        t.setAttribute("stroke", "rgba(255,255,255,0.8)")
        t.setAttribute("stroke-width", "2")
        t.textContent = `İST - AVR ${avrCount}`
        layer.appendChild(t)
      }
      
      // AND etiketi
      if (typeof andCount === "number") {
        const andX = b.x + b.width * 0.73
        const andY = b.y + b.height * 0.85
        const t = document.createElementNS(ns, "text")
        t.setAttribute("x", String(andX))
        t.setAttribute("y", String(andY - 14))
        t.setAttribute("text-anchor", "middle")
        t.setAttribute("dominant-baseline", "central")
        t.setAttribute("font-size", "9")
        t.setAttribute("font-weight", "600")
        t.setAttribute("fill", "#000000")
        t.setAttribute("paint-order", "stroke")
        t.setAttribute("stroke", "rgba(255,255,255,0.8)")
        t.setAttribute("stroke-width", "2")
        t.textContent = `İST - AND ${andCount}`
        layer.appendChild(t)
      }
    }
  }
}

/* ---------- Halka + depo nokta ---------- */

function drawRingWithDot(layer: SVGGElement, cx: number, cy: number, pathD: string, color: string, label: string) {
  const ns = "http://www.w3.org/2000/svg"
  const group = document.createElementNS(ns, "g")
  group.setAttribute("class", "coverage-ring")
  group.setAttribute("aria-label", label)

  const title = document.createElementNS(ns, "title")
  title.textContent = label
  group.appendChild(title)

  // subtle fill
  const fill = document.createElementNS(ns, "path")
  fill.setAttribute("d", pathD)
  fill.setAttribute("fill", toRgba(color, 0.15))
  group.appendChild(fill)

  // outline
  const outline = document.createElementNS(ns, "path")
  outline.setAttribute("d", pathD)
  outline.setAttribute("fill", "none")
  outline.setAttribute("stroke", color)
  outline.setAttribute("stroke-width", "2")
  outline.setAttribute("stroke-linecap", "round")
  outline.setAttribute("stroke-linejoin", "round")
  group.appendChild(outline)

  // depot dot
  const dot = document.createElementNS(ns, "circle")
  dot.setAttribute("cx", String(cx))
  dot.setAttribute("cy", String(cy))
  dot.setAttribute("r", "6")
  dot.setAttribute("fill", color)
  dot.setAttribute("stroke", "#fff")
  dot.setAttribute("stroke-width", "3")
  group.appendChild(dot)

  layer.appendChild(group)
}

/* ---------- Renk yardımcıları ---------- */
function hexToRgb(hex: string) {
  let h = hex.trim().replace("#", "")
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("")
  const num = Number.parseInt(h, 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}
function toRgba(hex: string, alpha = 0.2) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}