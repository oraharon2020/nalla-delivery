'use client';

import { useState, useEffect } from 'react';
import { supabase, User, DeliveryAssignment } from '@/lib/supabase';

interface ReportData {
  date: string;
  deliveries: number;
  completed: number;
  earnings: number;
}

interface DriverReport {
  driver: User;
  totalDeliveries: number;
  completedDeliveries: number;
  totalEarnings: number;
  dailyData: ReportData[];
}

export default function ReportsPage() {
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<User[]>([]);
  
  // Filters
  const [selectedDriver, setSelectedDriver] = useState<string>('');
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  
  // Report data
  const [report, setReport] = useState<DriverReport | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  useEffect(() => {
    setIsClient(true);
    loadDrivers();
  }, []);

  const loadDrivers = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'driver')
        .eq('is_active', true)
        .order('display_name');
      
      if (data) {
        setDrivers(data);
        if (data.length > 0) {
          setSelectedDriver(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading drivers:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    if (!selectedDriver || !dateFrom || !dateTo) {
      alert('יש לבחור נהג ותאריכים');
      return;
    }

    setGeneratingReport(true);

    try {
      const driver = drivers.find(d => d.id === selectedDriver);
      if (!driver) return;

      // Get deliveries for the period
      const { data: deliveries } = await supabase
        .from('delivery_assignments')
        .select('*')
        .eq('driver_id', selectedDriver)
        .gte('delivery_date', dateFrom)
        .lte('delivery_date', dateTo)
        .order('delivery_date');

      if (!deliveries) {
        setReport(null);
        return;
      }

      // Group by date
      const dailyMap = new Map<string, ReportData>();
      
      deliveries.forEach(delivery => {
        const date = delivery.delivery_date;
        const existing = dailyMap.get(date) || {
          date,
          deliveries: 0,
          completed: 0,
          earnings: 0,
        };
        
        existing.deliveries++;
        // Count as completed if has completed_at timestamp OR status is 'completed'
        const isCompleted = delivery.completed_at || delivery.status === 'completed';
        if (isCompleted) {
          existing.completed++;
          const cost = typeof delivery.delivery_cost === 'number' 
            ? delivery.delivery_cost 
            : parseFloat(String(delivery.delivery_cost)) || 0;
          existing.earnings += cost;
        }
        
        dailyMap.set(date, existing);
      });

      const dailyData = Array.from(dailyMap.values()).sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const totalDeliveries = deliveries.length;
      const completedDeliveries = deliveries.filter(d => d.completed_at || d.status === 'completed').length;
      const totalEarnings = deliveries
        .filter(d => d.completed_at || d.status === 'completed')
        .reduce((sum, d) => {
          const cost = typeof d.delivery_cost === 'number' 
            ? d.delivery_cost 
            : parseFloat(String(d.delivery_cost)) || 0;
          return sum + cost;
        }, 0);

      setReport({
        driver,
        totalDeliveries,
        completedDeliveries,
        totalEarnings,
        dailyData,
      });
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setGeneratingReport(false);
    }
  };

  const downloadPDF = async () => {
    if (!report) return;
    
    // For now, we'll create a simple print version
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>דוח נהג - ${report.driver.display_name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #1e40af; }
          .summary { display: flex; gap: 20px; margin: 20px 0; }
          .summary-item { background: #f3f4f6; padding: 15px; border-radius: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
          th { background: #f3f4f6; }
        </style>
      </head>
      <body>
        <h1>דוח נהג - ${report.driver.display_name}</h1>
        <p>תאריכים: ${dateFrom} - ${dateTo}</p>
        
        <div class="summary">
          <div class="summary-item">
            <strong>סה"כ משלוחים:</strong> ${report.totalDeliveries}
          </div>
          <div class="summary-item">
            <strong>הושלמו:</strong> ${report.completedDeliveries}
          </div>
          <div class="summary-item">
            <strong>סה"כ רווח:</strong> ₪${report.totalEarnings.toFixed(2)}
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>תאריך</th>
              <th>משלוחים</th>
              <th>הושלמו</th>
              <th>רווח</th>
            </tr>
          </thead>
          <tbody>
            ${report.dailyData.map(day => `
              <tr>
                <td>${new Date(day.date).toLocaleDateString('he-IL')}</td>
                <td>${day.deliveries}</td>
                <td>${day.completed}</td>
                <td>₪${day.earnings.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  if (!isClient) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">דוחות נהגים</h2>
        
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              בחר נהג
            </label>
            <select
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {drivers.map(driver => (
                <option key={driver.id} value={driver.id}>
                  {driver.display_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              מתאריך
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              עד תאריך
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={generateReport}
            disabled={generatingReport}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
          >
            {generatingReport ? 'מפיק דוח...' : 'הפק דוח'}
          </button>
        </div>
      </div>

      {/* Report Results */}
      {report && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Report Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <h3 className="text-lg font-semibold">
              דוח נהג: {report.driver.display_name}
            </h3>
            <button
              onClick={downloadPDF}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              📥 הורד PDF
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 bg-gray-50">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-500">סה"כ משלוחים</p>
              <p className="text-2xl font-bold text-gray-800">{report.totalDeliveries}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-500">הושלמו</p>
              <p className="text-2xl font-bold text-green-600">{report.completedDeliveries}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-500">סה"כ רווח</p>
              <p className="text-2xl font-bold text-blue-600">₪{report.totalEarnings.toFixed(2)}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-500">ממוצע ליום</p>
              <p className="text-2xl font-bold text-purple-600">
                {report.dailyData.length > 0 
                  ? (report.totalDeliveries / report.dailyData.length).toFixed(1)
                  : '0'}
              </p>
            </div>
          </div>

          {/* Daily Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    תאריך
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    משלוחים
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    הושלמו
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    רווח
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.dailyData.map(day => (
                  <tr key={day.date} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      {new Date(day.date).toLocaleDateString('he-IL', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 text-center">{day.deliveries}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-sm ${
                        day.completed === day.deliveries
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {day.completed}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-medium">
                      ₪{day.earnings.toFixed(2)}
                    </td>
                  </tr>
                ))}
                {report.dailyData.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                      אין נתונים לתקופה זו
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
