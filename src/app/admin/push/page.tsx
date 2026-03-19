'use client';

import { useState, useEffect } from 'react';

interface NotificationLog {
  id: string;
  title: string;
  body: string;
  target: string;
  sent_count: number;
  failed_count: number;
  created_at: string;
}

export default function PushNotificationsPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState('all');
  const [url, setUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [history, setHistory] = useState<NotificationLog[]>([]);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
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

  const targetLabels: Record<string, string> = {
    all: 'כולם',
    drivers: 'נהגים בלבד',
    admins: 'מנהלים בלבד',
  };

  return (
    <div className="p-6 max-w-4xl mx-auto" dir="rtl">
      <h1 className="text-2xl font-bold mb-6">📢 שליחת התראות Push</h1>

      {/* Stats */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-center gap-4">
        <span className="text-3xl">📱</span>
        <div>
          <p className="text-lg font-semibold text-blue-800">{subscriberCount} מנויים רשומים</p>
          <p className="text-sm text-blue-600">משתמשים שהתקינו את האפליקציה ואישרו התראות</p>
        </div>
      </div>

      {/* Send Form */}
      <form onSubmit={handleSend} className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">שליחת הודעה חדשה</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">קהל יעד</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">כולם (נהגים + מנהלים)</option>
              <option value="drivers">נהגים בלבד</option>
              <option value="admins">מנהלים בלבד</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">כותרת *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="למשל: עדכון חשוב"
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">תוכן ההודעה *</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="הקלד את תוכן ההודעה..."
              rows={3}
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
              maxLength={500}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">קישור (אופציונלי)</label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="/driver-schedule או /admin/deliveries"
              className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              dir="ltr"
            />
            <p className="text-xs text-gray-500 mt-1">הדף שייפתח כשלוחצים על ההתראה</p>
          </div>

          <button
            type="submit"
            disabled={sending || !title.trim() || !body.trim()}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <span className="animate-spin">⏳</span>
                שולח...
              </>
            ) : (
              <>
                📤 שלח התראה ל{targetLabels[target]}
              </>
            )}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className={`mt-4 p-4 rounded-lg ${result.sent > 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            {result.sent > 0 ? (
              <p className="text-green-800">
                ✅ נשלח בהצלחה ל-{result.sent} מתוך {result.total} מנויים
                {result.failed > 0 && <span className="text-red-600"> ({result.failed} נכשלו)</span>}
              </p>
            ) : (
              <p className="text-red-800">❌ השליחה נכשלה. בדוק את ההגדרות.</p>
            )}
          </div>
        )}
      </form>

      {/* History */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">📋 היסטוריית הודעות</h2>
        </div>

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
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {targetLabels[notif.target] || notif.target}
                      </span>
                      <span className="text-xs text-green-600">✅ {notif.sent_count} נשלחו</span>
                      {notif.failed_count > 0 && (
                        <span className="text-xs text-red-600">❌ {notif.failed_count} נכשלו</span>
                      )}
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
    </div>
  );
}
