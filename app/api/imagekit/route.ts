import ImageKit from "imagekit";
import config from "@/lib/config";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";

const {
  env: {
    imagekit: { publicKey, privateKey, urlEndpoint },
  },
} = config;

const imagekit = new ImageKit({ publicKey, privateKey, urlEndpoint });

// This hands out short-lived ImageKit upload credentials. Without an
// auth check, anyone who finds this URL - logged in or not - could
// request valid signatures and upload arbitrary files straight to your
// ImageKit account, running up storage/bandwidth costs or hosting
// unrelated content under your bucket. The only legitimate caller left
// in the app is the admin book-cover/video upload form, so this is
// gated to admins only.
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  return NextResponse.json(imagekit.getAuthenticationParameters());
}
