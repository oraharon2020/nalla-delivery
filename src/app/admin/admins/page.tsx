'use client';

import { useState, useEffect } from 'react';
import { supabase, User } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export default function AdminsManagementPage() {
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<User[]>([]);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<User | null>(null);
  
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

  useEffect(() => {
    setIsClient(true);
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'admin')
        .order('display_name');
      
      if (error) throw error;
      if (data) setAdmins(data);
    } catch (err) {
      console.error('Error loading admins:', err);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingAdmin(null);
    setFormData({ email: '', password: '', display_name: '', phone: '', is_active: true });
    setFormError('');
    setShowModal(true);
  };

  const openEditModal = (admin: User) => {
    setEditingAdmin(admin);
    setFormData({
      email: admin.email,
      password: '',
      display_name: admin.display_name,
      phone: admin.phone || '',
      is_active: admin.is_active,
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setFormError('');

      if (!formData.email || !formData.display_name) {
        throw new Error('יש למלא דוא"ל ושם תצוגה');
      }

      if (!editingAdmin && !formData.password) {
        throw new Error('יש להזין סיסמה למנהל חדש');
      }

      if (editingAdmin) {
        // Update existing admin
        const updateData: Record<string, unknown> = {
          email: formData.email,
          display_name: formData.display_name,
          phone: formData.phone || null,
          is_active: formData.is_active,
          updated_at: new Date().toISOString(),
        };

        if (formData.password) {
          updateData.password_hash = await bcrypt.hash(formData.password, 10);
        }

        const { error } = await supabase
          .from('users')
          .update(updateData)
          .eq('id', editingAdmin.id);

        if (error) throw error;
      } else {
        // Create new admin
        const passwordHash = await bcrypt.hash(formData.password, 10);

        const { error } = await supabase
          .from('users')
          .insert({
            email: formData.email,
            password_hash: passwordHash,
            display_name: formData.display_name,
            phone: formData.phone || null,
            role: 'admin',
            is_active: formData.is_active,
          });

        if (error) throw error;
      }

      setShowModal(false);
      await loadAdmins();
    } catch (err: any) {
      setFormError(err.message || 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (admin: User) => {
    // Prevent deleting the last active admin
    const activeAdmins = admins.filter(a => a.is_active);
    if (activeAdmins.length <= 1 && admin.is_active) {
      alert('לא ניתן למחוק את המנהל האחרון הפעיל');
      return;
    }

    if (!confirm(`האם אתה בטוח שברצונך למחוק את ${admin.display_name}?`)) return;

    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', admin.id);

      if (error) throw error;
      await loadAdmins();
    } catch (err) {
      console.error('Error deleting admin:', err);
      alert('שגיאה במחיקת המנהל');
    }
  };

  const toggleActive = async (admin: User) => {
    const activeAdmins = admins.filter(a => a.is_active);
    if (activeAdmins.length <= 1 && admin.is_active) {
      alert('לא ניתן להשבית את המנהל האחרון הפעיל');
      return;
    }

    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: !admin.is_active, updated_at: new Date().toISOString() })
        .eq('id', admin.id);

      if (error) throw error;
      await loadAdmins();
    } catch (err) {
      console.error('Error toggling admin:', err);
    }
  };

  if (!isClient) return null;

  return (
    <div className="p-6" dir="rtl">
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">🔑 ניהול מנהלים</h2>
          <button
            onClick={openAddModal}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            + הוסף מנהל
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-500">טוען...</div>
          ) : admins.length === 0 ? (
            <div className="text-center py-8 text-gray-500">אין מנהלים להצגה</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">שם</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">דוא"ל</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">טלפון</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">סטטוס</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {admins.map(admin => (
                    <tr key={admin.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{admin.display_name}</td>
                      <td className="px-6 py-4 text-gray-600">{admin.email}</td>
                      <td className="px-6 py-4 text-gray-600">{admin.phone || '-'}</td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => toggleActive(admin)}
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            admin.is_active 
                              ? 'bg-green-100 text-green-800 hover:bg-green-200' 
                              : 'bg-red-100 text-red-800 hover:bg-red-200'
                          }`}
                        >
                          {admin.is_active ? 'פעיל ✓' : 'מושבת ✗'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => openEditModal(admin)}
                            className="text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                          >
                            ✏️ ערוך
                          </button>
                          <button
                            onClick={() => handleDelete(admin)}
                            className="text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50"
                          >
                            🗑️ מחק
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {editingAdmin ? 'עריכת מנהל' : 'הוספת מנהל חדש'}
            </h3>

            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded mb-4 text-sm">
                {formError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם תצוגה</label>
                <input
                  type="text"
                  value={formData.display_name}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="שם המנהל"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">דוא"ל</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="admin@example.com"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  סיסמה {editingAdmin && '(השאר ריק אם לא רוצה לשנות)'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder={editingAdmin ? '••••••••' : 'הזן סיסמה'}
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">טלפון</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="050-1234567"
                  dir="ltr"
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
                <label htmlFor="is_active" className="text-sm text-gray-700">מנהל פעיל</label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
              >
                {saving ? 'שומר...' : (editingAdmin ? 'עדכן' : 'הוסף')}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300"
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
