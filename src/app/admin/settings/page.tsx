'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface Settings {
  google_maps_api_key: string;
  delivery_note_template: string;
  completion_note_template: string;
  technician_note_template: string;
  default_time_slots: string[];
}

const defaultCompletionTemplate = `שלום {customer_name},

המשלוח שלך (הזמנה #{order_number}) תואם בהצלחה!

פרטי המסירה:
📅 תאריך: {delivery_date}
⏰ טווח שעות: {time_slot}
🚗 נהג: {driver_name}
📞 טלפון נהג: {driver_phone}

תודה שקנית ב-{store_name}!`;

const defaultTechnicianTemplate = `שלום {customer_name},

ביקור הטכנאי שלך (הזמנה #{order_number}) הושלם בהצלחה!

פרטי הביקור:
📅 תאריך: {delivery_date}
⏰ טווח שעות: {time_slot}
🔧 טכנאי: {driver_name}
📞 טלפון: {driver_phone}

תודה שבחרת ב-{store_name}!`;

export default function SettingsPage() {
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  
  // Settings
  const [settings, setSettings] = useState<Settings>({
    google_maps_api_key: '',
    delivery_note_template: 'המשלוח הושלם על ידי {driver_name} בתאריך {delivery_date} בטווח שעות {time_slot}',
    completion_note_template: defaultCompletionTemplate,
    technician_note_template: defaultTechnicianTemplate,
    default_time_slots: ['06:00-09:00', '09:00-12:00', '12:00-15:00', '15:00-18:00', '18:00-21:00'],
  });

  // Note template preview
  const [preview, setPreview] = useState('');

  useEffect(() => {
    setIsClient(true);
    loadSettings();
  }, []);

  useEffect(() => {
    updatePreview();
  }, [settings.completion_note_template]);

  const loadSettings = async () => {
    try {
      const { data } = await supabase
        .from('settings')
        .select('*');
      
      if (data) {
        const settingsMap: Record<string, any> = {};
        data.forEach(item => {
          settingsMap[item.key] = item.value;
        });
        
        setSettings({
          google_maps_api_key: settingsMap.google_maps_api_key || '',
          delivery_note_template: settingsMap.delivery_note_template || settings.delivery_note_template,
          completion_note_template: settingsMap.completion_note_template || defaultCompletionTemplate,
          technician_note_template: settingsMap.technician_note_template || defaultTechnicianTemplate,
          default_time_slots: settingsMap.default_time_slots || settings.default_time_slots,
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreview = () => {
    const template = settings.completion_note_template;
    const previewText = template
      .replace(/{driver_name}/g, 'ישראל ישראלי')
      .replace(/{delivery_date}/g, new Date().toLocaleDateString('he-IL'))
      .replace(/{scheduled_date}/g, new Date().toLocaleDateString('he-IL'))
      .replace(/{scheduled_time}/g, '09:00-12:00')
      .replace(/{time_slot}/g, '09:00-12:00')
      .replace(/{delivery_time}/g, new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }))
      .replace(/{customer_name}/g, 'לקוח לדוגמה')
      .replace(/{order_number}/g, '12345')
      .replace(/{store_name}/g, 'החנות שלי')
      .replace(/{driver_phone}/g, '050-1234567')
      .replace(/{current_date}/g, new Date().toLocaleDateString('he-IL'))
      .replace(/{current_time}/g, new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }));
    setPreview(previewText);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save each setting
      for (const [key, value] of Object.entries(settings)) {
        const { error } = await supabase
          .from('settings')
          .upsert(
            { key, value },
            { onConflict: 'key' }
          );
        
        if (error) {
          console.error(`Error saving ${key}:`, error);
        }
      }
      alert('ההגדרות נשמרו בהצלחה');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('שגיאה בשמירת ההגדרות');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTimeSlot = () => {
    setSettings(prev => ({
      ...prev,
      default_time_slots: [...prev.default_time_slots, '00:00-00:00'],
    }));
  };

  const handleRemoveTimeSlot = (index: number) => {
    setSettings(prev => ({
      ...prev,
      default_time_slots: prev.default_time_slots.filter((_, i) => i !== index),
    }));
  };

  const handleTimeSlotChange = (index: number, value: string) => {
    setSettings(prev => ({
      ...prev,
      default_time_slots: prev.default_time_slots.map((slot, i) => 
        i === index ? value : slot
      ),
    }));
  };

  if (!isClient) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'general', label: 'הגדרות כלליות' },
    { id: 'messages', label: 'תבניות הודעות' },
    { id: 'timeslots', label: 'זמני משלוח' },
    { id: 'maps', label: 'Google Maps' },
  ];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b">
          <nav className="flex gap-4 px-6">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-2 border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">הגדרות כלליות</h3>
              <p className="text-gray-500">
                הגדרות כלליות של המערכת
              </p>
              {/* Add general settings here as needed */}
            </div>
          )}

          {/* Message Templates */}
          {activeTab === 'messages' && (
            <div className="space-y-6">
              {/* Completion Note Template */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">🚚 תבנית הודעת משלוח (נשלחת ללקוח)</h3>
                
                <div>
                  <textarea
                    value={settings.completion_note_template}
                    onChange={(e) => setSettings({ ...settings, completion_note_template: e.target.value })}
                    rows={10}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>
              </div>

              {/* Technician Note Template */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">🔧 תבנית הודעת ביקור טכנאי (נשלחת ללקוח)</h3>
                
                <div>
                  <textarea
                    value={settings.technician_note_template}
                    onChange={(e) => setSettings({ ...settings, technician_note_template: e.target.value })}
                    rows={10}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>
              </div>

              {/* Short delivery note template */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">תבנית הערה קצרה (לנהג)</h3>
                
                <div>
                  <textarea
                    value={settings.delivery_note_template}
                    onChange={(e) => setSettings({ ...settings, delivery_note_template: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">תגיות זמינות:</p>
                <div className="text-sm text-gray-600 grid grid-cols-2 gap-2">
                  <p><code className="bg-gray-200 px-1 rounded">{'{driver_name}'}</code> - שם הנהג</p>
                  <p><code className="bg-gray-200 px-1 rounded">{'{driver_phone}'}</code> - טלפון הנהג</p>
                  <p><code className="bg-gray-200 px-1 rounded">{'{delivery_date}'}</code> - תאריך המשלוח</p>
                  <p><code className="bg-gray-200 px-1 rounded">{'{time_slot}'}</code> - טווח שעות מתוזמן</p>
                  <p><code className="bg-gray-200 px-1 rounded">{'{scheduled_date}'}</code> - תאריך מתוזמן</p>
                  <p><code className="bg-gray-200 px-1 rounded">{'{delivery_time}'}</code> - שעה בעת ההשלמה</p>
                  <p><code className="bg-gray-200 px-1 rounded">{'{customer_name}'}</code> - שם הלקוח</p>
                  <p><code className="bg-gray-200 px-1 rounded">{'{order_number}'}</code> - מספר הזמנה</p>
                  <p><code className="bg-gray-200 px-1 rounded">{'{store_name}'}</code> - שם החנות</p>
                  <p><code className="bg-gray-200 px-1 rounded">{'{current_date}'}</code> - תאריך נוכחי</p>
                  <p><code className="bg-gray-200 px-1 rounded">{'{current_time}'}</code> - שעה נוכחית</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">תצוגה מקדימה:</p>
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg whitespace-pre-wrap">
                  {preview}
                </div>
              </div>
            </div>
          )}

          {/* Time Slots */}
          {activeTab === 'timeslots' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">זמני משלוח ברירת מחדל</h3>
              
              <div className="space-y-2">
                {settings.default_time_slots.map((slot, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={slot}
                      onChange={(e) => handleTimeSlotChange(index, e.target.value)}
                      placeholder="HH:MM-HH:MM"
                      className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => handleRemoveTimeSlot(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={handleAddTimeSlot}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                + הוסף זמן משלוח
              </button>
            </div>
          )}

          {/* Google Maps */}
          {activeTab === 'maps' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">הגדרות Google Maps</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  מפתח API של Google Maps
                </label>
                <input
                  type="text"
                  value={settings.google_maps_api_key}
                  onChange={(e) => setSettings({ ...settings, google_maps_api_key: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder="AIzaSy..."
                />
                <p className="mt-1 text-sm text-gray-500">
                  נדרש לתכונות מפה ואופטימיזציית מסלולים
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
        >
          {saving ? 'שומר...' : 'שמור הגדרות'}
        </button>
      </div>
    </div>
  );
}
