"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Home,
  Package,
  ChefHat,
  PackageCheck,
  Settings,
  ShoppingCart,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const APP_NAME = "CalculaChef";

const navItems = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/insumos", label: "Insumos", icon: Package },
  { href: "/recetas", label: "Recetas", icon: ChefHat },
  { href: "/inventario-compras", label: "Inventario y compras", icon: PackageCheck },
  { href: "/configuracion", label: "Configuración", icon: Settings },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userEmail = session?.user?.email ?? "";
  const userName =
    (session?.user?.name && String(session.user.name).trim()) ||
    (userEmail ? userEmail.split("@")[0] : "Usuario");

  return (
    <Sidebar collapsible="none" className="border-r border-sidebar-border h-[100vh]" >
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2">
          <span className="font-semibold text-sidebar-foreground tracking-tight">
            {APP_NAME}
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.href}>
                        <Icon className="size-4 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/caja" || pathname.startsWith("/caja/")}>
                  <Link href="/caja">
                    <ShoppingCart className="size-4 shrink-0" />
                    <span>Caja</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex flex-col gap-1 p-2">
          <p className="truncate px-2 text-xs text-muted-foreground">
            <span className="font-medium text-sidebar-foreground">{userName}</span>
          </p>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className={cn(
              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              "flex w-full items-center gap-2 rounded-md p-2 text-left text-sm outline-hidden transition-colors"
            )}
          >
            Cerrar sesión
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
