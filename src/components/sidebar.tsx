"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Users, CalendarDays, Settings, LayoutDashboard, LogIn, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const navItems = [
    { name: "Attendance", href: "/", icon: LayoutDashboard, requiresAuth: false },
    { name: "Students", href: "/students", icon: Users, requiresAuth: true },
    { name: "Settings", href: "/settings", icon: Settings, requiresAuth: true },
  ].filter(item => !item.requiresAuth || user);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    router.push("/");
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="w-64 bg-white border-r h-full shadow-sm hidden md:flex flex-col">
        <div className="h-16 flex items-center px-6 border-b">
          <CalendarDays className="w-6 h-6 mr-3 text-indigo-600" />
          <h1 className="text-xl font-bold text-slate-800">MAASA</h1>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <item.icon
                  className={cn(
                    "w-5 h-5 mr-3 flex-shrink-0",
                    isActive ? "text-indigo-600" : "text-slate-400"
                  )}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t">
          {user && (
            <button
              onClick={handleLogout}
              className="flex w-full items-center px-3 py-2.5 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-5 h-5 mr-3 flex-shrink-0" />
              Logout
            </button>
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50">
        <nav className="flex justify-around items-center h-16 pb-safe">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                  isActive ? "text-indigo-600" : "text-slate-500"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive ? "fill-indigo-100" : "")} />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}
          
          {user && (
            <button
              onClick={handleLogout}
              className="flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors text-red-500"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-[10px] font-medium">Logout</span>
            </button>
          )}
        </nav>
      </div>
    </>
  );
}
