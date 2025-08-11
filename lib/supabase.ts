import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('Supabase config:', {
  url: supabaseUrl,
  hasKey: !!supabaseAnonKey,
  env: process.env.NODE_ENV
})

// Environment variable'lar yoksa mock client oluştur
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Şehir mağaza sayıları için tip tanımı
export interface CityStoreCount {
  id: number
  city_id: string
  city_name: string
  store_count: number
  created_at: string
  updated_at: string
}

// Şehir mağaza sayılarını getir
export async function getCityStoreCounts(): Promise<Record<string, number>> {
  try {
    if (!supabase) {
      console.warn('Supabase client bulunamadı, varsayılan değerler döndürülüyor')
      return {}
    }
    
    const { data, error } = await supabase
      .from('city_store_counts')
      .select('city_id, store_count')
      .order('city_id')
    
    if (error) {
      console.error('Veri çekme hatası:', error)
      return {}
    }
    
    // Record<string, number> formatına çevir
    const counts: Record<string, number> = {}
    data?.forEach(row => {
      counts[row.city_id] = row.store_count
    })
    
    return counts
  } catch (error) {
    console.error('Veri çekme hatası:', error)
    return {}
  }
}

// Şehir mağaza sayısını güncelle
export async function updateCityStoreCount(
  cityId: string, 
  storeCount: number
): Promise<boolean> {
  try {
    if (!supabase) {
      console.warn('Supabase client bulunamadı, güncelleme yapılamıyor')
      return false
    }
    
    const { error } = await supabase
      .from('city_store_counts')
      .update({ store_count: storeCount })
      .eq('city_id', cityId)
    
    if (error) {
      console.error('Güncelleme hatası:', error)
      return false
    }
    
    return true
  } catch (error) {
    console.error('Güncelleme hatası:', error)
    return false
  }
}

// Toplu güncelleme
export async function updateMultipleCityStoreCounts(
  updates: Record<string, number>
): Promise<boolean> {
  try {
    if (!supabase) {
      console.warn('Supabase client bulunamadı, güncelleme yapılamıyor')
      return false
    }
    
    console.log('Toplu güncelleme başlatılıyor:', updates)
    
    // Boş güncellemeleri filtrele
    const validUpdates = Object.entries(updates).filter(([cityId, count]) => {
      return cityId && typeof count === 'number' && count >= 0
    })
    
    if (validUpdates.length === 0) {
      console.log('Güncellenecek veri bulunamadı')
      return true
    }
    
    const updatesArray = validUpdates.map(([cityId, count]) => ({
      city_id: cityId,
      store_count: count
    }))
    
    console.log('Güncellenecek veriler:', updatesArray)
    
    const { error } = await supabase
      .from('city_store_counts')
      .upsert(updatesArray, { onConflict: 'city_id' })
    
    if (error) {
      console.error('Toplu güncelleme hatası:', error)
      console.error('Hata detayları:', {
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      return false
    }
    
    console.log('Toplu güncelleme başarılı')
    return true
  } catch (error) {
    console.error('Toplu güncelleme hatası:', error)
    return false
  }
}
