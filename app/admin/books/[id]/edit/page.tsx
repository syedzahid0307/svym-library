import { db } from "@/database/drizzle";
import { books } from "@/database/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import BookForm from "@/components/admin/forms/BookForm";

const EditBookPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;

  const result = await db.select().from(books).where(eq(books.id, id)).limit(1);

  if (!result.length) notFound();

  const book = JSON.parse(JSON.stringify(result[0])) as Book;

  return (
    <>
      <Button asChild className="back-btn">
        <Link href="/admin/books">Go Back</Link>
      </Button>

      <section className="w-full max-w-2xl">
        <BookForm type="update" {...book} />
      </section>
    </>
  );
};

export default EditBookPage;
