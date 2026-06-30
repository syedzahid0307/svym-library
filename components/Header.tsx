import Link from "next/link";
import Image from "next/image";
import { signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { navigationLinks } from "@/constants";
import { Session } from "next-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

const Header = ({ session }: { session: Session }) => {
  return (
    <header className="my-10 flex justify-between gap-5">
      <Link href="/" className="flex items-center">
        <div className="rounded-md bg-[#0C4DA1] p-2">
          <Image
            src="/images/svym-logo.png"
            alt="SVYM logo"
            width={1076}
            height={452}
            className="h-9 w-auto"
          />
        </div>
      </Link>

      <ul className="flex flex-row items-center gap-8">
        {navigationLinks.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-base font-medium text-light-100 hover:text-primary"
            >
              {link.label}
            </Link>
          </li>
        ))}
        <li>
          <Link href="/my-profile">
            <Avatar>
              <AvatarFallback className="bg-amber-100">
                {getInitials(session?.user?.name || "IN")}
              </AvatarFallback>
            </Avatar>
          </Link>
        </li>
        <li>
          <form
            action={async () => {
              "use server";

              await signOut();
            }}
          >
            <Button>Logout</Button>
          </form>
        </li>
      </ul>
    </header>
  );
};

export default Header;
