export type PostMeta = {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO yyyy-mm-dd
  tags: string[];
  category?: string;
  readingTime?: string;
};

export type Heading = {
  id: string;
  text: string;
  level: 2 | 3;
};

export type Post = PostMeta & {
  contentHtml: string;
  headings: Heading[];
};
