"use client";

import Image from "next/image";
import type { ReactNode } from "react";

export type MintSlot = {
  id: string;
  label: string;
  amount: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export type MatchPredictionPreviewProps = {
  teamA: string;
  teamB: string;
  teamAFlagUri?: string;
  teamBFlagUri?: string;
  mintSlots: MintSlot[];
  rewardAssetSymbol?: string;
  label?: string;
  showMetadata?: boolean;
  metadataUri?: string;
  footer?: ReactNode;
};

const mintSlotButtonClassName =
  "flex min-h-[4.5rem] min-w-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border px-3 py-3 text-center text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#61f58f]/60 disabled:cursor-not-allowed disabled:opacity-50";

const mintSlotStaticClassName =
  "flex min-h-[4rem] min-w-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border border-[#1f2c20] bg-[#101512] px-3 py-3 text-center text-sm text-[#dce4dc]";

export function MatchPredictionPreview({
  teamA,
  teamB,
  teamAFlagUri,
  teamBFlagUri,
  mintSlots,
  rewardAssetSymbol = "COR",
  label = "Match preview",
  showMetadata = false,
  metadataUri,
  footer,
}: MatchPredictionPreviewProps) {
  return (
    <div className="w-full rounded-[24px] border border-[#1f2c20] bg-[linear-gradient(180deg,#111512_0%,#090c0a_100%)] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] sm:p-6">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8f9b8e]">{label}</div>
      <div className="mt-3 rounded-[22px] border border-[#23282a] bg-[#0a0e0b] p-4">
        <div className="flex flex-col items-stretch gap-4 rounded-[18px] border border-[#1d291f] bg-[#0d120e] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-[#243225] bg-[#111713]">
              {teamAFlagUri ? (
                <Image src={teamAFlagUri} alt={teamA || "Team A"} fill className="object-cover" unoptimized />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-[#8f9b8e]">A</div>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-[0.14em] text-[#7f8c80]">Team A</div>
              <div className="truncate text-base font-semibold text-[#f1f1ea]">{teamA || "Team A"}</div>
            </div>
          </div>

          <div className="shrink-0 text-sm font-semibold uppercase tracking-[0.16em] text-[#61f58f]">vs</div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-3 text-right">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-[0.14em] text-[#7f8c80]">Team B</div>
              <div className="truncate text-base font-semibold text-[#f1f1ea]">{teamB || "Team B"}</div>
            </div>
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-[#243225] bg-[#111713]">
              {teamBFlagUri ? (
                <Image src={teamBFlagUri} alt={teamB || "Team B"} fill className="object-cover" unoptimized />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-[#8f9b8e]">B</div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-3">
          {mintSlots.map((slot) => {
            const amountLabel = (
              <span className="font-mono text-base font-semibold text-[#f1f1ea] sm:text-lg">
                {slot.amount} {rewardAssetSymbol}
              </span>
            );

            if (slot.onClick) {
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={slot.onClick}
                  disabled={slot.disabled || slot.loading}
                  className={`${mintSlotButtonClassName} border-[#334032] bg-[#263126] text-[#edf5ed] hover:bg-[#2d3a2d] active:scale-[0.99]`}
                >
                  <span className="text-xs uppercase tracking-[0.12em] text-[#a9b4a8]">{slot.label}</span>
                  {amountLabel}
                  <span className="text-[11px] font-medium text-[#61f58f]">
                    {slot.loading ? "Minting..." : "Tap to mint"}
                  </span>
                </button>
              );
            }

            return (
              <div key={slot.id} className={mintSlotStaticClassName}>
                <span className="text-xs uppercase tracking-[0.12em] text-[#8f9b8e]">{slot.label}</span>
                {amountLabel}
              </div>
            );
          })}
        </div>

        {showMetadata && metadataUri !== undefined ? (
          <div className="mt-4 rounded-2xl border border-[#243225] bg-[#0c120d] px-4 py-3">
            <div className="text-xs uppercase tracking-[0.16em] text-[#8f9b8e]">Metadata URI</div>
            <div suppressHydrationWarning className="mt-2 break-all font-mono text-xs text-[#a9b4a8]">
              {metadataUri || "Metadata URI unavailable during server render."}
            </div>
          </div>
        ) : null}

        {footer ? <div className="mt-4 flex flex-col gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}
