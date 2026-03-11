import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { serialize } from "next-mdx-remote/serialize";

const STORIES_DIR = path.join(process.cwd(), "content", "stories");

export async function loadStories() {
  if (!fs.existsSync(STORIES_DIR)) return [];

  const files = fs.readdirSync(STORIES_DIR).filter((f) => f.endsWith(".mdx"));
  const stories = await Promise.all(
    files.map(async (file) => {
      const raw = fs.readFileSync(path.join(STORIES_DIR, file), "utf-8");
      const { data, content } = matter(raw);
      const mdxSource = await serialize(content, { parseFrontmatter: false });
      return {
        slug: file.replace(/\.mdx$/, ""),
        name: (data.name as string) || file.replace(/\.mdx$/, ""),
        description: (data.description as string) || "",
        hazard: (data.hazard as string) || "flood",
        mdxSource,
      };
    })
  );
  return stories;
}
