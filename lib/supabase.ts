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

// Client oluşturuldu mu kontrol et
if (supabase) {
  console.log('✅ Supabase client başarıyla oluşturuldu')
} else {
  console.warn('❌ Supabase client oluşturulamadı - environment variables eksik')
}

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
      return getDefaultStoreCounts()
    }
    
    console.log('Supabase client bulundu, veriler çekiliyor...')
    
    const { data, error } = await supabase
      .from('city_store_counts')
      .select('city_id, store_count')
      .order('city_id')
    
    if (error) {
      console.error('Veri çekme hatası:', error)
      console.log('Varsayılan değerler döndürülüyor')
      return getDefaultStoreCounts()
    }
    
    console.log('Veritabanından gelen ham veriler:', data)
    
    // Eğer veri yoksa varsayılan değerleri döndür
    if (!data || data.length === 0) {
      console.log('Veritabanında veri bulunamadı, varsayılan değerler döndürülüyor')
      return getDefaultStoreCounts()
    }
    
    // Record<string, number> formatına çevir
    const counts: Record<string, number> = {}
    data?.forEach(row => {
      counts[row.city_id] = row.store_count
      console.log(`Şehir: ${row.city_id}, Mağaza sayısı: ${row.store_count}`)
    })
    
    console.log('İşlenmiş veriler:', counts)
    return counts
  } catch (error) {
    console.error('Veri çekme hatası:', error)
    console.log('Hata durumunda varsayılan değerler döndürülüyor')
    return getDefaultStoreCounts()
  }
}

// Varsayılan mağaza sayıları
function getDefaultStoreCounts(): Record<string, number> {
  return {
    "İstanbul - AVR": 25,
    "İstanbul - AND": 18,
    "ankara": 15,
    "antalya": 12,
    "bursa": 8,
    "diyarbakir": 6,
    "düzce": 4,
    "erzurum": 5,
    "eskisehir": 7,
    "gaziantep": 9,
    "izmir": 14,
    "kayseri": 6,
    "konya": 8,
    "muğla": 5,
    "samsun": 7,
    "trabzon": 6,
    "adana": 10
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

// Tablo oluştur ve test verileri ekle
export async function initializeDatabase(): Promise<boolean> {
  try {
    if (!supabase) {
      console.warn('Supabase client bulunamadı, tablo oluşturulamıyor')
      return false
    }
    
    console.log('Veritabanı başlatılıyor...')
    
    // Test verileri ekle
    const testData = [
      { city_id: "İstanbul - AVR", store_count: 25 },
      { city_id: "İstanbul - AND", store_count: 18 },
      { city_id: "ankara", store_count: 15 },
      { city_id: "antalya", store_count: 12 },
      { city_id: "bursa", store_count: 8 },
      { city_id: "diyarbakir", store_count: 6 },
      { city_id: "düzce", store_count: 4 },
      { city_id: "erzurum", store_count: 5 },
      { city_id: "eskisehir", store_count: 7 },
      { city_id: "gaziantep", store_count: 9 },
      { city_id: "izmir", store_count: 14 },
      { city_id: "kayseri", store_count: 6 },
      { city_id: "konya", store_count: 8 },
      { city_id: "muğla", store_count: 5 },
      { city_id: "samsun", store_count: 7 },
      { city_id: "trabzon", store_count: 6 },
      { city_id: "adana", store_count: 10 }
    ]
    
    console.log('Test verileri ekleniyor:', testData)
    
    const { error: insertError } = await supabase
      .from('city_store_counts')
      .upsert(testData, { onConflict: 'city_id' })
    
    if (insertError) {
      console.error('Test verileri eklenirken hata:', insertError)
      console.log('Hata detayları:', insertError)
      return false
    }
    
    console.log('Veritabanı başarıyla başlatıldı!')
    return true
    
  } catch (error) {
    console.error('Veritabanı başlatma hatası:', error)
    return false
  }
}
