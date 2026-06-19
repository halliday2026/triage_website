"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AdminNav({ userEmail }: { userEmail: string | null }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link
            href="/admin/tickets"
            className="flex items-center gap-2 text-lg font-semibold text-gray-900"
          >
            <Image src="/H_Logo.svg" alt="Halliday" width={28} height={28} />
            Triage
          </Link>
          <Link
            href="/admin/tickets"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Tickets
          </Link>
        </div>
        <div className="flex items-center gap-4">
          {userEmail && (
            <span className="text-sm text-gray-500">{userEmail}</span>
          )}
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
