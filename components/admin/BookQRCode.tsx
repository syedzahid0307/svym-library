"use client";

import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";

interface Props {
  libraryBarcode: string;
  title: string;
  author: string;
}

// Renders a printable sticker: QR code (encodes the library's internal
// barcode value) + the book title/author as human-readable text underneath,
// in case the sticker gets scuffed or someone needs to read it without a
// scanner. Click Print to send just the sticker area to the printer.
const BookQRCode = ({ libraryBarcode, title, author }: Props) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        id="book-barcode-sticker"
        className="flex w-fit flex-col items-center gap-2 rounded-lg border border-gray-100 bg-white p-4"
      >
        <QRCodeSVG value={libraryBarcode} size={160} level="M" />
        <p className="max-w-[180px] text-center text-sm font-semibold text-dark-400 line-clamp-2">
          {title}
        </p>
        <p className="text-xs text-light-500">{author}</p>
        <p className="font-mono text-xs tracking-wide text-dark-200">
          {libraryBarcode}
        </p>
      </div>

      <Button onClick={handlePrint} className="book-form_btn text-white print:hidden">
        Print barcode sticker
      </Button>

      {/* Only the sticker prints; everything else on the page is hidden. */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #book-barcode-sticker,
          #book-barcode-sticker * {
            visibility: visible;
          }
          #book-barcode-sticker {
            position: fixed;
            top: 20px;
            left: 20px;
          }
        }
      `}</style>
    </div>
  );
};

export default BookQRCode;
