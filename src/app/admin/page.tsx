'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface DashboardStats {
  todayDeliveries: number;
  pendingDeliveries: number;
  completedToday: number;
  activeDrivers: number;
  activeStores: number;
  onlineDrivers: number;
}

interface RecentDelivery {
  id: string;
  order_number: string;
  customer_name: string;
  status: string;
  delivery_date: string;
  driver_name?: string;
  completed_at?: string;
}

export default function AdminDashboardPage() {
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    todayDeliveries: 0,
    pendingDeliveries: 0,
    completedToday: 0,
    activeDrivers: 0,
    activeStores: 0,
    onlineDrivers: 0,
  });
  const [recentDeliveries, setRecentDeliveries] = useState<RecentDelivery[]>([]);

  useEffect(() => {
    setIsClient(true);
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Get today's deliveries count
      const { count: todayCount } = await supabase
        .from('delivery_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('delivery_date', today);

      // Get pending deliveries count
      const { count: pendingCount } = await supabase
        .from('delivery_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // Get completed today count - use completed_at because each driver has custom completion status
      const { count: completedCount } = await supabase
        .from('delivery_assignments')
        .select('*', { count: 'exact', head: true })
        .eq('delivery_date', today)
        .not('completed_at', 'is', null);

      // Get active drivers count
      const { count: driversCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'driver')
        .eq('is_active', true);

      // Get active stores count
      const { count: storesCount } = await supabase
        .from('stores')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Get online drivers count
      const { count: onlineCount } = await supabase
        .from('driver_locations')
        .select('*', { count: 'exact', head: true })
        .eq('is_online', true);

      setStats({
        todayDeliveries: todayCount || 0,
        pendingDeliveries: pendingCount || 0,
        completedToday: completedCount || 0,
        activeDrivers: driversCount || 0,
        activeStores: storesCount || 0,
        onlineDrivers: onlineCount || 0,
      });

      // Get recent deliveries
      const { data: deliveries } = await supabase
        .from('delivery_assignments')
        .select(`
          id,
          order_number,
          customer_name,
          status,
          delivery_date,
          completed_at,
          driver:users(display_name)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (deliveries) {
        setRecentDeliveries(
          deliveries.map((d: any) => ({
            id: d.id,
            order_number: d.order_number || '-',
            customer_name: d.customer_name || '-',
            status: d.status,
            delivery_date: d.delivery_date,
            driver_name: d.driver?.display_name,
            completed_at: d.completed_at,
          }))
        );
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusLabel = (status: string, completedAt?: string) => {
    const labels: Record<string, { text: string; color: string }> = {
      pending: { text: 'ממתין', color: 'bg-yellow-100 text-yellow-800' },
      in_progress: { text: 'בדרך', color: 'bg-blue-100 text-blue-800' },
      completed: { text: 'הושלם', color: 'bg-green-100 text-green-800' },
      cancelled: { text: 'בוטל', color: 'bg-red-100 text-red-800' },
    };
    if (labels[status]) return labels[status];
    // If delivery has completed_at, it's completed with a custom driver status
    if (completedAt) return { text: 'הושלם', color: 'bg-green-100 text-green-800' };
    return { text: status, color: 'bg-gray-100 text-gray-800' };
  };

  if (!isClient) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <StatCard
          title="משלוחים היום"
          value={stats.todayDeliveries}
          icon="📦"
          color="blue"
        />
        <StatCard
          title="ממתינים לשיוך"
          value={stats.pendingDeliveries}
          icon="⏳"
          color="yellow"
        />
        <StatCard
          title="הושלמו היום"
          value={stats.completedToday}
          icon="✅"
          color="green"
        />
        <StatCard
          title="נהגים פעילים"
          value={stats.activeDrivers}
          icon="👤"
          color="purple"
        />
        <StatCard
          title="נהגים מחוברים"
          value={stats.onlineDrivers}
          icon="📍"
          color="indigo"
        />
        <StatCard
          title="חנויות פעילות"
          value={stats.activeStores}
          icon="🏪"
          color="indigo"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">פעולות מהירות</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Link
            href="/admin/deliveries"
            className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
          >
            <span className="text-2xl">📦</span>
            <span className="font-medium text-blue-700">ניהול משלוחים</span>
          </Link>
          <Link
            href="/admin/drivers"
            className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition"
          >
            <span className="text-2xl">👤</span>
            <span className="font-medium text-purple-700">ניהול נהגים</span>
          </Link>
          <Link
            href="/admin/stores"
            className="flex items-center gap-3 p-4 bg-green-50 rounded-lg hover:bg-green-100 transition"
          >
            <span className="text-2xl">🏪</span>
            <span className="font-medium text-green-700">ניהול חנויות</span>
          </Link>
          <Link
            href="/admin/tracking"
            className="flex items-center gap-3 p-4 bg-cyan-50 rounded-lg hover:bg-cyan-100 transition"
          >
            <span className="text-2xl">📍</span>
            <span className="font-medium text-cyan-700">מעקב נהגים</span>
          </Link>
          <Link
            href="/admin/admins"
            className="flex items-center gap-3 p-4 bg-rose-50 rounded-lg hover:bg-rose-100 transition"
          >
            <span className="text-2xl">🔑</span>
            <span className="font-medium text-rose-700">ניהול מנהלים</span>
          </Link>
          <Link
            href="/admin/reports"
            className="flex items-center gap-3 p-4 bg-orange-50 rounded-lg hover:bg-orange-100 transition"
          >
            <span className="text-2xl">📊</span>
            <span className="font-medium text-orange-700">צפה בדוחות</span>
          </Link>
        </div>
      </div>

      {/* Recent Deliveries */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-800">משלוחים אחרונים</h3>
          <Link
            href="/admin/deliveries"
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            הצג הכל ←
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  מספר הזמנה
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  לקוח
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  נהג
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  תאריך
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  סטטוס
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentDeliveries.map((delivery) => {
                const statusInfo = getStatusLabel(delivery.status, delivery.completed_at);
                return (
                  <tr key={delivery.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{delivery.order_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {delivery.customer_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {delivery.driver_name || 'לא משויך'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(delivery.delivery_date).toLocaleDateString('he-IL')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusInfo.color}`}
                      >
                        {statusInfo.text}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {recentDeliveries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    אין משלוחים להצגה
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  icon: string;
  color: 'blue' | 'yellow' | 'green' | 'purple' | 'indigo';
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    indigo: 'bg-indigo-500',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-800 mt-1">{value}</p>
        </div>
        <div
          className={`w-12 h-12 ${colorClasses[color]} rounded-lg flex items-center justify-center text-2xl`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
