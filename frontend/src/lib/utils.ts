import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type SupportedCurrency = "USD" | "IDR" | "EUR" | "GBP" | "SGD" | "JPY";

export interface CurrencyConfig {
  code: SupportedCurrency;
  symbol: string;
  label: string;
  rateFromIDR: number;
  locale: string;
  decimals: number;
}

export const CURRENCY_CONFIG: Record<SupportedCurrency, CurrencyConfig> = {
  USD: { code: "USD", symbol: "$", label: "USD ($)", rateFromIDR: 1 / 16000, locale: "en-US", decimals: 2 },
  IDR: { code: "IDR", symbol: "Rp", label: "IDR (Rp)", rateFromIDR: 1, locale: "id-ID", decimals: 0 },
  EUR: { code: "EUR", symbol: "€", label: "EUR (€)", rateFromIDR: 1 / 17200, locale: "en-IE", decimals: 2 },
  GBP: { code: "GBP", symbol: "£", label: "GBP (£)", rateFromIDR: 1 / 20200, locale: "en-GB", decimals: 2 },
  SGD: { code: "SGD", symbol: "S$", label: "SGD (S$)", rateFromIDR: 1 / 11900, locale: "en-SG", decimals: 2 },
  JPY: { code: "JPY", symbol: "¥", label: "JPY (¥)", rateFromIDR: 1 / 105, locale: "ja-JP", decimals: 0 },
};

export function formatCurrency(
  amountIDR: number | null | undefined,
  currency: SupportedCurrency = "USD"
): string {
  if (amountIDR === undefined || amountIDR === null || isNaN(amountIDR) || amountIDR === 0) {
    return "Free";
  }
  const cfg = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.USD;
  const converted = amountIDR * cfg.rateFromIDR;
  const maxFrac = cfg.decimals === 0 ? 0 : converted >= 100 ? 0 : 2;

  return new Intl.NumberFormat(cfg.locale, {
    style: "currency",
    currency: cfg.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  }).format(converted);
}

export function formatCurrencyCompact(
  amountIDR: number | null | undefined,
  currency: SupportedCurrency = "USD"
): string {
  if (amountIDR === undefined || amountIDR === null || isNaN(amountIDR) || amountIDR === 0) {
    return "Free";
  }
  const cfg = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.USD;
  const converted = amountIDR * cfg.rateFromIDR;

  if (converted >= 1_000_000_000) {
    return `${cfg.symbol} ${(converted / 1_000_000_000).toFixed(1)}B`;
  }
  if (converted >= 1_000_000) {
    return `${cfg.symbol} ${(converted / 1_000_000).toFixed(1)}M`;
  }
  if (converted >= 10_000) {
    return `${cfg.symbol} ${(converted / 1_000).toFixed(1)}k`;
  }
  if (currency === "IDR" && converted >= 1_000) {
    return `${cfg.symbol} ${(converted / 1_000).toFixed(0)}k`;
  }
  return formatCurrency(amountIDR, currency);
}

export function formatIDR(amount: number | null | undefined): string {
  return formatCurrency(amount, "IDR");
}

export function formatIDRCompact(amount: number | null | undefined): string {
  return formatCurrencyCompact(amount, "IDR");
}

export function formatCompactNumber(num: number | null | undefined): string {
  if (!num || isNaN(num) || num <= 0) return "0";
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 10_000) {
    return `${(num / 1_000).toFixed(1)}k`;
  }
  return num.toLocaleString("en-US");
}

export function formatHours(minutes: number | null | undefined): string {
  if (!minutes || isNaN(minutes) || minutes <= 0) return "0.0h";
  const hours = minutes / 60;
  if (hours < 0.1 && minutes > 0) return "< 0.1h";
  return `${hours.toFixed(1)}h`;
}

export function calculateCostPerHour(priceIDR: number, playtimeMinutes: number): number | null {
  if (playtimeMinutes === 0 || priceIDR === 0) return null;
  const hours = playtimeMinutes / 60;
  return Math.round(priceIDR / hours);
}

/**
 * Safe image fallback handler: strictly clears `onerror` before setting fallback,
 * preventing any infinite reload loop or CORB spam.
 */
export function handlePosterError(
  e: React.SyntheticEvent<HTMLImageElement>,
  fallbackUrl?: string
) {
  const target = e.currentTarget;
  target.onerror = null; // MUST clear immediately to prevent infinite loop

  if (fallbackUrl && target.src !== fallbackUrl) {
    target.src = fallbackUrl;
  } else {
    // Crisp inline SVG fallback - 0% chance of network error
    target.src =
      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='900' viewBox='0 0 600 900'><rect width='600' height='900' fill='%23151821'/><rect x='24' y='24' width='552' height='852' rx='16' fill='none' stroke='%23ffffff' stroke-width='2' stroke-opacity='0.08'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%235A6270' font-family='sans-serif' font-size='28' font-weight='bold'>VALVIX</text></svg>";
  }
}

/**
 * Known Steam Release Years dictionary for popular library games.
 */
const KNOWN_RELEASE_YEARS: Record<number, number> = {
  1086940: 2023, // Baldur's Gate 3
  1091500: 2020, // Cyberpunk 2077
  570: 2013,     // Dota 2
  730: 2023,     // Counter-Strike 2
  1245620: 2022, // ELDEN RING
  1426210: 2021, // It Takes Two
  892970: 2021,  // Valheim
  553850: 2024,  // HELLDIVERS 2
  292030: 2015,  // The Witcher 3: Wild Hunt
  550: 2009,     // Left 4 Dead 2
  105600: 2011,  // Terraria
  413150: 2016,  // Stardew Valley
  582010: 2018,  // Monster Hunter: World
  632360: 2019,  // Risk of Rain 2
  1145360: 2020, // Hades
  367520: 2017,  // Hollow Knight
  812140: 2018,  // Assassin's Creed Odyssey
  2694490: 2024, // EA SPORTS FC 25
  2195250: 2023, // EA SPORTS FC 24
  2358720: 2024, // Black Myth: Wukong
  1623730: 2024, // Palworld
  1966720: 2023, // Lethal Company
  2161700: 2024, // Persona 3 Reload
  1687950: 2022, // Persona 5 Royal
  2050650: 2023, // Resident Evil 4
  1593500: 2022, // God of War
  1817070: 2022, // Marvel's Spider-Man Remastered
  1151640: 2020, // Horizon Zero Dawn
  1716740: 2023, // Starfield
  1363080: 2024, // Manor Lords
  227300: 2012,  // Euro Truck Simulator 2
  1172470: 2020, // Apex Legends
  578080: 2017,  // PUBG: BATTLEGROUNDS
  252490: 2018,  // Rust
  381210: 2016,  // Dead by Daylight
  359550: 2015,  // Tom Clancy's Rainbow Six Siege
  271590: 2015,  // Grand Theft Auto V
  1174180: 2019, // Red Dead Redemption 2
  1172620: 2020, // Sea of Thieves
  1238810: 2021, // Battlefield 2042
  1238840: 2020, // Battlefield V
  1238860: 2016, // Battlefield 1
  255710: 2015,  // Cities: Skylines
  945360: 2018,  // Among Us
  1063730: 2021, // New World
  1868140: 2023, // DAVE THE DIVER
  1938090: 2023, // Call of Duty
  1240440: 2021, // Halo Infinite
  1097150: 2020, // Fall Guys
  1774580: 2023, // STAR WARS Jedi: Survivor
  2054970: 2024, // Dragon's Dogma 2
  2246340: 2024, // Enshrouded
  2322010: 2024, // God of War Ragnarök
  1888930: 2023, // Armored Core VI
  1203220: 2021, // NARAKA: BLADEPOINT
  1326470: 2022, // Sons Of The Forest
  440: 2007,     // Team Fortress 2
  230410: 2013,  // Warframe
  218620: 2013,  // PAYDAY 2
};

export function getGameReleaseYear(appId: number, name?: string): number | null {
  if (KNOWN_RELEASE_YEARS[appId]) {
    return KNOWN_RELEASE_YEARS[appId];
  }

  // Check if year is in the title (e.g. "EA SPORTS FC 25", "F1 24", "NBA 2K24")
  if (name) {
    const yearMatch = name.match(/\b(20\d\d)\b/);
    if (yearMatch) {
      return parseInt(yearMatch[1], 10);
    }
    const shortYearMatch = name.match(/\b(?:FC|2K|F1|FIFA|WRC|MotoGP|Madden)\s*(\d{2})\b/i);
    if (shortYearMatch) {
      return 2000 + parseInt(shortYearMatch[1], 10);
    }
  }

  // Monotonic AppID estimation for general titles
  if (appId >= 2400000) return 2024;
  if (appId >= 1900000) return 2023;
  if (appId >= 1500000) return 2022;
  if (appId >= 1200000) return 2021;
  if (appId >= 900000) return 2020;
  if (appId >= 700000) return 2019;
  if (appId >= 500000) return 2018;
  if (appId >= 350000) return 2016;
  if (appId >= 200000) return 2014;
  if (appId >= 50000) return 2011;
  if (appId > 0) return 2008;

  return null;
}

/**
 * Extracts a clean SteamID64 or vanity username from any user input:
 * - Full profile URLs (https://steamcommunity.com/profiles/76561198000000001/)
 * - Vanity URLs (https://steamcommunity.com/id/vanity_name/)
 * - Raw SteamID64s (76561198000000001)
 * - Raw custom names (vanity_name)
 */
export function extractSteamIdentifier(input: string): string {
  if (!input) return "";
  let trimmed = input.trim();

  // Match /profiles/(digits)
  const profileMatch = trimmed.match(/steamcommunity\.com\/profiles\/(\d+)/i);
  if (profileMatch) return profileMatch[1];

  // Match /id/(vanity_name)
  const idMatch = trimmed.match(/steamcommunity\.com\/id\/([^/?#]+)/i);
  if (idMatch) return idMatch[1];

  // If starts with or contains 7656119, extract numeric SteamID64
  const numericMatch = trimmed.match(/(7656119\d{10})/);
  if (numericMatch) return numericMatch[1];

  // Clean trailing and leading slashes
  return trimmed.replace(/^\/+|\/+$/g, "");
}
