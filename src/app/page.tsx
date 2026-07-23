import Hero from "@/components/home/Hero";
import { getAllPosts } from "@/lib/posts";

export default function Home() {
  const postCount = getAllPosts().length;
  return <Hero postCount={postCount} />;
}
