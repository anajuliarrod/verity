import type { ReactNode } from "react";
import { AppShell } from "@/components/app/AppShell";
import { ConnectWalletButton } from "@/components/wallet";

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return <AppShell rightSlot={<ConnectWalletButton />}>{children}</AppShell>;
}
