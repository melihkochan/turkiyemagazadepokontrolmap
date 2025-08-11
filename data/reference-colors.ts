//
// Renk grupları — isteğinize göre güncellendi.
//
// - Ankara, Kırıkkale, Çankırı, Kastamonu: Sarı
// - Sinop, Samsun, Çorum, Amasya, Tokat, Ordu: Aynı (peach/soluk turuncu)
// - Giresun, Trabzon, Gümüşhane, Bayburt, Rize, Artvin: Aynı (mor ton)
// - Bitlis, Van, Hakkari: Aynı (pembe ton)
// - Kahramanmaraş, Adıyaman, Gaziantep, Şanlıurfa, Kilis: Aynı (yeşil ton)
// - Konya ve Karaman: Aynı (hafif pembemsi)
// - Burdur ve Antalya: Aynı (turuncu), Isparta: ayrı (lila)
// - Önceden belirlenen Marmara/Ege renkleri korunur.
//

const ORANGE = "#f59e0b"
const LIGHT_GREEN = "#86efac"
const LIGHT_BLUE = "#93c5fd"
const DARK_BLUE = "#1e40af"
const YELLOW = "#fde047"
const PEACH = "#fdba74"
const PURPLE = "#c084fc"
const PINK = "#f9a8d4"
const ROSE = "#fda4af"
const LILAC = "#e9d5ff"
const GREEN_SE = "#22c55e"
const GREY = "#d1d5db"

export const referenceColors: Record<string, string> = {
  // Marmara turuncu (önceki istek)
  kirklareli: ORANGE,
  edirne: ORANGE,
  tekirdag: ORANGE,
  istanbul: ORANGE,
  kocaeli: ORANGE,
  sakarya: ORANGE,

  // Kuzey Ege açık yeşil (önceki istek)
  canakkale: LIGHT_GREEN,
  balikesir: LIGHT_GREEN,
  bursa: LIGHT_GREEN,
  yalova: LIGHT_GREEN,

  // Ege mavi tonları (önceki istek)
  izmir: LIGHT_BLUE,
  manisa: LIGHT_BLUE,
  usak: LIGHT_BLUE,
  aydin: DARK_BLUE,
  denizli: DARK_BLUE,
  mugla: DARK_BLUE,

  // Doğu Marmara / İç Ege bazında nötr (gerekirse değiştirilebilir)
  bilecik: GREY,
  kutahya: GREY,
  eskisehir: GREY,
  bolu: GREY,
  duzce: GREY,

  // Akdeniz turuncu (genel) - Mersin ve Adana daha açık turuncu
  mersin: "#fbbf24", // Daha açık turuncu
  adana: "#fbbf24", // Daha açık turuncu
  osmaniye: "#fbbf24", // Daha açık turuncu
  hatay: "#fbbf24", // Daha açık turuncu

  // İç Anadolu (isteğinize göre özel gruplar aşağıda)
  ankara: YELLOW,
  kirikkale: YELLOW,
  cankiri: YELLOW,
  kastamonu: YELLOW,

  // Orta-Karadeniz kuşağı (aynı renk)
  sinop: PEACH,
  samsun: PEACH,
  corum: PEACH,
  amasya: PEACH,
  tokat: PEACH,
  ordu: PEACH,

  // Doğu Karadeniz kuşağı (aynı renk)
  giresun: PURPLE,
  trabzon: PURPLE,
  gumushane: PURPLE,
  bayburt: PURPLE,
  rize: PURPLE,
  artvin: PURPLE,

  // Doğu üçlüsü (farklı renk - daha açık pembe)
  bitlis: ROSE,
  van: ROSE,
  hakkari: ROSE,

  // Güneydoğu beşlisi (aynı renk)
  kahramanmaras: GREEN_SE,
  adiyaman: GREEN_SE,
  gaziantep: GREEN_SE,
  sanliurfa: GREEN_SE,
  kilis: GREEN_SE,

  // Konya & Karaman (hafif pembemsi)
  konya: ROSE,
  karaman: ROSE,

  // Antalya & Burdur aynı renkte ama Mersin/Adana'dan farklı
  burdur: "#d79775", // Somon/kahverengi turuncu
  isparta: "#d79775", // Somon/kahverengi turuncu (Burdur ile aynı)
  
  // Afyonkarahisar Eskişehir ile aynı renk
  afyonkarahisar: GREY,

  // Kalan Doğu/İç bölgeler için önceki genel atamalar (örnekleri koruyoruz)
  kayseri: GREY,
  nevsehir: GREY,
  nigde: GREY,
  yozgat: GREY,
  sivas: GREY,
  kirsehir: GREY,
  aksaray: GREY,

  // Kuzeydoğu bazıları (gerekirse ayarlanabilir)
  erzurum: YELLOW,
  erzincan: YELLOW,
  kars: YELLOW,
  ardahan: YELLOW,
  igdir: YELLOW,
  agri: YELLOW,

  // Güneydoğu mor kütle (değişmeden)
  mardin: PURPLE,
  batman: PURPLE,
  siirt: PURPLE,
  sirnak: PURPLE,
  diyarbakir: PURPLE,
  malatya: PURPLE,
  tunceli: PURPLE,
  elazig: PURPLE,
  bingol: PURPLE,
  mus: PURPLE,

  // Karadeniz batı
  zonguldak: GREY,
  karabuk: GREY,
  bartin: GREY,
}
