"use client";

import { useState, useMemo } from "react";
import { MDXRemote, type MDXRemoteSerializeResult } from "next-mdx-remote";
import { Storyline, Chapter } from "./story-map";
import { Hero, StatGrid, Stat, CountryHeader, ImpactStats, Block, Prose } from "./story-ui";
import { ArrowUp } from "lucide-react";

const mdxComponents = {
  Hero,
  StatGrid,
  Stat,
  CountryHeader,
  ImpactStats,
  Block,
  Prose,
  Storyline,
  Chapter,
};

interface StoryData {
  slug: string;
  name: string;
  description: string;
  hazard: string;
  mdxSource: MDXRemoteSerializeResult;
}

interface Props {
  stories: StoryData[];
  hazard: string;
}

export function StorylinePanel({ stories, hazard }: Props) {
  // Filter stories by selected hazard
  const filtered = useMemo(
    () => stories.filter((s) => s.hazard === hazard),
    [stories, hazard]
  );

  const [activeStory, setActiveStory] = useState(0);

  if (!filtered || filtered.length === 0) return null;

  const idx = activeStory >= filtered.length ? 0 : activeStory;
  const story = filtered[idx];

  return (
    <div>
      {/* Story selector — only if multiple stories for this hazard */}
      {filtered.length > 1 && (
        <div className="mx-auto max-w-7xl px-4 mt-10 mb-4">
          <div className="flex gap-2 flex-wrap">
            {filtered.map((s, i) => (
              <button
                key={s.slug}
                onClick={() => setActiveStory(i)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  i === idx
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Full-width MDX storyline */}
      <MDXRemote {...story.mdxSource} components={mdxComponents} />

      {/* End of Storyline */}
      <div className="bg-slate-900 py-16 text-center">
        <p className="text-gray-400 text-sm uppercase tracking-widest mb-2">End of Storyline</p>
        <p className="text-gray-500 text-xs mb-6">
          {story.name} — ICPAC / IGAD E4DRR Programme
        </p>
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm font-medium"
        >
          <ArrowUp className="h-4 w-4" />
          Back to Top
        </button>
      </div>
    </div>
  );
}
