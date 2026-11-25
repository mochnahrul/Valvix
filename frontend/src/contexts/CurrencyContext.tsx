import React, { createContext, useContext, useState, useCallback } from "react";
import {
  SupportedCurrency,
  CURRENCY_CONFIG,
  CurrencyConfig,
  formatCurrency,
  formatCurrencyCompact,
} from "@/lib/utils";

const STORAGE_KEY = "valvix_currency";

interface CurrencyContextValue {
  currency: SupportedCurrency;
  currencyMeta: CurrencyConfig;
  setCurrency: (next: SupportedCurrency) => void;
  formatPrice: (amountIDR: number | null | undefined) => string;
  formatPriceCompact: (amountIDR: number | null | undefined) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function getInitialCurrency(): SupportedCurrency {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as SupportedCurrency | null;
    if (saved && saved in CURRENCY_CONFIG) {
      return saved;
    }
  } catch {
    // ignore storage errors
  }
  return "USD";
}

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currency, setCurrencyState] = useState<SupportedCurrency>(getInitialCurrency);

  const setCurrency = useCallback((next: SupportedCurrency) => {
    setCurrencyState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  }, []);

  const formatPrice = useCallback(
    (amountIDR: number | null | undefined) => formatCurrency(amountIDR, currency),
    [currency]
  );

  const formatPriceCompact = useCallback(
    (amountIDR: number | null | undefined) => formatCurrencyCompact(amountIDR, currency),
    [currency]
  );

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        currencyMeta: CURRENCY_CONFIG[currency],
        setCurrency,
        formatPrice,
        formatPriceCompact,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return ctx;
}
