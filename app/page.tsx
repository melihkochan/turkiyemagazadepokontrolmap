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
      </div>
    </main>
  )
}
