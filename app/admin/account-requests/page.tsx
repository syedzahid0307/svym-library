import { getPendingUsers } from "@/lib/admin/actions/user";
import AccountRequestsTable from "@/components/admin/AccountRequestsTable";

const Page = async () => {
  const pendingUsers = await getPendingUsers();

  return (
    <section className="w-full rounded-2xl bg-white p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Account Requests</h2>
        <p className="max-w-md text-sm text-light-500">
          New sign-ups wait here until a staff ID is verified against the
          SVYM roster. No photo or document is collected — confirm the
          staff ID matches before approving.
        </p>
      </div>

      <AccountRequestsTable users={pendingUsers} />
    </section>
  );
};

export default Page;
