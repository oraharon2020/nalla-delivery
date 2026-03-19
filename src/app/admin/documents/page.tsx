'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface SignedDocument {
  id: string;
  order_id: number;
  delivery_date: string;
  customer_name: string;
  driver_name: string;
  signature_url: string;
  document_url: string;
  photos: string[];
  signed_at: string;
}

export default function DocumentsPage() {
  const [isClient, setIsClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<SignedDocument[]>([]);
  
  // Filters
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Preview modal
  const [selectedDoc, setSelectedDoc] = useState<SignedDocument | null>(null);

  useEffect(() => {
    setIsClient(true);
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const { data } = await supabase
        .from('signed_documents')
        .select(`
          id,
          order_id,
          signature_url,
          document_url,
          photos,
          signed_at,
          delivery:delivery_assignments(
            delivery_date,
            customer_name,
            driver:users(display_name)
          )
        `)
        .gte('signed_at', `${dateFrom}T00:00:00`)
        .lte('signed_at', `${dateTo}T23:59:59`)
        .order('signed_at', { ascending: false });

      if (data) {
        const mappedDocs = data.map((doc: any) => ({
          id: doc.id,
          order_id: doc.order_id,
          delivery_date: doc.delivery?.delivery_date || '',
          customer_name: doc.delivery?.customer_name || '-',
          driver_name: doc.delivery?.driver?.display_name || '-',
          signature_url: doc.signature_url,
          document_url: doc.document_url || '',
          photos: doc.photos || [],
          signed_at: doc.signed_at,
        }));
        setDocuments(mappedDocs);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadDocuments();
  };

  const filteredDocuments = documents.filter(doc => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      doc.order_id.toString().includes(search) ||
      doc.customer_name.toLowerCase().includes(search) ||
      doc.driver_name.toLowerCase().includes(search)
    );
  });

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
        <div className="flex flex-wrap gap-4 items-end">
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

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              חיפוש
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="מספר הזמנה, לקוח או נהג..."
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={handleSearch}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            חפש
          </button>
        </div>
      </div>

      {/* Documents Grid */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">תעודות חתומות ({filteredDocuments.length})</h2>
        </div>

        {filteredDocuments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            אין תעודות חתומות להצגה
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    מספר הזמנה
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    לקוח
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    נהג
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    תאריך משלוח
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    נחתם בתאריך
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    קובץ PDF
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    פעולות
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredDocuments.map(doc => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">#{doc.order_id}</td>
                    <td className="px-6 py-4">{doc.customer_name}</td>
                    <td className="px-6 py-4">{doc.driver_name}</td>
                    <td className="px-6 py-4">
                      {doc.delivery_date 
                        ? new Date(doc.delivery_date).toLocaleDateString('he-IL')
                        : '-'}
                    </td>
                    <td className="px-6 py-4">
                      {new Date(doc.signed_at).toLocaleString('he-IL')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {doc.document_url ? (
                        <a
                          href={doc.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded text-sm hover:bg-blue-100"
                        >
                          📄 צפה ב-PDF
                        </a>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => setSelectedDoc(doc)}
                          className="text-blue-600 hover:text-blue-800"
                          title="צפה"
                        >
                          👁️
                        </button>
                        {doc.signature_url && (
                          <a
                            href={doc.signature_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-600 hover:text-green-800"
                            title="הורד חתימה"
                          >
                            📥
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                תעודת משלוח - הזמנה #{selectedDoc.order_id}
              </h3>
              <button
                onClick={() => setSelectedDoc(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Details */}
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">פרטי משלוח</h4>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-gray-500">לקוח:</span> {selectedDoc.customer_name}</p>
                    <p><span className="text-gray-500">נהג:</span> {selectedDoc.driver_name}</p>
                    <p><span className="text-gray-500">תאריך משלוח:</span> {selectedDoc.delivery_date ? new Date(selectedDoc.delivery_date).toLocaleDateString('he-IL') : '-'}</p>
                    <p><span className="text-gray-500">נחתם:</span> {new Date(selectedDoc.signed_at).toLocaleString('he-IL')}</p>
                  </div>
                </div>

                {/* Signature */}
                {selectedDoc.signature_url && (
                  <div>
                    <h4 className="font-medium mb-2">חתימה</h4>
                    <div className="border rounded-lg p-2 bg-white">
                      <img
                        src={selectedDoc.signature_url}
                        alt="חתימה"
                        className="max-h-48 mx-auto"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Drive PDF Link */}
              <div>
                <h4 className="font-medium mb-2">קובץ PDF בגוגל דרייב</h4>
                {selectedDoc.document_url ? (
                  <a
                    href={selectedDoc.document_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition w-full"
                  >
                    <span className="text-2xl">📄</span>
                    <div>
                      <p className="font-medium">פתח PDF בגוגל דרייב</p>
                      <p className="text-xs text-blue-500 truncate max-w-[280px]">{selectedDoc.document_url}</p>
                    </div>
                  </a>
                ) : (
                  <p className="text-gray-500 text-sm">אין קובץ PDF</p>
                )}

                {selectedDoc.photos.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">תמונות ({selectedDoc.photos.length})</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedDoc.photos.map((photo, index) => (
                        <a
                          key={index}
                          href={photo}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={photo}
                            alt={`תמונה ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg hover:opacity-80 transition"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setSelectedDoc(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
