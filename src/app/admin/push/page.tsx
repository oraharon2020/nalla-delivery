'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface NotificationLog {
  id: string;
  title: string;
  body: string;
  target: string;
  sent_count: number;
  failed_count: number;
  created_at: string;
}

interface ScheduledNotification {
  id: string;
  name: string;
  title: string;
  body: string;
  target: string;
  url: string | null;
  schedule_type: 'daily' | 'weekly' | 'one_time';
  schedule_time: string;
  schedule_days: number[];
  one_time_date: string | null;
  is_active: boolean;
  last_sent_at: string | null;
  created_at: string;
}

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const targetLabels: Record<string, string> = {
  all: 'כולם',
  drivers: 'נהגים בלבד',
  admins: 'מנהלים בלבד',
};

export default function PushNotificationsPage() {
  const [activeTab, setActiveTab] = useState<'send' | 'scheduled' | 'history'>('send');
  
  // Send now state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState('all');
  const [url, setUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  
  // History state
  const [history, setHistory] = useState<NotificationLog[]>([]);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Scheduled state
  const [schedules, setSchedules] = useState<ScheduledNotification[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [schedName, setSchedName] = useState('');
  const [schedTitle, setSchedTitle] = useState('');
  const [schedBody, setSchedBody] = useState('');
  const [schedTarget, setSchedTarget] = useState('all');
  const [schedUrl, setSchedUrl] = useState('');
  const [schedType, setSchedType] = useState<'daily' | 'weekly' | 'one_time'>('daily');
  const [schedTime, setSchedTime] = useState('08:00');
  const [schedDays, setSchedDays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [schedDate, setSchedDate] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);

  useEffect(() => {
    loadHistory();
    loadSchedules();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await fetch('/api/push/send');
      const data = await res.json();
      setHistory(data.notifications || []);
      setSubscriberCount(data.subscriberCount || 0);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSchedules = async () => {
    const { data } = await supabase
      .from('scheduled_notifications')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setSchedules(data);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    setSending(true);
    setResult(null);

    try {
      const adminToken = localStorage.getItem('adminToken');
      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ title, body, target, url: url || undefined }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setResult({ sent: data.sent, failed: data.failed, total: data.total });
      setTitle('');
      setBody('');
      setUrl('');
      loadHistory();
    } catch (err) {
      console.error('Send failed:', err);
      setResult({ sent: 0, failed: 1, total: 0 });
    } finally {
      setSending(false);
    }
  };

  const resetScheduleForm = () => {
    setEditingId(null);
    setSchedName('');
    setSchedTitle('');
    setSchedBody('');
    setSchedTarget('all');
    setSchedUrl('');
    setSchedType('daily');
    setSchedTime('08:00');
    setSchedDays([0, 1, 2, 3, 4]);
    setSchedDate('');
  };

  const editSchedule = (s: ScheduledNotification) => {
    setEditingId(s.id);
    setSchedName(s.name);
    setSchedTitle(s.title);
    setSchedBody(s.body);
    setSchedTarget(s.target);
    setSchedUrl(s.url || '');
    setSchedType(s.schedule_type);
    setSchedTime(s.schedule_time.slice(0, 5));
    setSchedDays(s.schedule_days || []);
    setSchedDate(s.one_time_date || '');
    setShowForm(true);
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedName.trim() || !schedTitle.trim() || !schedBody.trim()) return;

    setSavingSchedule(true);

    const data = {
      name: schedName,
      title: schedTitle,
      body: schedBody,
      target: schedTarget,
      url: schedUrl || null,
      schedule_type: schedType,
      schedule_time: schedTime,
      schedule_days: schedType === 'weekly' ? schedDays : [],
      one_time_date: schedType === 'one_time' ? schedDate : null,
      is_active: true,
    };

    if (editingId) {
      await supabase.from('scheduled_notifications').update(data).eq('id', editingId);
    } else {
      await supabase.from('scheduled_notifications').insert(data);
    }

    resetScheduleForm();
    setShowForm(false);
    setSavingSchedule(false);
    loadSchedules();
  };

  const toggleScheduleActive = async (id: string, currentState: boolean) => {
    await supabase.from('scheduled_notifications').update({ is_active: !currentState }).eq('id', id);
    loadSchedules();
  };

  const deleteSchedule = async (id: string) => {
    if (!confirm('למחוק את התבנית?')) return;
    await supabase.from('scheduled_notifications').delete().eq('id', id);
    loadSchedules();
  };

  const toggleDay = (day: number) => {
    setSchedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto" dir="rtl">
      <h1 className="text-2xl font-bold mb-6">📢 התראות Push</h1>

      {/* Stats */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center gap-4">
        <span className="text-3xl">📱</span>
        <div>
          <p className="text-lg font-semibold text-blue-800">{subscriberCount} מנויים רשומים</p>
          <p className="text-sm text-blue-600">משתמשים שהתקינו את האפליקציה ואישרו התראות</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        {[
          { key: 'send' as const, label: '📤 שליחה ידנית' },
          { key: 'scheduled' as const, label: '⏰ תבניות אוטומטיות' },
          { key: 'history' as const, label: '📋 היסטוריה' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-3 font-medium text-sm transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Send Now */}
      {activeTab === 'send' && (
        <form onSubmit={handleSend} className="bg-white rounded-lg shadow p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">קהל יעד</label>
              <select value={target} onChange={(e) => setTarget(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                <option value="all">כולם (נהגים + מנהלים)</option>
                <option value="drivers">נהגים בלבד</option>
                <option value="admins">מנהלים בלבד</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">כותרת *</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="למשל: עדכון חשוב" className="w-full border rounded-lg px-3 py-2" required maxLength={100} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">תוכן ההודעה *</label>
              <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="הקלד את תוכן ההודעה..." rows={3} className="w-full border rounded-lg px-3 py-2" required maxLength={500} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">קישור (אופציונלי)</label>
              <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/driver-schedule" className="w-full border rounded-lg px-3 py-2" dir="ltr" />
            </div>
            <button type="submit" disabled={sending || !title.trim() || !body.trim()} className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors">
              {sending ? '⏳ שולח...' : `📤 שלח התראה ל${targetLabels[target]}`}
            </button>
          </div>
          {result && (
            <div className={`mt-4 p-4 rounded-lg ${result.sent > 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              {result.sent > 0 ? (
                <p className="text-green-800">✅ נשלח ל-{result.sent} מתוך {result.total} מנויים</p>
              ) : (
                <p className="text-red-800">❌ השליחה נכשלה</p>
              )}
            </div>
          )}
        </form>
      )}

      {/* Tab: Scheduled Templates */}
      {activeTab === 'scheduled' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">תבניות מתוזמנות</h2>
            <button
              onClick={() => { resetScheduleForm(); setShowForm(true); }}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm"
            >
              + תבנית חדשה
            </button>
          </div>

          {/* Schedule Form */}
          {showForm && (
            <form onSubmit={handleSaveSchedule} className="bg-white rounded-lg shadow p-6 mb-6 border-2 border-blue-200">
              <h3 className="font-semibold mb-4">{editingId ? 'עריכת תבנית' : 'תבנית חדשה'}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">שם התבנית *</label>
                  <input type="text" value={schedName} onChange={(e) => setSchedName(e.target.value)} placeholder="למשל: תזכורת בוקר לנהגים" className="w-full border rounded-lg px-3 py-2" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">כותרת ההתראה *</label>
                    <input type="text" value={schedTitle} onChange={(e) => setSchedTitle(e.target.value)} placeholder="בוקר טוב!" className="w-full border rounded-lg px-3 py-2" required maxLength={100} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">קהל יעד</label>
                    <select value={schedTarget} onChange={(e) => setSchedTarget(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                      <option value="all">כולם</option>
                      <option value="drivers">נהגים</option>
                      <option value="admins">מנהלים</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">תוכן ההודעה *</label>
                  <textarea value={schedBody} onChange={(e) => setSchedBody(e.target.value)} placeholder="תוכן ההתראה..." rows={2} className="w-full border rounded-lg px-3 py-2" required maxLength={500} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">קישור (אופציונלי)</label>
                  <input type="text" value={schedUrl} onChange={(e) => setSchedUrl(e.target.value)} placeholder="/driver-schedule" className="w-full border rounded-lg px-3 py-2" dir="ltr" />
                </div>

                <div className="border-t pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">תזמון</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">סוג</label>
                      <select value={schedType} onChange={(e) => setSchedType(e.target.value as typeof schedType)} className="w-full border rounded-lg px-3 py-2">
                        <option value="daily">יומי</option>
                        <option value="weekly">שבועי</option>
                        <option value="one_time">חד פעמי</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">שעה</label>
                      <input type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} className="w-full border rounded-lg px-3 py-2" required />
                    </div>
                  </div>

                  {schedType === 'weekly' && (
                    <div className="mt-3">
                      <label className="block text-xs text-gray-500 mb-2">ימים</label>
                      <div className="flex gap-2 flex-wrap">
                        {DAY_NAMES.map((name, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => toggleDay(i)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              schedDays.includes(i)
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {schedType === 'one_time' && (
                    <div className="mt-3">
                      <label className="block text-xs text-gray-500 mb-1">תאריך</label>
                      <input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} className="w-full border rounded-lg px-3 py-2" required />
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button type="submit" disabled={savingSchedule} className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400">
                    {savingSchedule ? '⏳ שומר...' : editingId ? '💾 עדכן' : '💾 שמור תבנית'}
                  </button>
                  <button type="button" onClick={() => { setShowForm(false); resetScheduleForm(); }} className="px-6 py-2.5 rounded-lg border hover:bg-gray-50">
                    ביטול
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Schedule List */}
          {schedules.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              <p className="text-4xl mb-3">⏰</p>
              <p>עדיין אין תבניות מתוזמנות</p>
              <p className="text-sm mt-1">צור תבנית חדשה כדי לשלוח התראות באופן אוטומטי</p>
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map(s => (
                <div key={s.id} className={`bg-white rounded-lg shadow p-4 border-r-4 ${s.is_active ? 'border-green-500' : 'border-gray-300'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{s.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {s.is_active ? 'פעיל' : 'מושבת'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">{s.title}</span> — {s.body}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span>
                          {s.schedule_type === 'daily' && `יומי ב-${s.schedule_time.slice(0, 5)}`}
                          {s.schedule_type === 'weekly' && `שבועי ב-${s.schedule_time.slice(0, 5)} | ${(s.schedule_days || []).map(d => DAY_NAMES[d]).join(', ')}`}
                          {s.schedule_type === 'one_time' && `חד פעמי: ${s.one_time_date} ב-${s.schedule_time.slice(0, 5)}`}
                        </span>
                        <span>| {targetLabels[s.target] || s.target}</span>
                        {s.last_sent_at && (
                          <span>| נשלח לאחרונה: {new Date(s.last_sent_at).toLocaleString('he-IL')}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mr-4">
                      <button onClick={() => toggleScheduleActive(s.id, s.is_active)} className={`p-2 rounded-lg text-sm ${s.is_active ? 'hover:bg-red-50 text-red-500' : 'hover:bg-green-50 text-green-500'}`} title={s.is_active ? 'השבת' : 'הפעל'}>
                        {s.is_active ? '⏸️' : '▶️'}
                      </button>
                      <button onClick={() => editSchedule(s)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-500" title="ערוך">
                        ✏️
                      </button>
                      <button onClick={() => deleteSchedule(s.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500" title="מחק">
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: History */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-lg shadow">
          {loading ? (
            <div className="p-8 text-center text-gray-500">טוען...</div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center text-gray-500">עדיין לא נשלחו הודעות</div>
          ) : (
            <div className="divide-y">
              {history.map((notif) => (
                <div key={notif.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium">{notif.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{notif.body}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">{targetLabels[notif.target] || notif.target}</span>
                        <span className="text-xs text-green-600">✅ {notif.sent_count} נשלחו</span>
                        {notif.failed_count > 0 && <span className="text-xs text-red-600">❌ {notif.failed_count} נכשלו</span>}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap mr-4">
                      {new Date(notif.created_at).toLocaleString('he-IL')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
