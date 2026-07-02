"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { deleteBook } from "@/lib/admin/actions/book";
import { toast } from "@/hooks/use-toast";
import BookCover from "@/components/BookCover";

const BooksTable = ({ books }: { books: Book[] }) => {
  const [list, setList] = useState(books);
  const [isPending, startTransition] = useTransition();
  const [actingOn, setActingOn] = useState<string | null>(null);

  const handleDelete = (id: string, title: string) => {
    // TODO (EF-26 in the engineering report): replace with the shadcn
    // AlertDialog primitive to match the rest of the admin UI's design
    // system - window.confirm works but looks out of place next to
    // everything else here. Deferred for now to keep this pass focused
    // on making delete actually function at all.
    const confirmed = window.confirm(
      `Remove "${title}" from the catalog? If it has borrow history it will be archived (recoverable) instead of permanently deleted.`,
    );
    if (!confirmed) return;

    setActingOn(id);
    startTransition(async () => {
      const result = await deleteBook(id);

      if (result.success) {
        setList((prev) => prev.filter((b) => b.id !== id));
        toast({
          title: result.archived ? "Book archived" : "Book deleted",
          description: result.message,
        });
      } else {
        toast({
          title: "Couldn't remove this book",
          description: result.message,
          variant: "destructive",
        });
      }
      setActingOn(null);
    });
  };

  if (!list.length) {
    return (
      <p className="mt-10 text-center text-light-500">
        No books in the catalog yet.
      </p>
    );
  }

  return (
    <div className="mt-7 w-full overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-light-400 text-light-500">
            <th className="py-3 pr-4 font-medium">Book</th>
            <th className="py-3 pr-4 font-medium">Author</th>
            <th className="py-3 pr-4 font-medium">Genre</th>
            <th className="py-3 pr-4 font-medium">Copies</th>
            <th className="py-3 pr-4 font-medium">Barcode</th>
            <th className="py-3 pr-4 font-medium">Action</th>
          </tr>
        </thead>
        <tbody>
          {list.map((book) => (
            <tr key={book.id} className="border-b border-light-400/60">
              <td className="py-3 pr-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 shrink-0">
                    <BookCover
                      coverColor={book.coverColor}
                      coverImage={book.coverUrl}
                      variant="extraSmall"
                    />
                  </div>
                  <span className="font-medium text-dark-400">
                    {book.title}
                  </span>
                </div>
              </td>
              <td className="py-3 pr-4 text-dark-200">{book.author}</td>
              <td className="py-3 pr-4 text-dark-200">{book.genre}</td>
              <td className="py-3 pr-4 text-dark-200">
                {book.availableCopies}/{book.totalCopies}
              </td>
              <td className="py-3 pr-4 font-mono text-xs text-dark-200">
                {book.libraryBarcode}
              </td>
              <td className="py-3 pr-4">
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/admin/books/${book.id}/edit`}>Edit</Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/admin/books/${book.id}/barcode`}>
                      Barcode
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isPending && actingOn === book.id}
                    onClick={() => handleDelete(book.id, book.title)}
                  >
                    Remove
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BooksTable;
