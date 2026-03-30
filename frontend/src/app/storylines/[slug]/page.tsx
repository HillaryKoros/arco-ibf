import { Suspense } from "react";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { loadStories } from "@/lib/load-stories";
import { ArrowLeft } from "lucide-react";

const StorylinePanel = dynamic(
  () => import("@/components/storyline/storyline-panel").then((m) => m.StorylinePanel),
  { ssr: false, loading: () => <div className="h-screen flex items-center justify-center text-gray-400">Loading storyline...</div> }
);

interface Props {
  params: { slug: string };
}

export default async function StorylinePage({ params }: Props) {
  const stories = await loadStories();
  const story = stories.find((s) => s.slug === params.slug);

  if (!story) notFound();

  return (
    <>
      {/* Back nav */}
      <div className="bg-slate-900 border-b border-gray-700/50 sticky top-14 z-20">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-4">
          <Link
            href="/storylines"
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            All Storylines
          </Link>
          <span className="text-gray-600">|</span>
          <Link
            href="/"
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </div>

      {/* Storyline */}
      <Suspense fallback={null}>
        <StorylinePanel stories={[story]} hazard={story.hazard} />
      </Suspense>
    </>
  );
}

export async function generateStaticParams() {
  const stories = await loadStories();
  return stories.map((s) => ({ slug: s.slug }));
}
