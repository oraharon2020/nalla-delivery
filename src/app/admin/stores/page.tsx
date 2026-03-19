'use client';

import { useState, useEffect } from 'react';
import { supabase, Store } from '@/lib/supabase';

export default function StoresManagementPage() {
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<Store[]>([]);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    store_id: '',
    name: '',
    url: '',
    consumer_key: '',
    consumer_secret: '',
    email_from: '',
    email_name: '',
    is_active: true,
    is_default: false,
    active_statuses: [] as string[],
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [loadingStatuses, setLoadingStatuses] = useState(false);

  // Available WooCommerce statuses - default + custom from API
  const [wooStatuses, setWooStatuses] = useState([
    { value: 'pending', label: 'ממתין לתשלום' },
    { value: 'processing', label: 'בטיפול' },
    { value: 'on-hold', label: 'בהמתנה' },
    { value: 'completed', label: 'הושלם' },
    { value: 'cancelled', label: 'בוטל' },
    { value: 'refunded', label: 'הוחזר' },
    { value: 'failed', label: 'נכשל' },
  ]);

  useEffect(() => {
    setIsClient(true);
    loadStores();
  }, []);

  const loadStores = async () => {
    try {
      const { data } = await supabase
        .from('stores')
        .select('*')
        .order('name');
      
      if (data) setStores(data);
    } catch (error) {
      console.error('Error loading stores:', error);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingStore(null);
    setFormData({
      store_id: '',
      name: '',
      url: '',
      consumer_key: '',
      consumer_secret: '',
      email_from: '',
      email_name: '',
      is_active: true,
      is_default: false,
      active_statuses: ['processing'],
    });
    setFormError('');
    setTestResult(null);
    setShowModal(true);
  };

  const openEditModal = async (store: Store) => {
    setEditingStore(store);
    setFormData({
      store_id: store.store_id,
      name: store.name,
      url: store.url,
      consumer_key: store.consumer_key,
      consumer_secret: store.consumer_secret,
      email_from: store.email_from || '',
      email_name: store.email_name || '',
      is_active: store.is_active,
      is_default: store.is_default,
      active_statuses: store.active_statuses || [],
    });
    setFormError('');
    setTestResult(null);
    setShowModal(true);
    
    // Automatically fetch statuses for existing store
    setLoadingStatuses(true);
    try {
      const response = await fetch('/api/woocommerce/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: store.url,
          consumer_key: store.consumer_key,
          consumer_secret: store.consumer_secret,
        }),
      });
      const data = await response.json();
      if (response.ok && data.statuses && data.statuses.length > 0) {
        setWooStatuses(data.statuses);
      }
    } catch (e) {
      // Ignore - just use default statuses
    } finally {
      setLoadingStatuses(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setLoadingStatuses(true);

    try {
      const response = await fetch('/api/woocommerce/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: formData.url,
          consumer_key: formData.consumer_key,
          consumer_secret: formData.consumer_secret,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setTestResult({ success: true, message: 'החיבור הצליח!' });
        
        // Update statuses list with custom statuses from WooCommerce
        if (data.statuses && data.statuses.length > 0) {
          setWooStatuses(data.statuses);
        }
      } else {
        setTestResult({ success: false, message: data.error || 'החיבור נכשל' });
      }
    } catch (error: any) {
      setTestResult({ success: false, message: error.message });
    } finally {
      setTesting(false);
      setLoadingStatuses(false);
    }
  };

  const handleSave = async () => {
    setFormError('');
    setSaving(true);

    try {
      if (!formData.store_id || !formData.name || !formData.url || !formData.consumer_key || !formData.consumer_secret) {
        throw new Error('יש למלא את כל השדות הנדרשים');
      }

      // If setting as default, unset other defaults
      if (formData.is_default) {
        await supabase
          .from('stores')
          .update({ is_default: false })
          .neq('store_id', formData.store_id);
      }

      if (editingStore) {
        // Update existing store
        await supabase
          .from('stores')
          .update({
            name: formData.name,
            url: formData.url,
            consumer_key: formData.consumer_key,
            consumer_secret: formData.consumer_secret,
            email_from: formData.email_from,
            email_name: formData.email_name,
            is_active: formData.is_active,
            is_default: formData.is_default,
            active_statuses: formData.active_statuses,
          })
          .eq('id', editingStore.id);
      } else {
        // Create new store
        await supabase.from('stores').insert({
          store_id: formData.store_id,
          name: formData.name,
          url: formData.url,
          consumer_key: formData.consumer_key,
          consumer_secret: formData.consumer_secret,
          email_from: formData.email_from,
          email_name: formData.email_name,
          is_active: formData.is_active,
          is_default: formData.is_default,
          active_statuses: formData.active_statuses,
        });
      }

      setShowModal(false);
      loadStores();
    } catch (error: any) {
      setFormError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (store: Store) => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את החנות ${store.name}?`)) {
      return;
    }

    try {
      await supabase.from('stores').delete().eq('id', store.id);
      loadStores();
    } catch (error) {
      console.error('Error deleting store:', error);
      alert('שגיאה במחיקת החנות');
    }
  };

  const handleStatusToggle = (status: string) => {
    setFormData(prev => ({
      ...prev,
      active_statuses: prev.active_statuses.includes(status)
        ? prev.active_statuses.filter(s => s !== status)
        : [...prev.active_statuses, status],
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">ניהול חנויות</h2>
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + הוסף חנות
        </button>
      </div>

      {/* Stores Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stores.map(store => (
          <div key={store.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg">{store.name}</h3>
                <p className="text-sm text-gray-500">{store.store_id}</p>
              </div>
              <div className="flex gap-2">
                {store.is_default && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    ברירת מחדל
                  </span>
                )}
                <span className={`px-2 py-1 text-xs rounded-full ${
                  store.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {store.is_active ? 'פעיל' : 'לא פעיל'}
                </span>
              </div>
            </div>

            <div className="text-sm text-gray-600 mb-4 space-y-1">
              <p className="truncate">{store.url}</p>
              <p>סטטוסים: {store.active_statuses?.length || 0}</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => openEditModal(store)}
                className="flex-1 py-2 border rounded-lg hover:bg-gray-50 text-sm"
              >
                ערוך
              </button>
              <button
                onClick={() => handleDelete(store)}
                className="py-2 px-4 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 text-sm"
              >
                מחק
              </button>
            </div>
          </div>
        ))}

        {stores.length === 0 && (
          <div className="col-span-full bg-white rounded-lg shadow p-8 text-center text-gray-500">
            אין חנויות להצגה. לחץ על "הוסף חנות" להתחלה.
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl m-4">
            <h3 className="text-lg font-semibold mb-4">
              {editingStore ? 'עריכת חנות' : 'הוספת חנות חדשה'}
            </h3>

            {formError && (
              <div className="bg-red-50 text-red-600 px-4 py-2 rounded mb-4">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  מזהה חנות *
                </label>
                <input
                  type="text"
                  value={formData.store_id}
                  onChange={(e) => setFormData({ ...formData, store_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={!!editingStore}
                  placeholder="store_1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  שם החנות *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="החנות שלי"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  כתובת URL *
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="https://mystore.com"
                />
                <p className="text-xs text-gray-500 mt-1">יש להזין את כתובת האתר המלאה כולל https://</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Consumer Key *
                </label>
                <input
                  type="text"
                  value={formData.consumer_key}
                  onChange={(e) => setFormData({ ...formData, consumer_key: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder="ck_xxxx"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Consumer Secret *
                </label>
                <input
                  type="password"
                  value={formData.consumer_secret}
                  onChange={(e) => setFormData({ ...formData, consumer_secret: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  placeholder="cs_xxxx"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  דוא"ל שולח
                </label>
                <input
                  type="email"
                  value={formData.email_from}
                  onChange={(e) => setFormData({ ...formData, email_from: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="noreply@mystore.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  שם שולח
                </label>
                <input
                  type="text"
                  value={formData.email_name}
                  onChange={(e) => setFormData({ ...formData, email_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="החנות שלי"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  סטטוסים פעילים
                  <span className="text-xs text-gray-500 mr-2">
                    (בדוק חיבור לטעינת סטטוסים מותאמים אישית)
                  </span>
                </label>
                {loadingStatuses ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    טוען סטטוסים...
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {wooStatuses.map(status => (
                      <button
                        key={status.value}
                        type="button"
                        onClick={() => handleStatusToggle(status.value)}
                        className={`px-3 py-1 rounded-full text-sm transition ${
                          formData.active_statuses.includes(status.value)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {status.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">חנות פעילה</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_default}
                    onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">ברירת מחדל</span>
                </label>
              </div>

              {/* Test Connection */}
              <div className="md:col-span-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing || !formData.url || !formData.consumer_key || !formData.consumer_secret}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  {testing ? 'בודק...' : 'בדוק חיבור'}
                </button>
                {testResult && (
                  <span className={`mr-3 text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {testResult.message}
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
              >
                {saving ? 'שומר...' : 'שמור'}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2 border rounded-lg hover:bg-gray-100"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
