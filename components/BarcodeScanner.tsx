"use client";

import { useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface Props {
  onScan: (decodedText: string) => void;
  // Pause scanning while a lookup/borrow request from the previous scan is
  // still in flight, so the same barcode isn't submitted twice in a row.
  paused?: boolean;
}

const SCANNER_ELEMENT_ID = "svym-barcode-scanner";

// Thin wrapper around html5-qrcode's camera scanner. Mounts a live camera
// feed into a div and calls onScan() once per successful decode. Used both
// for "scan a book to search/borrow" and could be reused for the staff-ID
// step too if SVYM later prints staff ID cards with their own QR codes.
const BarcodeScanner = ({ onScan, paused }: Props) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ text: string; time: number } | null>(null);

  useEffect(() => {
    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          const now = Date.now();
          // Debounce: ignore the same code firing repeatedly while it's
          // still in the camera's view.
          if (
            lastScanRef.current &&
            lastScanRef.current.text === decodedText &&
            now - lastScanRef.current.time < 3000
          ) {
            return;
          }
          lastScanRef.current = { text: decodedText, time: now };
          onScan(decodedText);
        },
        () => {
          // Per-frame "no code found" callback - intentionally ignored,
          // this fires continuously while the camera is searching.
        },
      )
      .catch((err) => {
        console.error("Could not start camera scanner", err);
      });

    return () => {
      scanner
        .stop()
        .then(() => scanner.clear())
        .catch(() => {
          // Scanner may already be stopped on fast unmount; safe to ignore.
        });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        id={SCANNER_ELEMENT_ID}
        className="w-full max-w-sm overflow-hidden rounded-lg border border-gray-100"
      />
      {paused && (
        <p className="text-sm text-light-500">Processing last scan...</p>
      )}
    </div>
  );
};

export default BarcodeScanner;
