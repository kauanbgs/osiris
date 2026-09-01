import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';

export default function DefaultLayout() {
  return (
    <div className="flex min-h-dvh bg-[#141414]">
      <Sidebar />
      <main className="min-w-0 flex-1 bg-[#141414]">
        <Outlet />
      </main>
    </div>
  );
}
