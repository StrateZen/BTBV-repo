import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function createOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function hashOpaqueToken(token = "") {
  return createHash("sha256").update(String(token)).digest("hex");
}

export function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const digest = createHash("sha256").update(`${salt}:${password}`).digest("hex");
  return `${salt}:${digest}`;
}

export function verifyPassword(password, storedHash = "") {
  const [salt, digest] = storedHash.split(":");
  if (!salt || !digest) return false;

  const candidate = hashPassword(password, salt).split(":")[1];
  const left = Buffer.from(candidate);
  const right = Buffer.from(digest);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function publicUser(user) {
  if (!user) return null;
  const { password_hash, ...safeUser } = user;
  return safeUser;
}
