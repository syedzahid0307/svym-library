"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markBookReturned, renewBorrow } from "@/lib/admin/actions/borrow";
import { toast } from "@/hooks/use-toast";
import dayjs from "dayjs";

type Filter = "ALL" | "BORROWED" | "OVERDUE" | "RETURNED";

const filterTabs: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "BORROWED", label: "Borrowed" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "RETURNED", label: "Returned" },
];

const statusBadge = (record: BorrowRecordAdminView) => {
  if (record.status === "RETURNED") {
    return (
      <span className="rounded-full bg-[#F0F9FF] px-3 py-1 text-xs font-medium text-[#026AA2]">
        Returned
      </span>
    );
  }
  if (record.isOverdue) {
    return (
      <span className="rounded-full bg-[#FFF1F3] px-3 py-1 text-xs font-medium text-[#C01048]">
        Overdue
      </span>
    );
  }
  return (
    <span className="rounded-full bg-[#F9F5FF] px-3 py-1 text-xs font-medium text-[#6941C6]">
      Borrowed
    </span>
  );
};

const BorrowRecordsTable = ({
  records,
}: {
  records: BorrowRecordAdminView[];
}) => {
  const [list, setList] = useState(records);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [isPending, startTransition] = useTransition();
  const [actingOn, setActingOn] = useState<string | null>(null);

  const filtered = useMemo(() => {
    switch (filter) {
      case "BORROWED":
        return list.filter((r) => r.status === "BORROWED" && !r.isOverdue);
      case "OVERDUE":
        return list.filter((r) => r.status === "BORROWED" && r.isOverdue);
      case "RETURNED":
        return list.filter((r) => r.status === "RETURNED");
      default:
        return list;
    }
  }, [list, filter]);

  const handleReturn = (recordId: string, bookId: string) => {
    setActingOn(recordId);
    startTransition(async () => {
      const result = await markBookReturned(recordId, bookId);

      if (result.success) {
        setList((prev) =>
          prev.map((r) =>
            r.id === recordId
              ? {
                  ...r,
                  status: "RETURNED",
                  returnDate: dayjs().toDate().toDateString(),
                  isOverdue: false,
                }
              : r,
          ),
        );
        toast({ title: "Marked as returned" });
      } else {
        toast({
          title: "Couldn't update this record",
          description: result.error,
          variant: "destructive",
        });
      }
      setActingOn(null);
    });
  };

  const handleRenew = (recordId: string) => {
    setActingOn(recordId);
    startTransition(async () => {
      const result = await renewBorrow(recordId);

      if (result.success && result.dueDate) {
        setList((prev) =>
          prev.map((r) =>
            r.id === recordId
              ? { ...r, dueDate: result.dueDate as string, isOverdue: false }
              : r,
          ),
        );
        toast({
          title: "Loan renewed",
          description: `New due date: ${dayjs(result.dueDate).format("DD MMM YYYY")}`,
        });
      } else {
        toast({
          title: "Couldn't renew this loan",
          description: result.error,
          variant: "destructive",
        });
      }
      setActingOn(null);
    });
  };

  return (
    <div className="mt-5">
      <div className="flex gap-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              filter === tab.value
                ? "bg-primary-admin text-white"
                : "bg-light-300 text-dark-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {!filtered.length ? (
        <p className="mt-10 text-center text-light-500">
          No records in this view.
        </p>
      ) : (
        <div className="mt-5 w-full overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-light-400 text-light-500">
                <th className="py-3 pr-4 font-medium">Book</th>
                <th className="py-3 pr-4 font-medium">Barcode</th>
                <th className="py-3 pr-4 font-medium">Borrowed by</th>
                <th className="py-3 pr-4 font-medium">Staff ID</th>
                <th className="py-3 pr-4 font-medium">Borrowed on</th>
                <th className="py-3 pr-4 font-medium">Due</th>
                <th className="py-3 pr-4 font-medium">Status</th>
                <th className="py-3 pr-4 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((record) => (
                <tr key={record.id} className="border-b border-light-400/60">
                  <td className="py-3 pr-4 font-medium text-dark-400">
                    {record.bookTitle}
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-dark-200">
                    {record.libraryBarcode}
                  </td>
                  <td className="py-3 pr-4 text-dark-200">
                    {record.userFullName}
                  </td>
                  <td className="py-3 pr-4 font-mono text-dark-200">
                    {record.userStaffId}
                  </td>
                  <td className="py-3 pr-4 text-dark-200">
                    {dayjs(record.borrowDate).format("DD MMM YYYY")}
                  </td>
                  <td className="py-3 pr-4 text-dark-200">
                    {dayjs(record.dueDate).format("DD MMM YYYY")}
                  </td>
                  <td className="py-3 pr-4">{statusBadge(record)}</td>
                  <td className="py-3 pr-4">
                    {record.status === "BORROWED" ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending && actingOn === record.id}
                          onClick={() => handleRenew(record.id)}
                        >
                          Renew +7d
                        </Button>
                        <Button
                          size="sm"
                          disabled={isPending && actingOn === record.id}
                          onClick={() => handleReturn(record.id, record.bookId)}
                        >
                          Mark returned
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-light-500">
                        {record.returnDate
                          ? dayjs(record.returnDate).format("DD MMM YYYY")
                          : "-"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BorrowRecordsTable;
