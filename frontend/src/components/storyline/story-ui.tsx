"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Globe, Users, Skull, Home, MapPin, CloudRain, AlertTriangle, Map,
} from "lucide-react";

// ── Icon lookup ──
const ICONS: Record<string, React.ElementType> = {
  globe: Globe, users: Users, skull: Skull, home: Home,
  map: Map, rain: CloudRain, alert: AlertTriangle, pin: MapPin,
};

// ── Severity colors ──
export type SeverityLevel = "extreme" | "severe" | "high" | "moderate";

const SEVERITY_COLORS: Record<SeverityLevel, { bg: string; text: string; border: string }> = {
  extreme: { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/40" },
  severe: { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/40" },
  high: { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/40" },
  moderate: { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/40" },
};

// ── Hero — compact title bar ──
export function Hero({ children }: { children: ReactNode; scrollPrompt?: string }) {
  return (
    <div className="bg-slate-900 px-6 py-5">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-white prose prose-invert prose-sm max-w-none [&>h1]:text-lg [&>h1]:font-bold [&>h1]:m-0 [&>p]:text-xs [&>p]:text-gray-400 [&>p]:m-0 [&>p]:mt-1">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── StatGrid + Stat — inline compact ──
export function StatGrid({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3 mt-2 not-prose flex-wrap">
      {children}
    </div>
  );
}

export function Stat({ value, label, icon, color = "text-white" }: {
  value: string; label: string; icon?: string; color?: string;
}) {
  const Icon = icon ? ICONS[icon] : null;
  return (
    <div className="flex items-center gap-1.5 rounded bg-white/10 px-2.5 py-1.5">
      {Icon && <Icon className={`h-3.5 w-3.5 ${color}`} />}
      <span className={`text-sm font-bold ${color}`}>{value}</span>
      <span className="text-[10px] text-gray-400 uppercase">{label}</span>
    </div>
  );
}

// ── CountryHeader ──
export function CountryHeader({ country, code, emdat, severity = "high", period }: {
  country: string; code: string; emdat?: string; severity?: SeverityLevel; period?: string;
}) {
  const s = SEVERITY_COLORS[severity];
  return (
    <div className="mb-3 not-prose">
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${s.bg} ${s.text} ${s.border} border`}>
          {severity}
        </span>
        <span className="text-xs text-gray-400">{code}</span>
        {emdat && <span className="text-xs text-gray-500">EM-DAT: {emdat}</span>}
      </div>
      <h3 className="text-lg font-bold text-white">{country}</h3>
      {period && <p className="text-xs text-gray-400">{period}</p>}
    </div>
  );
}

// ── ImpactStats ──
export function ImpactStats({ affected, deaths, displaced }: {
  affected?: string; deaths?: string; displaced?: string;
}) {
  const items = [
    affected && { label: "Affected", value: affected, color: "text-cyan-400" },
    deaths && { label: "Deaths", value: deaths, color: "text-red-400" },
    displaced && { label: "Displaced", value: displaced, color: "text-amber-400" },
  ].filter(Boolean) as { label: string; value: string; color: string }[];

  if (items.length === 0) return null;

  return (
    <div className="my-3 flex gap-4 not-prose">
      {items.map((item) => (
        <div key={item.label} className="text-center">
          <p className={`text-lg font-bold ${item.color}`}>{item.value}</p>
          <p className="text-[10px] text-gray-400 uppercase">{item.label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Block + Prose ──
export function Block({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      {children}
    </div>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none prose-headings:text-white prose-p:text-gray-200 prose-strong:text-white prose-li:text-gray-300">
      {children}
    </div>
  );
}
