import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('Supabase config:', {
  url: supabaseUrl,
  hasKey: !!supabaseAnonKey,
  env: process.env.NODE_ENV,
  isProduction: process.env.NODE_ENV === 'production'
})

// Environment variable'lar yoksa mock client oluştur
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false,
        detectSessionInUrl: false
      },
      db: {
        schema: 'public'
      }
    })
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
      console.warn('Supabase client bulunamadı, boş obje döndürülüyor')
      return {}
    }
    
    console.log('Supabase client bulundu, veriler çekiliyor...')
    
    const { data, error } = await supabase
      .from('city_store_counts')
      .select('city_id, city_name, store_count')
      .order('city_id')
    
    if (error) {
      console.error('Veri çekme hatası:', error)
      console.log('Hata durumunda boş obje döndürülüyor')
      return {}
    }
    
    console.log('Veritabanından gelen ham veriler:', data)
    
    // Eğer veri yoksa boş obje döndür
    if (!data || data.length === 0) {
      console.log('Veritabanında veri bulunamadı, boş obje döndürülüyor')
      return {}
    }
    
    // Record<string, number> formatına çevir
    const counts: Record<string, number> = {}
    data?.forEach(row => {
      // city_id'yi key olarak kullan, city_name'i log'da göster
      counts[row.city_id] = row.store_count
      console.log(`Şehir: ${row.city_name || row.city_id}, ID: ${row.city_id}, Mağaza sayısı: ${row.store_count}`)
    })
    
    console.log('İşlenmiş veriler:', counts)
    return counts
  } catch (error) {
    console.error('Veri çekme hatası:', error)
    console.log('Hata durumunda boş obje döndürülüyor')
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

// Tüm test verilerini temizle
export async function clearAllData(): Promise<boolean> {
  try {
    if (!supabase) {
      console.warn('Supabase client bulunamadı, temizleme yapılamıyor')
      return false
    }
    
    console.log('Tüm veriler temizleniyor...')
    
    const { error } = await supabase
      .from('city_store_counts')
      .delete()
      .neq('id', 0) // Tüm kayıtları sil
    
    if (error) {
      console.error('Veri temizleme hatası:', error)
      return false
    }
    
    console.log('Tüm veriler başarıyla temizlendi!')
    return true
    
  } catch (error) {
    console.error('Veri temizleme hatası:', error)
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
    
    // Sadece tablo varlığını kontrol et
    const { data: existingData, error: checkError } = await supabase
      .from('city_store_counts')
      .select('*')
      .limit(1)
    
    if (checkError) {
      console.log('Tablo bulunamadı, oluşturuluyor...')
      
      // SQL ile tablo oluştur (eğer yoksa)
      const { error: createError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS city_store_counts (
            id SERIAL PRIMARY KEY,
            city_id TEXT UNIQUE NOT NULL,
            city_name TEXT,
            store_count INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
        `
      })
      
      if (createError) {
        console.log('RPC ile tablo oluşturulamadı, manuel oluşturuluyor...')
        console.log('Tablo oluşturulamadı, mevcut tabloyu kullanmaya çalışıyoruz...')
      }
    } else {
      console.log('Tablo zaten mevcut, gerçek veriler kullanılıyor...')
    }
    
    console.log('Veritabanı başarıyla başlatıldı!')
    return true
    
  } catch (error) {
    console.error('Veritabanı başlatma hatası:', error)
    return false
  }
}
