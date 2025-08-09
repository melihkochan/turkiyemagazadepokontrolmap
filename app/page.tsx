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
      <div className="mx-auto w-full max-w-[1680px] px-2 py-2">
        {/* Ana Başlık */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🗺️ Türkiye Map Kontrol
          </h1>
          <p className="text-gray-600">
            Depo Konumları ve Kapsama Alanları Görüntüleme Sistemi
          </p>
        </div>
        {/* Tab Navigation */}
        <div className="mb-6 flex gap-2">
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
            mapHeightClass="min-h-[88vh]"
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
        <footer className="mt-8 pt-4 border-t border-gray-200">
          <div className="text-center text-sm text-gray-600">
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
