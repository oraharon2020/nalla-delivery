'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface ActivityLog {
  id: string;
  driver_id: string;
  driver_name: string;
  action: string;
  order_id: string | null;
  order_number: string | null;
  store_id: string | null;
  details: Record<string, any>;
  created_at: string;
}

interface DriverSummary {
  driver_id: string;
  driver_name: string;
  totalDeliveries: number;
  completedDeliveries: number;
  statusChanges: number;
  notesAdded: number;
  filesUploaded: number;
  loginTime: string | null;
  activities: ActivityLog[];
}

const ACTION_LABELS: Record<string, { text: string; icon: string; color: string }> = {
  status_change: { text: 'שינוי סטטוס', icon: '🔄', color: 'text-blue-600' },
  note_added: { text: 'הוספת הערה', icon: '💬', color: 'text-green-600' },
  file_uploaded: { text: 'העלאת קובץ', icon: '📎', color: 'text-purple-600' },
  login: { text: 'התחברות', icon: '🔑', color: 'text-gray-600' },
};

export default function DailySummaryPage() {
  const [isClient, setIsClient] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [driverSummaries, setDriverSummaries] = useState<DriverSummary[]>([]);
  const [allActivities, setAllActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'summary' | 'timeline'>('summary');
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) loadData();
  }, [selectedDate, isClient]);

  const loadData = async () => {
    setLoading(true);
    try {
      const startOfDay = `${selectedDate}T00:00:00.000Z`;
      const endOfDay = `${selectedDate}T23:59:59.999Z`;

      // Fetch activity logs for the day
      const { data: logs } = await supabase
        .from('activity_logs')
        .select('*')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .order('created_at', { ascending: false });

      const activities = (logs || []) as ActivityLog[];
      setAllActivities(activities);

      // Fetch deliveries for the day (for delivery counts)
      const { data: deliveries } = await supabase
        .from('delivery_assignments')
        .select('driver_id, status, completed_at, driver:users(display_name)')
        .eq('delivery_date', selectedDate);

      // Build per-driver summaries
      const driverMap = new Map<string, DriverSummary>();

      // Add delivery data
      (deliveries || []).forEach((d: any) => {
        const dId = d.driver_id;
        if (!dId) return;
        if (!driverMap.has(dId)) {
          driverMap.set(dId, {
            driver_id: dId,
            driver_name: d.driver?.display_name || 'לא ידוע',
            totalDeliveries: 0,
            completedDeliveries: 0,
            statusChanges: 0,
            notesAdded: 0,
            filesUploaded: 0,
            loginTime: null,
            activities: [],
          });
        }
        const summary = driverMap.get(dId)!;
        summary.totalDeliveries++;
        if (d.completed_at) summary.completedDeliveries++;
      });

      // Add activity data
      activities.forEach((a) => {
        if (!driverMap.has(a.driver_id)) {
          driverMap.set(a.driver_id, {
            driver_id: a.driver_id,
            driver_name: a.driver_name,
            totalDeliveries: 0,
            completedDeliveries: 0,
            statusChanges: 0,
            notesAdded: 0,
            filesUploaded: 0,
            loginTime: null,
            activities: [],
          });
        }
        const summary = driverMap.get(a.driver_id)!;
        summary.activities.push(a);

        switch (a.action) {
          case 'status_change': summary.statusChanges++; break;
          case 'note_added': summary.notesAdded++; break;
          case 'file_uploaded': summary.filesUploaded++; break;
          case 'login':
            if (!summary.loginTime || a.created_at < summary.loginTime) {
              summary.loginTime = a.created_at;
            }
            break;
        }
      });

      setDriverSummaries(
        Array.from(driverMap.values()).sort((a, b) => b.totalDeliveries - a.totalDeliveries)
      );
    } catch (error) {
      console.error('Error loading daily summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const navigateDate = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateHebrew = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('he-IL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  if (!isClient) return null;

  // Totals
  const totalDeliveries = driverSummaries.reduce((s, d) => s + d.totalDeliveries, 0);
  const totalCompleted = driverSummaries.reduce((s, d) => s + d.completedDeliveries, 0);
  const totalActions = allActivities.length;

  return (
    <div className="space-y-6">
      {/* Header with Date Navigation */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">סיכום יומי</h2>
            <p className="text-gray-500 mt-1">{formatDateHebrew(selectedDate)}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigateDate(-1)}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition"
            >
              →
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border rounded-lg text-center"
            />
            <button
              onClick={() => navigateDate(1)}
              disabled={isToday}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition disabled:opacity-30"
            >
              ←
            </button>
            {!isToday && (
              <button
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
              >
                היום
              </button>
            )}
          </div>

          {/* View Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView('summary')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                view === 'summary' ? 'bg-white shadow text-blue-600' : 'text-gray-600'
              }`}
            >
              סיכום נהגים
            </button>
            <button
              onClick={() => setView('timeline')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                view === 'timeline' ? 'bg-white shadow text-blue-600' : 'text-gray-600'
              }`}
            >
              ציר זמן
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-3xl font-bold text-blue-600">{totalDeliveries}</div>
          <div className="text-sm text-gray-500 mt-1">משלוחים</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{totalCompleted}</div>
          <div className="text-sm text-gray-500 mt-1">הושלמו</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-3xl font-bold text-purple-600">{totalActions}</div>
          <div className="text-sm text-gray-500 mt-1">פעולות</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <div className="text-3xl font-bold text-orange-600">{driverSummaries.length}</div>
          <div className="text-sm text-gray-500 mt-1">נהגים פעילים</div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      ) : view === 'summary' ? (
        /* Driver Summary Cards */
        <div className="space-y-4">
          {driverSummaries.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center text-gray-400">
              <div className="text-4xl mb-4">📭</div>
              <p>אין פעילות ביום הזה</p>
            </div>
          ) : (
            driverSummaries.map((driver) => (
              <div key={driver.driver_id} className="bg-white rounded-lg shadow overflow-hidden">
                {/* Driver Header */}
                <button
                  onClick={() =>
                    setExpandedDriver(
                      expandedDriver === driver.driver_id ? null : driver.driver_id
                    )
                  }
                  className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-xl">
                      👤
                    </div>
                    <div className="text-right">
                      <h3 className="text-lg font-bold text-gray-800">
                        {driver.driver_name}
                      </h3>
                      {driver.loginTime && (
                        <p className="text-sm text-gray-400">
                          התחבר ב-{formatTime(driver.loginTime)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-600">
                        {driver.completedDeliveries}/{driver.totalDeliveries}
                      </div>
                      <div className="text-xs text-gray-400">משלוחים</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">
                        {driver.statusChanges}
                      </div>
                      <div className="text-xs text-gray-400">סטטוסים</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-purple-600">
                        {driver.notesAdded}
                      </div>
                      <div className="text-xs text-gray-400">הערות</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold text-orange-600">
                        {driver.filesUploaded}
                      </div>
                      <div className="text-xs text-gray-400">קבצים</div>
                    </div>
                    <span className="text-gray-400 text-xl">
                      {expandedDriver === driver.driver_id ? '▲' : '▼'}
                    </span>
                  </div>
                </button>

                {/* Expanded Activity List */}
                {expandedDriver === driver.driver_id && (
                  <div className="border-t bg-gray-50 divide-y divide-gray-100">
                    {driver.activities.length === 0 ? (
                      <div className="p-4 text-center text-gray-400 text-sm">
                        אין פעולות מתועדות
                      </div>
                    ) : (
                      driver.activities.map((activity) => {
                        const actionInfo =
                          ACTION_LABELS[activity.action] || {
                            text: activity.action,
                            icon: '❓',
                            color: 'text-gray-600',
                          };
                        return (
                          <div
                            key={activity.id}
                            className="px-6 py-3 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-lg">{actionInfo.icon}</span>
                              <div>
                                <span className={`font-medium ${actionInfo.color}`}>
                                  {actionInfo.text}
                                </span>
                                {activity.order_id && (
                                  <span className="text-gray-400 text-sm mr-2">
                                    הזמנה #{activity.order_id}
                                  </span>
                                )}
                                {activity.details?.to_status && (
                                  <span className="text-gray-500 text-sm mr-2">
                                    → {activity.details.to_status}
                                  </span>
                                )}
                                {activity.details?.note_text && (
                                  <span className="text-gray-500 text-sm block mt-0.5">
                                    &quot;{activity.details.note_text}&quot;
                                  </span>
                                )}
                                {activity.details?.file_name && (
                                  <span className="text-gray-500 text-sm mr-2">
                                    {activity.details.file_name}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-sm text-gray-400 whitespace-nowrap">
                              {formatTime(activity.created_at)}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        /* Timeline View */
        <div className="bg-white rounded-lg shadow p-6">
          {allActivities.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <div className="text-4xl mb-4">📭</div>
              <p>אין פעילות ביום הזה</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute right-5 top-0 bottom-0 w-0.5 bg-gray-200"></div>

              <div className="space-y-4">
                {allActivities.map((activity) => {
                  const actionInfo =
                    ACTION_LABELS[activity.action] || {
                      text: activity.action,
                      icon: '❓',
                      color: 'text-gray-600',
                    };
                  return (
                    <div key={activity.id} className="flex items-start gap-4 relative">
                      <div className="flex-shrink-0 w-10 h-10 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center z-10">
                        <span>{actionInfo.icon}</span>
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-gray-800">
                              {activity.driver_name}
                            </span>
                            <span className={`mr-2 ${actionInfo.color}`}>
                              {actionInfo.text}
                            </span>
                            {activity.order_id && (
                              <span className="text-gray-400 text-sm">
                                — הזמנה #{activity.order_id}
                              </span>
                            )}
                          </div>
                          <span className="text-sm text-gray-400">
                            {formatTime(activity.created_at)}
                          </span>
                        </div>
                        {activity.details?.to_status && (
                          <p className="text-sm text-gray-500 mt-1">
                            שינוי סטטוס{' '}
                            {activity.details.from_status && (
                              <span>מ-{activity.details.from_status} </span>
                            )}
                            ל-{activity.details.to_status}
                          </p>
                        )}
                        {activity.details?.note_text && (
                          <p className="text-sm text-gray-500 mt-1">
                            &quot;{activity.details.note_text}&quot;
                          </p>
                        )}
                        {activity.details?.file_name && (
                          <p className="text-sm text-gray-500 mt-1">
                            📎 {activity.details.file_name}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
