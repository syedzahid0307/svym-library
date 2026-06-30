import { getAllUsers } from "@/lib/admin/actions/user";
import UsersTable from "@/components/admin/UsersTable";

const Page = async () => {
  const allUsers = await getAllUsers();

  return (
    <section className="w-full rounded-2xl bg-white p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">All Users</h2>
        <p className="text-sm text-light-500">{allUsers.length} members</p>
      </div>

      <UsersTable users={allUsers} />
    </section>
  );
};

export default Page;
