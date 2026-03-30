import Link from "next/link";
import { loadStories } from "@/lib/load-stories";
import { Sun, Droplets, ArrowRight } from "lucide-react";

export default async function StorylinesPage() {
  const stories = await loadStories();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
        CRMA Storylines
      </p>
      <h1 className="text-3xl font-bold mt-1">
        East Africa Disaster Storylines
      </h1>
      <p className="mt-2 text-gray-500 max-w-2xl">
        Scroll-driven narratives exploring drought and flood disasters across
        the Greater Horn of Africa. Each storyline maps country-by-country
        impacts with interactive satellite imagery.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {stories.map((story) => {
          const isDrought = story.hazard === "drought";
          return (
            <Link
              key={story.slug}
              href={`/storylines/${story.slug}`}
              className="group block rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-lg hover:border-gray-300 transition-all"
            >
              <div className="flex items-center gap-2 mb-3">
                {isDrought ? (
                  <Sun className="h-5 w-5 text-red-500" />
                ) : (
                  <Droplets className="h-5 w-5 text-blue-500" />
                )}
                <span
                  className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${
                    isDrought
                      ? "bg-red-100 text-red-600"
                      : "bg-blue-100 text-blue-600"
                  }`}
                >
                  {story.hazard}
                </span>
              </div>
              <h2 className="text-lg font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                {story.name}
              </h2>
              <p className="mt-1 text-sm text-gray-500">{story.description}</p>
              <div className="mt-4 flex items-center gap-1 text-sm font-medium text-blue-600 group-hover:gap-2 transition-all">
                Read storyline <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-8">
        <Link
          href="/"
          className="text-sm text-gray-400 hover:text-gray-600 underline"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
