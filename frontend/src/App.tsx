import { AppShell } from "@/components/layout/AppShell";
import { CurrencyProvider } from "@/contexts/CurrencyContext";

export default function App() {
  return (
    <CurrencyProvider>
      <AppShell />
    </CurrencyProvider>
  );
}
