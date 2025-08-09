"use client"

import { useState } from "react"
import TurkeyMap from "@/components/turkey-map"
import WorldMap from "@/components/world-map"
import { storeCounts } from "@/data/store-counts"
import { depotCityIds } from "@/data/depot-cities"
import { Button } from "@/components/ui/button"

export default function Page() {
  const [activeTab, setActiveTab] = useState<"turkey" | "world">("turkey")

  return (
    <main className="min-h-screen w-full">
      <div className="mx-auto w-full max-w-[1400px] px-2 py-1">
        {/* Ana Başlık */}
        <div className="text-center mb-3">
          <div className="flex items-center justify-center gap-2 mb-2">
            <img 
              src="/images/gratis-logo.png" 
              alt="Gratis Logo" 
              className="h-10 w-auto"
            />
          </div>
          <p className="text-gray-600 text-sm font-medium">
            Gratis Depo Konum Dağılımı
          </p>
        </div>
        {/* Tab Navigation */}
        <div className="mb-3 flex gap-2">
          <Button
            variant={activeTab === "turkey" ? "default" : "outline"}
            onClick={() => setActiveTab("turkey")}
            className="min-w-[120px]"
          >
            🇹🇷 Türkiye Haritası
          </Button>
          <Button
            variant={activeTab === "world" ? "default" : "outline"}
            onClick={() => setActiveTab("world")}
            className="min-w-[120px]"
          >
            🌍 Dünya Haritası
          </Button>
        </div>

        {/* Tab Content */}
        {activeTab === "turkey" && (
          <TurkeyMap
            defaultSelectedCityIds={depotCityIds}
            defaultRadiusKm={150}
            storeCounts={storeCounts}
            mapHeightClass="min-h-[65vh]"
          />
        )}

        {activeTab === "world" && (
          <WorldMap
            defaultSelectedCityIds={depotCityIds}
            defaultRadiusKm={150}
            storeCounts={storeCounts}
          />
        )}
        
        {/* Footer - Geliştirici Bilgileri */}
        <footer className="mt-4 pt-2 border-t border-gray-200">
          <div className="text-center text-xs text-gray-500">
            <p>
              Developed by{" "}
              <a 
                href="https://www.melihkochan.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="font-semibold text-blue-600 hover:text-blue-800 transition-colors"
              >
                Melih KOÇHAN
              </a>
            </p>
          </div>
        </footer>
      </div>
    </main>
  )
}
