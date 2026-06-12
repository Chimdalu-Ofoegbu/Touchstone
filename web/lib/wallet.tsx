"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getAddress } from "viem";
import { mantle } from "viem/chains";

type Eip1193 = {
  request: (a: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

const MANTLE_HEX = "0x1388"; // 5000
const STORE_KEY = "ts-wallet";

function getProvider(): Eip1193 | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { ethereum?: Eip1193 }).ethereum;
}

type WalletState = {
  address: string | null;
  chainId: number | null;
  connecting: boolean;
  hasWallet: boolean;
  isMantle: boolean;
  connect: () => Promise<string | null>;
  disconnect: () => void;
  ensureMantle: () => Promise<void>;
};

const WalletCtx = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);

  // Reconnect silently on load (if previously connected) + react to wallet events.
  useEffect(() => {
    const eth = getProvider();
    setHasWallet(!!eth);
    if (!eth) return;
    let live = true;
    (async () => {
      try {
        const cid = (await eth.request({ method: "eth_chainId" })) as string;
        if (live) setChainId(parseInt(cid, 16));
        if (localStorage.getItem(STORE_KEY) === "1") {
          const accts = (await eth.request({ method: "eth_accounts" })) as string[];
          if (live && accts?.[0]) setAddress(getAddress(accts[0]));
        }
      } catch {}
    })();
    const onAccounts = (...args: unknown[]) => {
      const accts = args[0] as string[] | undefined;
      if (accts?.[0]) setAddress(getAddress(accts[0]));
      else {
        setAddress(null);
        try {
          localStorage.removeItem(STORE_KEY);
        } catch {}
      }
    };
    const onChain = (...args: unknown[]) => setChainId(parseInt(args[0] as string, 16));
    eth.on?.("accountsChanged", onAccounts);
    eth.on?.("chainChanged", onChain);
    return () => {
      live = false;
      eth.removeListener?.("accountsChanged", onAccounts);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, []);

  const connect = useCallback(async () => {
    const eth = getProvider();
    if (!eth) return null;
    setConnecting(true);
    try {
      const accts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const a = accts?.[0] ? getAddress(accts[0]) : null;
      setAddress(a);
      try {
        if (a) localStorage.setItem(STORE_KEY, "1");
      } catch {}
      const cid = (await eth.request({ method: "eth_chainId" })) as string;
      setChainId(parseInt(cid, 16));
      return a;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    try {
      localStorage.removeItem(STORE_KEY);
    } catch {}
  }, []);

  const ensureMantle = useCallback(async () => {
    const eth = getProvider();
    if (!eth) return;
    const cid = (await eth.request({ method: "eth_chainId" })) as string;
    if (parseInt(cid, 16) === mantle.id) return;
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: MANTLE_HEX }] });
    } catch (e) {
      if ((e as { code?: number })?.code === 4902) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: MANTLE_HEX,
              chainName: "Mantle",
              nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
              rpcUrls: ["https://rpc.mantle.xyz"],
              blockExplorerUrls: ["https://mantlescan.xyz"],
            },
          ],
        });
      } else {
        throw e;
      }
    }
    setChainId(mantle.id);
  }, []);

  const value = useMemo<WalletState>(
    () => ({
      address,
      chainId,
      connecting,
      hasWallet,
      isMantle: chainId === mantle.id,
      connect,
      disconnect,
      ensureMantle,
    }),
    [address, chainId, connecting, hasWallet, connect, disconnect, ensureMantle],
  );

  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletCtx);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
