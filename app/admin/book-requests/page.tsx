import { getBorrowRecords } from "@/lib/admin/actions/borrow";
import BorrowRecordsTable from "@/components/admin/BorrowRecordsTable";

const Page = async () => {
  const records = await getBorrowRecords();

  return (
    <section className="w-full rounded-2xl bg-white p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Borrow Requests</h2>
        <p className="text-sm text-light-500">{records.length} total records</p>
      </div>

      <BorrowRecordsTable records={records} />
    </section>
  );
};

export default Page;
