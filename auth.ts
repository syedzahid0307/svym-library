import NextAuth, { User } from "next-auth";
import { compare } from "bcryptjs";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/database/drizzle";
import { users } from "@/database/schema";
import { eq } from "drizzle-orm";

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: "jwt",
    // NextAuth defaults to a 30-day session with no re-validation against
    // the database in between. Account status (PENDING/APPROVED/
    // REJECTED) and role are only checked once, at sign-in - if an admin
    // later rejects a previously-approved member or changes their role,
    // that person's existing browser session keeps working exactly as
    // before for up to 30 days, since nothing re-checks status on
    // subsequent requests.
    //
    // 24 hours doesn't close that gap - it shrinks it. A full fix needs
    // a revocation mechanism (e.g. a tokenVersion column checked on
    // every request) that invalidates existing sessions immediately when
    // status changes; that's a larger change, deferred for now. This is
    // the cheap, immediate mitigation.
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

        return {
          id: user[0].id.toString(),
          email: user[0].email,
          name: user[0].fullName,
        } as User;
      },
    }),
  ],
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = token.name as string;
      }

      return session;
    },
  },
});
