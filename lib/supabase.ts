import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Fallback değerler (sadece test için)
const fallbackUrl = 'https://bpbdniorqdfwogbrykoj.supabase.co'
const fallbackKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwYmRuaW9ycWRmd29nYnJ5a29qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MDQ4NTEsImV4cCI6MjA3MDQ4MDg1MX0.R58OWWBLLoFu77Dq-qI90B8SXjooIBcEQttUru92yp4'

// Environment variable'lar yoksa fallback değerleri kullan
const finalUrl = supabaseUrl || fallbackUrl
const finalKey = supabaseAnonKey || fallbackKey

export const supabase = createClient(finalUrl, finalKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: false,
    detectSessionInUrl: false
  },
  db: {
    schema: 'public'
  }
})


// Şehir mağaza sayıları için tip tanımı
export interface CityStoreCount {
  id: number
  city_id: string
  city_name: string
  store_count: number
  created_at: string
  updated_at: string
}

// Şehir renkleri için tip tanımı
export interface CityColor {
  id: number
  city_id: string
  city_name: string
  color: string
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
      // city_name'i key olarak kullan (city cards'da cityName kullanılıyor)
      counts[row.city_name] = row.store_count
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
  cityName: string, 
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
      .eq('city_name', cityName)
    
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
    
    const updatesArray = validUpdates.map(([cityName, count]) => ({
      city_name: cityName,
      store_count: count
    }))
    
    console.log('Güncellenecek veriler:', updatesArray)
    
    const { error } = await supabase
      .from('city_store_counts')
      .upsert(updatesArray, { onConflict: 'city_name' })
    
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

// Tüm verileri temizle
export async function clearAllData(): Promise<boolean> {
  try {
    if (!supabase) {
      console.warn('Supabase client bulunamadı, veriler temizlenemiyor')
      return false
    }
    
    console.log('Tüm veriler temizleniyor...')
    
    // Şehir mağaza sayılarını temizle
    const { error: storeCountsError } = await supabase
      .from('city_store_counts')
      .delete()
      .neq('id', 0)
    
    if (storeCountsError) {
      console.error('Mağaza sayıları temizleme hatası:', storeCountsError)
      return false
    }
    
    // Şehir renklerini temizle
    const { error: colorsError } = await supabase
      .from('city_colors')
      .delete()
      .neq('id', 0)
    
    if (colorsError) {
      console.error('Şehir renkleri temizleme hatası:', colorsError)
      return false
    }
    
    console.log('Tüm veriler başarıyla temizlendi')
    return true
  } catch (error) {
    console.error('Veri temizleme hatası:', error)
    return false
  }
}

// Veritabanını başlat
export async function initializeDatabase(): Promise<boolean> {
  try {
    if (!supabase) {
      console.warn('Supabase client bulunamadı, veritabanı başlatılamıyor')
      return false
    }
    
    console.log('Veritabanı başlatılıyor...')
    
    // Şehir mağaza sayıları tablosunu başlat
    const storeCountsResult = await initializeStoreCountsTable()
    if (!storeCountsResult) {
      console.error('Şehir mağaza sayıları tablosu başlatılamadı')
      return false
    }
    
    // Şehir renkleri tablosunu başlat
    const colorsResult = await initializeCityColorsTable()
    if (!colorsResult) {
      console.error('Şehir renkleri tablosu başlatılamadı')
      return false
    }
    
    console.log('Veritabanı başarıyla başlatıldı')
    return true
  } catch (error) {
    console.error('Veritabanı başlatma hatası:', error)
    return false
  }
}

// Şehir renklerini getir
export async function getCityColors(): Promise<Record<string, string>> {
  try {
    if (!supabase) {
      console.warn('Supabase client bulunamadı, boş obje döndürülüyor')
      return {}
    }
    
    console.log('Şehir renkleri çekiliyor...')
    
    const { data, error } = await supabase
      .from('city_colors')
      .select('city_id, city_name, color')
      .order('city_id')
    
    if (error) {
      console.error('Renk verisi çekme hatası:', error)
      return {}
    }
    
    if (!data || data.length === 0) {
      console.log('Veritabanında renk verisi bulunamadı')
      return {}
    }
    
    const colors: Record<string, string> = {}
    data?.forEach(row => {
      // city_name'i key olarak kullan, city_id'yi log'da göster
      colors[row.city_name] = row.color
      console.log(`Şehir: ${row.city_name}, ID: ${row.city_id}, Renk: ${row.color}`)
    })
    
    console.log('İşlenmiş renk verileri:', colors)
    return colors
  } catch (error) {
    console.error('Renk verisi çekme hatası:', error)
    return {}
  }
}

// Şehir rengini güncelle
export async function updateCityColor(
  cityName: string, 
  color: string
): Promise<boolean> {
  try {
    if (!supabase) {
      console.warn('Supabase client bulunamadı, renk güncellenemiyor')
      return false
    }
    
    console.log(`🔍 Güncelleme öncesi kontrol: ${cityName} şehri için renk ${color} olarak güncellenecek`)
    
    // Önce şehri bul
    const { data: existingCity, error: findError } = await supabase
      .from('city_colors')
      .select('city_id, city_name, color')
      .eq('city_name', cityName)
      .single()
    
    if (findError) {
      console.error(`❌ Şehir bulunamadı: ${cityName}`, findError)
      return false
    }
    
    console.log(`✅ Şehir bulundu:`, existingCity)
    
    // Şimdi güncelle
    const { error } = await supabase
      .from('city_colors')
      .update({ color: color })
      .eq('city_name', cityName)
    
    if (error) {
      console.error('❌ Renk güncelleme hatası:', error)
      return false
    }
    
    // Güncelleme sonrası kontrol
    const { data: updatedCity, error: checkError } = await supabase
      .from('city_colors')
      .select('city_id, city_name, color')
      .eq('city_name', cityName)
      .single()
    
    if (checkError) {
      console.error('❌ Güncelleme sonrası kontrol hatası:', checkError)
    } else {
      console.log(`✅ Güncelleme sonrası:`, updatedCity)
    }
    
    console.log(`🎉 ${cityName} şehri için renk güncellendi: ${color}`)
    return true
  } catch (error) {
    console.error('❌ Renk güncelleme hatası:', error)
    return false
  }
}

// Birden fazla şehir rengini güncelle
export async function updateMultipleCityColors(
  updates: Record<string, string>
): Promise<boolean> {
  try {
    if (!supabase) {
      console.warn('Supabase client bulunamadı, renkler güncellenemiyor')
      return false
    }
    
    console.log('Birden fazla şehir rengi güncelleniyor:', updates)
    
    const promises = Object.entries(updates).map(([cityName, color]) =>
      updateCityColor(cityName, color)
    )
    
    const results = await Promise.all(promises)
    const success = results.every(result => result === true)
    
    if (success) {
      console.log('Tüm şehir renkleri başarıyla güncellendi')
    } else {
      console.warn('Bazı şehir renkleri güncellenemedi')
    }
    
    return success
  } catch (error) {
    console.error('Toplu renk güncelleme hatası:', error)
    return false
  }
}

// Şehir renkleri tablosunu oluştur ve varsayılan renkleri ekle
export async function initializeCityColorsTable(): Promise<boolean> {
  try {
    if (!supabase) {
      console.warn('Supabase client bulunamadı, renk tablosu oluşturulamıyor')
      return false
    }
    
    console.log('Şehir renkleri tablosu kontrol ediliyor...')
    
    // Önce tablo var mı kontrol et
    const { data: existingData, error: checkError } = await supabase
      .from('city_colors')
      .select('count')
      .limit(1)
    
    if (checkError && checkError.code === '42P01') {
      // Tablo yok, oluştur
      console.log('city_colors tablosu bulunamadı, oluşturuluyor...')
      
      const { error: createError } = await supabase.rpc('create_city_colors_table')
      
      if (createError) {
        console.error('Tablo oluşturma hatası:', createError)
        return false
      }
      
      console.log('city_colors tablosu oluşturuldu')
    } else if (existingData && existingData.length > 0) {
      console.log('city_colors tablosu zaten mevcut ve veri içeriyor')
      return true
    }
    
    // Varsayılan renkleri ekle
    console.log('Varsayılan şehir renkleri ekleniyor...')
    
    const { referenceColors } = await import('@/data/reference-colors')
    
    // Tüm Türkiye şehirleri için renk ekle
    const allTurkishCities = [
      "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara", "Antalya", "Ardahan", "Artvin", "Aydın", "Balıkesir", "Bartın", "Batman", "Bayburt", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Düzce", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Iğdır", "Isparta", "İstanbul", "İzmir", "Kahramanmaraş", "Karabük", "Karaman", "Kars", "Kastamonu", "Kayseri", "Kırıkkale", "Kırklareli", "Kırşehir", "Kilis", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Mardin", "Mersin", "Muğla", "Muş", "Nevşehir", "Niğde", "Ordu", "Osmaniye", "Rize", "Sakarya", "Samsun", "Şanlıurfa", "Siirt", "Sinop", "Sivas", "Şırnak", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Uşak", "Van", "Yalova", "Yozgat", "Zonguldak"
    ]
    
    const defaultColors = allTurkishCities.map(cityName => {
      const color = referenceColors[cityName.toLowerCase()] || '#d1d5db' // Varsayılan gri
      return {
        city_id: cityName.toLowerCase(),
        city_name: cityName,
        color: color
      }
    })
    
    console.log('Eklenecek varsayılan renkler:', defaultColors)
    
    const { error: insertError } = await supabase
      .from('city_colors')
      .insert(defaultColors)
    
    if (insertError) {
      console.error('Varsayılan renk ekleme hatası:', insertError)
      return false
    }
    
    console.log('Tüm Türkiye şehirleri için varsayılan renkler başarıyla eklendi')
    return true
  } catch (error) {
    console.error('Şehir renkleri tablosu başlatma hatası:', error)
    return false
  }
}

// Tüm şehir renklerini temizle
export async function clearAllCityColors(): Promise<boolean> {
  try {
    if (!supabase) {
      console.warn('Supabase client bulunamadı, renkler temizlenemiyor')
      return false
    }
    
    const { error } = await supabase
      .from('city_colors')
      .delete()
      .neq('id', 0)
    
    if (error) {
      console.error('Renk temizleme hatası:', error)
      return false
    }
    
    console.log('Tüm şehir renkleri temizlendi')
    return true
  } catch (error) {
    console.error('Renk temizleme hatası:', error)
    return false
  }
}

// Şehir mağaza sayıları tablosunu başlat
export async function initializeStoreCountsTable(): Promise<boolean> {
  try {
    if (!supabase) {
      console.warn('Supabase client bulunamadı, tablo oluşturulamıyor')
      return false
    }
    
    console.log('Şehir mağaza sayıları tablosu kontrol ediliyor...')
    
    // Önce tablo var mı kontrol et
    const { data: existingData, error: checkError } = await supabase
      .from('city_store_counts')
      .select('count')
      .limit(1)
    
    if (checkError && checkError.code === '42P01') {
      // Tablo yok, oluştur
      console.log('city_store_counts tablosu bulunamadı, oluşturuluyor...')
      
      const { error: createError } = await supabase.rpc('create_city_store_counts_table')
      
      if (createError) {
        console.error('Tablo oluşturma hatası:', createError)
        return false
      }
      
      console.log('city_store_counts tablosu oluşturuldu')
    } else if (existingData && existingData.length > 0) {
      console.log('city_store_counts tablosu zaten mevcut ve veri içeriyor')
      return true
    }
    
    // Tablo boşsa, tüm Türkiye şehirleri için varsayılan mağaza sayıları ekle
    if (!existingData || existingData.length === 0) {
      console.log('Tablo boş, tüm Türkiye şehirleri için varsayılan mağaza sayıları ekleniyor...')
      
      // Tüm Türkiye şehirleri (city cards'da kullanılan liste)
      const allTurkishCities = [
        "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Aksaray", "Amasya", "Ankara", "Antalya", "Ardahan", "Artvin", "Aydın", "Balıkesir", "Bartın", "Batman", "Bayburt", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Düzce", "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Iğdır", "Isparta", "İstanbul", "İzmir", "Kahramanmaraş", "Karabük", "Karaman", "Kars", "Kastamonu", "Kayseri", "Kırıkkale", "Kırklareli", "Kırşehir", "Kilis", "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Mardin", "Mersin", "Muğla", "Muş", "Nevşehir", "Niğde", "Ordu", "Osmaniye", "Rize", "Sakarya", "Samsun", "Şanlıurfa", "Siirt", "Sinop", "Sivas", "Şırnak", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Uşak", "Van", "Yalova", "Yozgat", "Zonguldak"
      ]
      
      const defaultStoreCounts = allTurkishCities.map(cityName => ({
        city_id: cityName.toLowerCase(),
        city_name: cityName,
        store_count: 0 // Varsayılan olarak 0 mağaza
      }))
      
      console.log('Eklenecek varsayılan mağaza sayıları:', defaultStoreCounts)
      
      const { error: insertError } = await supabase
        .from('city_store_counts')
        .insert(defaultStoreCounts)
      
      if (insertError) {
        console.error('Varsayılan mağaza sayıları ekleme hatası:', insertError)
        return false
      }
      
      console.log('Tüm Türkiye şehirleri için varsayılan mağaza sayıları başarıyla eklendi')
    }
    
    console.log('Şehir mağaza sayıları tablosu hazır')
    return true
  } catch (error) {
    console.error('Şehir mağaza sayıları tablosu başlatma hatası:', error)
    return false
  }
}
