'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { useLoader } from '@/components/ui/Loader';
import { getDeliveries } from '@/utils/api';
import { formatDateForInput, getCurrentUsername, isAuthenticated, getStatusLabel } from '@/utils/helpers';
import { useGpsTracker } from '@/hooks/useGpsTracker';
import PullToRefresh from '@/components/ui/PullToRefresh';
import type { Delivery } from '@/types';

export default function DriverSchedulePage() {
  const router = useRouter();
  
  // Start GPS tracking
  useGpsTracker();
  const { show: showLoader, hide: hideLoader } = useLoader();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [error, setError] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [username, setUsername] = useState('');

  // Set initial date on client side only
  useEffect(() => {
    setIsClient(true);
    setSelectedDate(formatDateForInput());
    setUsername(getCurrentUsername());
  }, []);

  useEffect(() => {
    if (!isClient) return;
    
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    
    if (selectedDate) {
      loadSchedule();
    }
  }, [selectedDate, router, isClient]);

  const loadSchedule = async () => {
    try {
      showLoader('טוען משלוחים...');
      setError('');

      const response = await getDeliveries(selectedDate);

      if (response.success && response.data) {
        setDeliveries(response.data);
      } else {
        throw new Error(response.message || 'שגיאה בטעינת המשלוחים');
      }
    } catch (err) {
      console.error('Error loading schedule:', err);
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת הנתונים');
    } finally {
      hideLoader();
    }
  };

  const getStatusDisplay = (status: string, completedAt?: string | null) => {
    const statusLower = status?.toLowerCase() || '';

    if (statusLower.includes('done') || completedAt) {
      return { text: getStatusLabel(status), className: 'status-completed' };
    } else if (statusLower === 'cancelled') {
      return { text: 'בוטל', className: 'status-cancelled' };
    }

    return { text: 'בהמתנה לתיאום', className: 'status-pending' };
  };

  const handleRowClick = (orderId: string, storeId: string) => {
    router.push(`/order-details?id=${orderId}&store=${storeId}`);
  };

  return (
    <PullToRefresh onRefresh={loadSchedule}>
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                יומן משלוחים
              </h1>
              <div className="text-sm sm:text-lg text-gray-600">
                שלום {username}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full sm:w-auto rounded-lg border border-gray-300 p-2 shadow-sm"
              />
              <button
                onClick={loadSchedule}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                רענן
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:p-6">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      מס׳
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      מספר הזמנה
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      פרטי משלוח
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      זמן משלוח
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      מוצרים
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      סטטוס
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {error ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-4 text-center text-red-500"
                      >
                        {error}
                      </td>
                    </tr>
                  ) : deliveries.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-4 text-center text-gray-500"
                      >
                        לא נמצאו משלוחים לתאריך זה
                      </td>
                    </tr>
                  ) : (
                    deliveries.map((delivery, index) => {
                      const statusDisplay = getStatusDisplay(delivery.status, delivery.completed_at);
                      return (
                        <tr
                          key={delivery.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() =>
                            handleRowClick(delivery.order_id, delivery.store_id)
                          }
                        >
                          <td className="px-6 py-4 text-sm text-gray-900 text-center">
                            {index + 1}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm text-gray-900">
                                #{delivery.order_number}
                              </div>
                              <div className="text-sm text-red-600">
                                {delivery.store_name}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="font-medium mb-1">
                              {delivery.customer_name}
                            </div>
                            <div className="text-gray-600">
                              {delivery.shipping_address}
                            </div>
                            <div className="text-gray-500">{delivery.phone}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {delivery.time_slot}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="font-medium">
                              סה״כ: {delivery.total_items} פריטים
                            </div>
                            <ul className="list-disc list-inside mt-1">
                              {delivery.products.map((product, i) => (
                                <li key={i} className="text-gray-600">
                                  {product.name} x {product.quantity}
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`status-badge ${statusDisplay.className}`}
                            >
                              {statusDisplay.text}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
    </PullToRefresh>
  );
}
