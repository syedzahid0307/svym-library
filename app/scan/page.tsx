"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import BarcodeScanner from "@/components/BarcodeScanner";
import {
  getUserByStaffId,
  borrowBookByBarcode,
} from "@/lib/actions/book";
import { toast } from "@/hooks/use-toast";

type Member = { id: string; fullName: string };

// /scan - the circulation-desk kiosk flow:
//   1. Staff/member types their staff ID (no password, no photo - this is
//      meant for a shared desk device, not a personal login).
//   2. Camera opens, they scan the QR sticker on a book.
//   3. The book is borrowed for them immediately and they get a receipt
//      message with title + due date.
// This is intentionally separate from the normal signed-in website flow -
// it's for the physical desk, not for browsing.
const ScanPage = () => {
  const [staffId, setStaffId] = useState("");
  const [member, setMember] = useState<Member | null>(null);
  const [loadingMember, setLoadingMember] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleIdentify = async () => {
    const id = Number(staffId);
    if (!id) {
      toast({
        title: "Enter a valid staff ID",
        variant: "destructive",
      });
      return;
    }

    setLoadingMember(true);
    const result = await getUserByStaffId(id);
    setLoadingMember(false);

    if (!result.success || !result.data) {
      toast({
        title: "Couldn't identify member",
        description: result.error,
        variant: "destructive",
      });
      return;
    }

    setMember(result.data);
  };

  const handleScan = async (barcode: string) => {
    if (!member || processing) return;

    setProcessing(true);
    const result = await borrowBookByBarcode({
      staffId: Number(staffId),
      barcode,
    });
    setProcessing(false);

    if (!result.success) {
      toast({
        title: "Couldn't borrow this book",
        description: result.error,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Borrowed!",
      description: `${result.data?.book.title} is checked out to ${result.data?.member.fullName}. Due back in 7 days.`,
    });
  };

  const reset = () => {
    setMember(null);
    setStaffId("");
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-16 text-center">
      <h1 className="text-2xl font-semibold text-dark-400">
        Scan to Borrow
      </h1>

      {!member ? (
        <div className="flex w-full flex-col gap-3">
          <p className="text-sm text-light-500">
            Enter your SVYM staff ID to start
          </p>
          <Input
            type="number"
            placeholder="Staff ID"
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleIdentify()}
            className="book-form_input text-center"
            autoFocus
          />
          <Button onClick={handleIdentify} disabled={loadingMember}>
            {loadingMember ? "Checking..." : "Continue"}
          </Button>
        </div>
      ) : (
        <div className="flex w-full flex-col items-center gap-4">
          <p className="text-base text-dark-400">
            Hi {member.fullName.split(" ")[0]} — scan a book&apos;s barcode sticker
            to borrow it.
          </p>
          <BarcodeScanner onScan={handleScan} paused={processing} />
          <Button variant="outline" onClick={reset}>
            Not you? Switch member
          </Button>
        </div>
      )}
    </div>
  );
};

export default ScanPage;
