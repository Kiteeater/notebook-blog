import { NextResponse } from "next/server";
import { getAllPosts } from "@/lib/posts";

export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(getAllPosts());
}
