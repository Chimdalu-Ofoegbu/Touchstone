"use client";

import { WalletProvider } from "@/lib/wallet";
import { PendingProvider } from "@/lib/pending";

/** App-wide client providers: wallet connection + pending-rating tracking. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <PendingProvider>{children}</PendingProvider>
    </WalletProvider>
  );
}
