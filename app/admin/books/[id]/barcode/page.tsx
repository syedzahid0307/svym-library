import { db } from "@/database/drizzle";
import { books } from "@/database/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import BookQRCode from "@/components/admin/BookQRCode";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const BarcodePage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;

  const result = await db.select().from(books).where(eq(books.id, id)).limit(1);

  if (!result.length) notFound();

  const book = result[0];

  return (
    <div className="flex flex-col items-center gap-6 py-10">
      <Button asChild className="back-btn print:hidden">
        <Link href="/admin/books">Go Back</Link>
      </Button>

      <h1 className="text-xl font-semibold text-dark-400 print:hidden">
        Barcode sticker for &quot;{book.title}&quot;
      </h1>

      <BookQRCode
        libraryBarcode={book.libraryBarcode}
        title={book.title}
        author={book.author}
      />
    </div>
  );
};

export default BarcodePage;
