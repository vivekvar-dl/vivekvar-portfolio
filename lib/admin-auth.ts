import { env } from "cloudflare:workers";
import { cookies } from "next/headers";

const COOKIE_NAME = "vivek_blog_admin";
const SESSION_SECONDS = 60 * 60 * 12;

function runtimeEnv(name: string): string {
  const workerEnv = env as unknown as Record<string, string | undefined>;
  return workerEnv[name] ?? process.env[name] ?? "";
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(runtimeEnv("ADMIN_SESSION_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToHex(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

export async function verifyCredentials(username: string, password: string) {
  const expectedUser = runtimeEnv("ADMIN_USERNAME");
  const expectedHash = runtimeEnv("ADMIN_PASSWORD_HASH");
  if (!expectedUser || !expectedHash || !runtimeEnv("ADMIN_SESSION_SECRET")) return false;
  const suppliedHash = await sha256(password);
  return username === expectedUser && suppliedHash === expectedHash;
}

export async function createAdminSession() {
  const expires = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `${runtimeEnv("ADMIN_USERNAME")}.${expires}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifyAdminSession(token?: string | null) {
  if (!token || !runtimeEnv("ADMIN_SESSION_SECRET")) return false;
  const [username, expiresText, signature] = token.split(".");
  const expires = Number(expiresText);
  if (!username || !expires || !signature || expires <= Math.floor(Date.now() / 1000)) return false;
  if (username !== runtimeEnv("ADMIN_USERNAME")) return false;
  return signature === (await sign(`${username}.${expiresText}`));
}

export async function isAdminRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  return verifyAdminSession(token);
}

export async function isAdminPageSession() {
  const store = await cookies();
  return verifyAdminSession(store.get(COOKIE_NAME)?.value);
}

export function adminCookie(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${SESSION_SECONDS}; SameSite=Strict${secure}`;
}

export function clearAdminCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict${secure}`;
}
