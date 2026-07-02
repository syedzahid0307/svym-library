import NextAuth, { User } from "next-auth";
import { compare } from "bcryptjs";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/database/drizzle";
import { users } from "@/database/schema";
import { eq } from "drizzle-orm";

// How long a session's tokenVersion is trusted before re-checking it
// against the database. Lower = revocation takes effect faster, but
// costs a DB round trip on the first request after the window expires
// for every active user, not just ones who were actually revoked.
// 5 minutes is a reasonable middle ground for a library-sized user base.
const TOKEN_VALIDATION_TTL_MS = 5 * 60 * 1000;

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: "jwt",
    // NextAuth defaults to a 30-day session. 24 hours here is the outer
    // bound on how long a session can live even if the tokenVersion
    // check below is somehow never triggered (e.g. TOKEN_VALIDATION_TTL_MS
    // logic has a bug) - the two mechanisms are complementary, not
    // redundant: this is a hard ceiling, tokenVersion is the fast path
    // for actually revoking someone sooner than that ceiling.
    maxAge: 24 * 60 * 60,
  },
  providers: [
    CredentialsProvider({
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email.toString()))
          .limit(1);

        if (user.length === 0) return null;

        const isPasswordValid = await compare(
          credentials.password.toString(),
          user[0].password,
        );

        if (!isPasswordValid) return null;

        // The approval workflow only means something if it's actually
        // enforced here. Without this check, a PENDING or REJECTED
        // account could sign in immediately after registering, before
        // any admin reviewed the staff ID - the admin approve/reject
        // buttons would just be cosmetic.
        if (user[0].status !== "APPROVED") return null;

        // Archived members (see archiveUser in lib/admin/actions/user.ts)
        // shouldn't be able to sign in either, even though their status
        // column might still say APPROVED - archivedAt is a separate
        // lifecycle flag for "no longer an active member" that isn't
        // meant to require re-litigating their approval status.
        if (user[0].archivedAt) return null;

        return {
          id: user[0].id.toString(),
          email: user[0].email,
          name: user[0].fullName,
          tokenVersion: user[0].tokenVersion,
        } as User & { tokenVersion: number };
      },
    }),
  ],
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    async jwt({ token, user }) {
      // Sign-in: user is only present on the initial call right after
      // authorize() succeeds. Stamp the token with the tokenVersion that
      // was current at that moment and record when it was last checked.
      if (user) {
        token.id = user.id as string;
        token.name = user.name as string;
        token.tokenVersion = (user as { tokenVersion: number }).tokenVersion;
        token.lastValidatedAt = Date.now();
        return token;
      }

      // Every other call (i.e. every request using an existing session):
      // only hit the database if the TTL has actually expired, so most
      // requests skip this entirely and just reuse the token as-is.
      const isStale =
        !token.lastValidatedAt ||
        Date.now() - token.lastValidatedAt > TOKEN_VALIDATION_TTL_MS;

      if (!isStale) {
        return token;
      }

      const current = await db
        .select({
          tokenVersion: users.tokenVersion,
          status: users.status,
          archivedAt: users.archivedAt,
        })
        .from(users)
        .where(eq(users.id, token.id))
        .limit(1);

      // Account no longer exists, was rejected or archived, or an admin
      // bumped tokenVersion (via rejectUser/updateUserRole/archiveUser in
      // lib/admin/actions/user.ts) since this token was issued or last
      // checked - force re-authentication rather than silently letting a
      // stale session continue.
      //
      // NOTE: throwing here to invalidate the session is the documented
      // NextAuth pattern for this, but hasn't been exercised against a
      // live deployment as part of this change - verify end-to-end
      // (reject a signed-in test user, confirm their next request past
      // the TTL window actually gets logged out) before relying on this
      // in production.
      if (
        !current.length ||
        current[0].status !== "APPROVED" ||
        current[0].archivedAt ||
        current[0].tokenVersion !== token.tokenVersion
      ) {
        throw new Error("Session revoked");
      }

      token.lastValidatedAt = Date.now();
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.name = token.name as string;
      }

      return session;
    },
  },
});
