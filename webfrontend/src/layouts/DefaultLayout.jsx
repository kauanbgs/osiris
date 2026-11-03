import { Outlet } from "react-router-dom"
import Sidebar from "@/components/Sidebar"

export default function DefaultLayout() {
  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <Sidebar />

      <main className="relative min-w-0 flex-1 overflow-hidden bg-background">
        <Outlet />
      </main>
    </div>
  )
}