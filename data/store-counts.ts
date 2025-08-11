import { getCityStoreCounts } from "@/lib/supabase"

// Dinamik olarak veritabanından mağaza sayılarını getir
export async function getDynamicStoreCounts(): Promise<Record<string, number>> {
  try {
    return await getCityStoreCounts()
  } catch (error) {
    console.error('Dinamik veri çekme hatası:', error)
    // Hata durumunda boş obje döndür
    return {}
  }
}

// Boş store counts (fallback için)
export const storeCounts: Record<string, number> = {}
