import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-admin-background text-slate-200 font-display">
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <main className="flex-1 overflow-y-auto relative">
        <AdminHeader onMenuClick={() => setSidebarOpen(true)} />
        
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
          <Outlet />
        </div>

        {/* Footer */}
        <div className="border-t border-admin-border py-6 px-4 md:px-8 mt-8 flex flex-col sm:flex-row justify-between items-center text-slate-500 text-xs gap-4">
          <p>© {new Date().getFullYear()} AI Nexus Platform. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-slate-300">System Status</a>
            <a href="#" className="hover:text-slate-300">Documentation</a>
            <a href="#" className="hover:text-slate-300">Support</a>
          </div>
        </div>
      </main>
    </div>
  );
}
