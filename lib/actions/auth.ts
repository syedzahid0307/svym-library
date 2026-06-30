"use server";

import { eq } from "drizzle-orm";
import { db } from "@/database/drizzle";
import { users } from "@/database/schema";
import { hash } from "bcryptjs";
import { signIn } from "@/auth";
import { headers } from "next/headers";
import ratelimit from "@/lib/ratelimit";
import { redirect } from "next/navigation";
import { workflowClient } from "@/lib/workflow";
import config from "@/lib/config";

export const signInWithCredentials = async (
  params: Pick<AuthCredentials, "email" | "password">,
) => {
  const { email, password } = params;

  const ip = (await headers()).get("x-forwarded-for") || "127.0.0.1";
  const { success } = await ratelimit.limit(ip);

  if (!success) return redirect("/too-fast");

  // Check status before calling NextAuth's signIn so we can return a
  // specific, useful message - the credentials provider itself only
  // returns a generic "CredentialsSignin" error for any failure (wrong
  // password, unapproved account, etc.), which would otherwise leave a
  // pending member with no idea why they can't log in.
  const existing = await db
    .select({ status: users.status })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length && existing[0].status === "PENDING") {
    return {
      success: false,
      error:
        "Your account is still waiting for a staff ID check by the library admin.",
    };
  }

  if (existing.length && existing[0].status === "REJECTED") {
    return {
      success: false,
      error:
        "This account was not approved. Contact the library admin if you think this is a mistake.",
    };
  }

  try {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      return { success: false, error: result.error };
    }

    return { success: true };
  } catch (error) {
    console.log(error, "Signin error");
    return { success: false, error: "Signin error" };
  }
};

export const signUp = async (params: AuthCredentials) => {
  const { fullName, email, staffId, password } = params;

  const ip = (await headers()).get("x-forwarded-for") || "127.0.0.1";
  const { success } = await ratelimit.limit(ip);

  if (!success) return redirect("/too-fast");

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser.length > 0) {
    return { success: false, error: "User already exists" };
  }

  const hashedPassword = await hash(password, 10);

  try {
    await db.insert(users).values({
      fullName,
      email,
      staffId,
      password: hashedPassword,
    });

    await workflowClient.trigger({
      url: `${config.env.prodApiEndpoint}/api/workflows/onboarding`,
      body: {
        email,
        fullName,
      },
    });

    // Deliberately not auto-signing-in here: new accounts start as
    // PENDING and can't sign in until an admin approves the staff ID
    // (enforced in auth.ts's authorize()). Auto-logging in at this point
    // would just fail against that check and confuse the user with no
    // explanation - better to tell them clearly that they're pending.
    return {
      success: true,
      pending: true,
      message:
        "Account created. A library admin needs to verify your staff ID before you can sign in.",
    };
  } catch (error) {
    console.log(error, "Signup error");
    return { success: false, error: "Signup error" };
  }
};
