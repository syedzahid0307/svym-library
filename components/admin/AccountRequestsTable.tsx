"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { approveUser, rejectUser } from "@/lib/admin/actions/user";
import { toast } from "@/hooks/use-toast";

const memberTypeLabel: Record<string, string> = {
  STAFF: "Staff",
  VOLUNTEER: "Volunteer",
  COMMUNITY: "Community member",
};

const AccountRequestsTable = ({ users }: { users: AdminUser[] }) => {
  const [list, setList] = useState(users);
  const [isPending, startTransition] = useTransition();
  const [actingOn, setActingOn] = useState<string | null>(null);

  const handleDecision = (id: string, decision: "approve" | "reject") => {
    setActingOn(id);
    startTransition(async () => {
      const result =
        decision === "approve" ? await approveUser(id) : await rejectUser(id);

      if (result.success) {
        setList((prev) => prev.filter((u) => u.id !== id));
        toast({
          title: decision === "approve" ? "Account approved" : "Account rejected",
        });
      } else {
        toast({
          title: "Something went wrong",
          description: result.error,
          variant: "destructive",
        });
      }
      setActingOn(null);
    });
  };

  if (!list.length) {
    return (
      <p className="mt-10 text-center text-light-500">
        No pending account requests right now.
      </p>
    );
  }

  return (
    <div className="mt-7 w-full overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-light-400 text-light-500">
            <th className="py-3 pr-4 font-medium">Name</th>
            <th className="py-3 pr-4 font-medium">Email</th>
            <th className="py-3 pr-4 font-medium">Staff ID</th>
            <th className="py-3 pr-4 font-medium">Type</th>
            <th className="py-3 pr-4 font-medium">Requested</th>
            <th className="py-3 pr-4 font-medium">Action</th>
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
              <td className="py-3 pr-4 text-dark-200">
                {memberTypeLabel[user.memberType] ?? user.memberType}
              </td>
              <td className="py-3 pr-4 text-dark-200">
                {user.createdAt
                  ? new Date(user.createdAt).toLocaleDateString()
                  : "-"}
              </td>
              <td className="py-3 pr-4">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={isPending && actingOn === user.id}
                    className="confirm-approve"
                    onClick={() => handleDecision(user.id, "approve")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending && actingOn === user.id}
                    className="confirm-reject"
                    onClick={() => handleDecision(user.id, "reject")}
                  >
                    Reject
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AccountRequestsTable;
