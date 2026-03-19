'use client';

import { useState, useEffect } from 'react';
import { supabase, User, Store } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export default function DriversManagementPage() {
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<User | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    display_name: '',
    phone: '',
    is_active: true,
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Status settings
  const [driverStatuses, setDriverStatuses] = useState<Record<string, Record<string, string>>>({});
  const [modalStatuses, setModalStatuses] = useState<Record<string, string>>({});

  useEffect(() => {
    setIsClient(true);
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [driversResult, storesResult] = await Promise.all([
        supabase.from('users').select('*').eq('role', 'driver').order('display_name'),
        supabase.from('stores').select('*').eq('is_active', true).order('name'),
      ]);

      if (driversResult.data) setDrivers(driversResult.data);
      if (storesResult.data) setStores(storesResult.data);

      // Load driver status settings
      const { data: statusSettings } = await supabase
        .from('driver_status_settings')
        .select('*');
      
      if (statusSettings) {
        const statusMap: Record<string, Record<string, string>> = {};
        statusSettings.forEach((setting: any) => {
          if (!statusMap[setting.driver_id]) {
            statusMap[setting.driver_id] = {};
          }
          statusMap[setting.driver_id][setting.store_id] = setting.completion_status;
        });
        setDriverStatuses(statusMap);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingDriver(null);
    setFormData({
      email: '',
      password: '',
      display_name: '',
      phone: '',
      is_active: true,
    });
    setModalStatuses({});
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (driver: User) => {
    setEditingDriver(driver);
    setFormData({
      email: driver.email,
      password: '',
      display_name: driver.display_name,
      phone: driver.phone || '',
      is_active: driver.is_active,
    });
    // Load driver's status settings into modal
    setModalStatuses(driverStatuses[driver.id] || {});
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setFormError('');
    setSaving(true);

    try {
      if (!formData.email || !formData.display_name) {
        throw new Error('יש למלא את כל השדות הנדרשים');
      }

      if (!editingDriver && !formData.password) {
        throw new Error('יש להזין סיסמה לנהג חדש');
      }

      let driverId = editingDriver?.id;

      if (editingDriver) {
        // Update existing driver
        const updates: any = {
          email: formData.email,
          display_name: formData.display_name,
          phone: formData.phone,
          is_active: formData.is_active,
        };

        if (formData.password) {
          updates.password_hash = await bcrypt.hash(formData.password, 10);
        }

        await supabase
          .from('users')
          .update(updates)
          .eq('id', editingDriver.id);
      } else {
        // Create new driver
        const passwordHash = await bcrypt.hash(formData.password, 10);
        
        const { data: newDriver } = await supabase.from('users').insert({
          email: formData.email,
          password_hash: passwordHash,
          display_name: formData.display_name,
          phone: formData.phone,
          role: 'driver',
          is_active: formData.is_active,
        }).select().single();
        
        driverId = newDriver?.id;
      }

      // Save status settings
      if (driverId && Object.keys(modalStatuses).length > 0) {
        for (const [storeId, status] of Object.entries(modalStatuses)) {
          if (status) {
            const { error } = await supabase
              .from('driver_status_settings')
              .upsert({
                driver_id: driverId,
                store_id: storeId,
                completion_status: status,
              }, { onConflict: 'driver_id,store_id' });
            
            if (error) {
              console.error('Error saving status setting:', error);
            }
          }
        }
        
        // Update local state
        setDriverStatuses(prev => ({
          ...prev,
          [driverId!]: modalStatuses,
        }));
      }

      setShowModal(false);
      loadData();
    } catch (error: any) {
      setFormError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (driver: User) => {
    if (!confirm(`האם אתה בטוח שברצונך למחוק את הנהג ${driver.display_name}?`)) {
      return;
    }

    try {
      await supabase.from('users').delete().eq('id', driver.id);
      loadData();
    } catch (error) {
      console.error('Error deleting driver:', error);
      alert('שגיאה במחיקת הנהג');
    }
  };

  const handleToggleActive = async (driver: User) => {
    try {
      await supabase
        .from('users')
        .update({ is_active: !driver.is_active })
        .eq('id', driver.id);
      loadData();
    } catch (error) {
      console.error('Error toggling driver status:', error);
    }
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
        <h2 className="text-xl font-semibold text-gray-800">ניהול נהגים</h2>
        <button
          onClick={openAddModal}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + הוסף נהג
        </button>
      </div>

      {/* Drivers List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                שם
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                דוא"ל
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                טלפון
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                סטטוס
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                פעולות
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {drivers.map(driver => (
              <tr key={driver.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                      {driver.display_name.charAt(0)}
                    </div>
                    <span className="font-medium">{driver.display_name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-500">{driver.email}</td>
                <td className="px-6 py-4 text-gray-500">{driver.phone || '-'}</td>
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={() => handleToggleActive(driver)}
                    className={`px-3 py-1 rounded-full text-sm ${
                      driver.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {driver.is_active ? 'פעיל' : 'לא פעיל'}
                  </button>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => openEditModal(driver)}
                      className="text-blue-600 hover:text-blue-800"
                      title="ערוך"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDelete(driver)}
                      className="text-red-600 hover:text-red-800"
                      title="מחק"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {drivers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  אין נהגים להצגה
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingDriver ? 'עריכת נהג' : 'הוספת נהג חדש'}
            </h3>

            {formError && (
              <div className="bg-red-50 text-red-600 px-4 py-2 rounded mb-4">
                {formError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  שם מלא *
                </label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  דוא"ל *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  סיסמה {editingDriver ? '(השאר ריק לשמירה על הקיימת)' : '*'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  טלפון
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  נהג פעיל
                </label>
              </div>

              {/* Status Settings */}
              {stores.length > 0 && (
                <div className="border-t pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    הגדרות סטטוס השלמה לכל חנות
                  </label>
                  <div className="space-y-3">
                    {stores.map(store => (
                      <div key={store.store_id} className="flex items-center gap-3">
                        <label className="text-sm text-gray-600 min-w-[120px]">
                          {store.name}:
                        </label>
                        <select
                          value={modalStatuses[store.store_id] || ''}
                          onChange={(e) => setModalStatuses(prev => ({
                            ...prev,
                            [store.store_id]: e.target.value
                          }))}
                          className="flex-1 px-2 py-1 border rounded text-sm"
                        >
                          <option value="">בחר סטטוס השלמה</option>
                          {store.active_statuses?.map(status => (
                            <option key={status} value={status}>
                              {status.replace('wc-', '')}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
