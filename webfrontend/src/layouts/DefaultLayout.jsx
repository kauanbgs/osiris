import { Outlet } from "react-router-dom"
import Sidebar from "@/components/Sidebar"

export default function DefaultLayout() {
  return (
    <div className="flex h-dvh overflow-hidden bg-[#141414]">
      <Sidebar />

      <main className="relative min-w-0 flex-1 overflow-hidden bg-[#141414]">
        <Outlet />
      </main>
    </div>
  )
}