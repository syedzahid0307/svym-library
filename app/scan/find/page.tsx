"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BarcodeScanner from "@/components/BarcodeScanner";
import { getBookByBarcode } from "@/lib/actions/book";
import { toast } from "@/hooks/use-toast";

// /scan/find - point the camera at a book's sticker to jump straight to its
// page (availability, description, borrow button) without typing a search.
const ScanFindPage = () => {
  const router = useRouter();
  const [processing, setProcessing] = useState(false);

  const handleScan = async (barcode: string) => {
    if (processing) return;
    setProcessing(true);

    const result = await getBookByBarcode(barcode);

    if (!result.success || !result.data) {
      setProcessing(false);
      toast({
        title: "Book not found",
        description: result.error,
        variant: "destructive",
      });
      return;
    }

    router.push(`/books/${result.data.id}`);
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-16 text-center">
      <h1 className="text-2xl font-semibold text-dark-400">
        Scan to Find a Book
      </h1>
      <p className="text-sm text-light-500">
        Point your camera at the barcode sticker on the book.
      </p>
      <BarcodeScanner onScan={handleScan} paused={processing} />
    </div>
  );
};

export default ScanFindPage;
