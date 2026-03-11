"use client";

import { Sun, Droplets } from "lucide-react";
import type { HazardType } from "@/lib/colors";

interface Props {
  value: HazardType | null;
  onChange: (h: HazardType) => void;
}

export function HazardToggle({ value, onChange }: Props) {
  const items: { key: HazardType; label: string; icon: typeof Sun }[] = [
    { key: "drought", label: "Drought", icon: Sun },
    { key: "flood", label: "Flood", icon: Droplets },
  ];

  return (
    <div className="flex gap-2">
      {items.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            value === key
              ? key === "drought"
                ? "bg-red-600 text-white shadow-md"
                : "bg-blue-600 text-white shadow-md"
              : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
          }`}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
