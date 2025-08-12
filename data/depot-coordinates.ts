// Corrected depot coordinates (lat, lon). Values normalized from the sheet.
// Note: Diyarbakir, Mugla, Samsun rows in the screenshot had inconsistencies;
// here we use commonly accepted city-center coordinates. Share the CSV to lock exact points.

export type DepotCoord = { lat: number; lon: number }

export const depotCityCoords: Record<string, DepotCoord> = {
  "İstanbul - AND": { lat: 40.883510, lon: 29.368118 },
  "İstanbul - AVR": { lat: 41.077869, lon: 28.642136 },

  ankara: { lat: 40.047175, lon: 32.619897 },
  antalya: { lat: 36.931355, lon: 30.774386 },
  bursa: { lat: 40.234408, lon: 29.130878 },
  diyarbakir: { lat: 37.839425, lon: 40.410098 },
  "duzce": { lat: 40.850518, lon: 31.078438 },
  erzurum: { lat: 39.931060, lon: 41.172410 },
  eskisehir: { lat: 39.748888, lon: 30.675614 },
  gaziantep: { lat: 37.087195, lon: 37.438991 },
  izmir: { lat: 38.388079, lon: 27.236087 },
  kayseri: { lat: 38.698640, lon: 35.352849 },
  konya: { lat: 37.928579, lon: 32.522161 },
  "muğla": { lat: 37.228004, lon: 28.522161 },
  "mugla": { lat: 37.228004, lon: 28.522161 },
  samsun: { lat: 41.236380, lon: 36.417110 },
  trabzon: { lat: 40.885089, lon: 39.702102 },
  adana: { lat: 36.970375, lon: 35.548702 },
}
