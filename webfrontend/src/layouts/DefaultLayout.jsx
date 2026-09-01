import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';

export default function DefaultLayout() {
  return (
    <div className="flex h-dvh bg-[#141414] overflow-hidden">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto bg-[#141414]">
        <Outlet />
      </main>
    </div>
  );
}
