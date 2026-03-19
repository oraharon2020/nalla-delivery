'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
    // Check if admin is authenticated
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken && pathname !== '/admin/login') {
      router.push('/admin/login');
    }
  }, [pathname, router]);

  const menuItems = [
    { href: '/admin', label: 'לוח בקרה', icon: '📊' },
    { href: '/admin/deliveries', label: 'ניהול משלוחים', icon: '📦' },
    { href: '/admin/daily-summary', label: 'סיכום יומי', icon: '📋' },
    { href: '/admin/drivers', label: 'ניהול נהגים', icon: '👤' },
    { href: '/admin/stores', label: 'ניהול חנויות', icon: '🏪' },
    { href: '/admin/reports', label: 'דוחות', icon: '📈' },
    { href: '/admin/tracking', label: 'מעקב נהגים', icon: '📍' },
    { href: '/admin/documents', label: 'תעודות חתומות', icon: '📝' },
    { href: '/admin/push', label: 'התראות Push', icon: '📢' },
    { href: '/admin/admins', label: 'ניהול מנהלים', icon: '🔑' },
    { href: '/admin/settings', label: 'הגדרות', icon: '⚙️' },
  ];

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    router.push('/admin/login');
  };

  if (!isClient) {
    return null;
  }

  // Don't show sidebar on login page
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-gray-100" dir="rtl">
      {/* Sidebar */}
      <aside
        className={`relative bg-gray-800 text-white transition-all duration-300 flex flex-col ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        <div className="p-4">
          <div className="flex items-center justify-between">
            {sidebarOpen && (
              <h1 className="text-xl font-bold">נהגים ולוגיסטיקה</h1>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded hover:bg-gray-700"
            >
              {sidebarOpen ? '◀' : '▶'}
            </button>
          </div>
        </div>

        <nav className="mt-4 flex-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/admin' && pathname?.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-4 py-3 transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                {sidebarOpen && (
                  <span className="mr-3">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className={`flex items-center w-full px-4 py-3 text-red-400 hover:bg-gray-700 hover:text-red-300 transition-colors rounded ${
              sidebarOpen ? '' : 'justify-center'
            }`}
          >
            <span className="text-xl">🚪</span>
            {sidebarOpen && <span className="mr-3">התנתק</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white shadow-sm z-10">
          <div className="flex items-center justify-between px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-800">
              {menuItems.find(item => 
                item.href === pathname || 
                (item.href !== '/admin' && pathname?.startsWith(item.href))
              )?.label || 'לוח בקרה'}
            </h2>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">
                {new Date().toLocaleDateString('he-IL', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
