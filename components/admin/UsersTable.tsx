"use client";

import { useState, useTransition } from "react";
import { updateUserRole, updateMemberType } from "@/lib/admin/actions/user";
import { toast } from "@/hooks/use-toast";
import { userRoles } from "@/constants";

const statusStyles: Record<string, string> = {
  APPROVED: "bg-green-100 text-green-800",
  PENDING: "bg-[#FFF8E6] text-[#B25E09]",
  REJECTED: "bg-red-100 text-red-800",
};

const memberTypeOptions = ["STAFF", "VOLUNTEER", "COMMUNITY"];

const selectClass =
  "h-8 rounded-md border border-gray-100 bg-white px-2 text-xs text-dark-400 outline-none";

const UsersTable = ({ users }: { users: AdminUser[] }) => {
  const [list, setList] = useState(users);
  const [, startTransition] = useTransition();

  const handleRoleChange = (id: string, role: "USER" | "STAFF" | "ADMIN") => {
    setList((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));

    startTransition(async () => {
      const result = await updateUserRole(id, role);
      if (!result.success) {
        toast({
          title: "Couldn't update role",
          description: result.error,
          variant: "destructive",
        });
      }
    });
  };

  const handleTypeChange = (id: string, memberType: string) => {
    setList((prev) =>
      prev.map((u) => (u.id === id ? { ...u, memberType } : u)),
    );

    startTransition(async () => {
      const result = await updateMemberType(id, memberType);
      if (!result.success) {
        toast({
          title: "Couldn't update member type",
          description: result.error,
          variant: "destructive",
        });
      }
    });
  };

  return (
    <div className="mt-7 w-full overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-light-400 text-light-500">
            <th className="py-3 pr-4 font-medium">Name</th>
            <th className="py-3 pr-4 font-medium">Email</th>
            <th className="py-3 pr-4 font-medium">Staff ID</th>
            <th className="py-3 pr-4 font-medium">Status</th>
            <th className="py-3 pr-4 font-medium">Member type</th>
            <th className="py-3 pr-4 font-medium">Role</th>
          </tr>
        </thead>
        <tbody>
          {list.map((user) => (
            <tr key={user.id} className="border-b border-light-400/60">
              <td className="py-3 pr-4 font-medium text-dark-400">
                {user.fullName}
              </td>
              <td className="py-3 pr-4 text-dark-200">{user.email}</td>
              <td className="py-3 pr-4 font-mono text-dark-200">
                {user.staffId}
              </td>
              <td className="py-3 pr-4">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    statusStyles[user.status ?? "PENDING"]
                  }`}
                >
                  {user.status}
                </span>
              </td>
              <td className="py-3 pr-4">
                <select
                  className={selectClass}
                  value={user.memberType}
                  onChange={(e) => handleTypeChange(user.id, e.target.value)}
                >
                  {memberTypeOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt.charAt(0) + opt.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </td>
              <td className="py-3 pr-4">
                <select
                  className={selectClass}
                  value={user.role ?? "USER"}
                  onChange={(e) =>
                    handleRoleChange(
                      user.id,
                      e.target.value as "USER" | "STAFF" | "ADMIN",
                    )
                  }
                >
                  {userRoles.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UsersTable;
