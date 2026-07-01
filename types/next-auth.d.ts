import { DefaultSession } from "next-auth";

// Augments NextAuth's built-in types with the fields this app actually
// uses. Without this, every access to session.user.id or token.id
// required an `as string` cast (which the original code had scattered
// through it) - that's a real type hole, since nothing actually
// guarantees those fields exist at that point, the cast just tells
// TypeScript to stop checking.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

// NextAuth v5's own "next-auth/jwt" module is just a re-export
// (`export * from "@auth/core/jwt"`) - the JWT interface is actually
// declared in @auth/core/jwt, and augmenting the re-exporting module
// doesn't reliably merge into the original declaration. Augmenting
// @auth/core/jwt directly is what actually takes effect.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    tokenVersion: number;
    // Unix ms timestamp of the last time this token's tokenVersion was
    // checked against the database. See auth.ts's jwt callback - this
    // throttles the revocation check to once per TTL window rather than
    // on every single request, to avoid a DB round trip per request.
    lastValidatedAt: number;
  }
}
