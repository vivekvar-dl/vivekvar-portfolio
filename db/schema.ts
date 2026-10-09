import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const posts = sqliteTable("posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull().default(""),
  imageUrl: text("image_url").notNull().default(""),
  content: text("content").notNull().default(""),
  status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const guestbook = sqliteTable("guestbook", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  message: text("message").notNull(),
  // SVG path data and the viewBox that frames it.
  signature: text("signature").notNull(),
  viewBox: text("view_box").notNull(),
  // SHA-256 of the signer's IP, only for rate limiting.
  ipHash: text("ip_hash").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
