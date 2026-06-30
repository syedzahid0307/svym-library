import React from "react";
import { Button } from "@/components/ui/button";
import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import BookList from "@/components/BookList";
import { getBorrowedBooksForUser } from "@/lib/actions/book";

const Page = async () => {
  const session = await auth();

  if (!session?.user?.id) redirect("/sign-in");

  const borrowedBooks = await getBorrowedBooksForUser(session.user.id);

  return (
    <>
      <form
        action={async () => {
          "use server";

          await signOut();
        }}
        className="mb-10"
      >
        <Button>Logout</Button>
      </form>

      {borrowedBooks.length > 0 ? (
        <BookList title="Borrowed Books" books={borrowedBooks} />
      ) : (
        <p className="text-light-100">
          You haven&apos;t borrowed any books yet. Scan a book at the library
          desk or borrow one from the catalog to see it here.
        </p>
      )}
    </>
  );
};
export default Page;
