"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface OpenLibraryBookData {
  title?: string;
  authors?: { name: string }[];
  subjects?: { name: string }[];
  cover?: { large?: string; medium?: string; small?: string };
}

interface Props {
  // Called with whatever fields could be resolved from the barcode lookup.
  // The caller (BookForm) decides how to merge these into the form state.
  onResolved: (data: {
    title?: string;
    author?: string;
    genre?: string;
    coverUrl?: string;
    isbn: string;
  }) => void;
}

// Looks up a book's existing manufacturer barcode (ISBN/EAN) against the
// free Open Library API and feeds whatever it finds back to the book form,
// so the admin doesn't have to retype title/author/cover by hand.
const ISBNLookup = ({ onResolved }: Props) => {
  const [isbn, setIsbn] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLookup = async () => {
    const cleaned = isbn.replace(/[^0-9Xx]/g, "");

    if (!cleaned) {
      toast({
        title: "Enter a barcode",
        description: "Scan or type the ISBN/EAN printed on the book first.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(
        `https://openlibrary.org/api/books?bibkeys=ISBN:${cleaned}&jscmd=data&format=json`,
      );
      const json = await res.json();
      const data: OpenLibraryBookData | undefined = json[`ISBN:${cleaned}`];

      if (!data) {
        toast({
          title: "No match found",
          description:
            "Couldn't find this barcode in the public catalog. You can still fill the form manually.",
          variant: "destructive",
        });
        return;
      }

      onResolved({
        title: data.title,
        author: data.authors?.map((a) => a.name).join(", "),
        genre: data.subjects?.[0]?.name,
        coverUrl: data.cover?.large || data.cover?.medium || data.cover?.small,
        isbn: cleaned,
      });

      toast({
        title: "Book found",
        description: "Fields below have been auto-filled. Review before saving.",
      });
    } catch (error) {
      console.log(error);
      toast({
        title: "Lookup failed",
        description: "Couldn't reach the barcode lookup service. Try again or fill manually.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-dashed border-gray-100 bg-light-600 p-4">
      <p className="mb-2 text-base font-normal text-dark-500">
        Scan or enter the book&apos;s existing barcode (ISBN/EAN)
      </p>
      <div className="flex gap-2">
        <Input
          placeholder="e.g. 9780143442260"
          value={isbn}
          onChange={(e) => setIsbn(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleLookup();
            }
          }}
          className="book-form_input"
          autoFocus
        />
        <Button
          type="button"
          onClick={handleLookup}
          disabled={loading}
          className="shrink-0 bg-primary-admin hover:bg-primary-admin/90"
        >
          {loading ? "Looking up..." : "Look up"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-light-500">
        Most barcode scanners act as keyboards — focus this field and scan
        the barcode directly, then press Enter.
      </p>
    </div>
  );
};

export default ISBNLookup;
