'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { useLoader, Loader } from '@/components/ui/Loader';
import { SignatureForms } from '@/components/forms/SignatureForms';
import { getOrder, addOrderNote, updateOrderStatus, uploadFile, getAllStatuses } from '@/utils/api';
import {
  formatPrice,
  formatDate,
  getCurrentUsername,
  isAuthenticated,
  getStatusLabel,
} from '@/utils/helpers';
import type { WCOrder, AllowedStatuses, UploadedFile } from '@/types';
import { supabase } from '@/lib/supabase';
import PullToRefresh from '@/components/ui/PullToRefresh';

export default function OrderDetailsPage() {
  return (
    <Suspense fallback={<Loader />}>
      <OrderDetailsContent />
    </Suspense>
  );
}

function OrderDetailsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { show: showLoader, hide: hideLoader } = useLoader();

  const orderId = searchParams.get('id') || '';
  const storeIdParam = searchParams.get('store');

  const [order, setOrder] = useState<WCOrder | null>(null);
  const [storeId, setStoreId] = useState(storeIdParam || '');
  const [allowedStatuses, setAllowedStatuses] = useState<AllowedStatuses>({});
  const [commentText, setCommentText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Map<string, File>>(new Map());
  const [error, setError] = useState('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }

    if (!storeIdParam) {
      setError('מזהה חנות חסר');
      return;
    }

    setStoreId(storeIdParam);

    loadAllowedStatuses(storeIdParam);
    loadOrderDetails(orderId, storeIdParam);
  }, [orderId, storeIdParam, router, isClient]);

  const loadAllowedStatuses = async (store: string) => {
    try {
      const response = await getAllStatuses();
      if (response.success) {
        // Map store_id to the correct statuses list
        const isNalla = store === '2' || store.toLowerCase() === 'nalla';
        const storeStatuses = isNalla ? response.nalla : response.bellano;
        const statuses: AllowedStatuses = {};
        storeStatuses.forEach((status) => {
          statuses[status] = {
            label: getStatusLabel(status),
            enabled: true,
          };
        });
        setAllowedStatuses(statuses);
      }
    } catch (err) {
      console.error('Error loading statuses:', err);
      // Set default statuses
      setAllowedStatuses({
        'done-dima': { label: 'הושלם - ארטיום', enabled: true },
        'done-nikos': { label: 'הושלם - ניקוס', enabled: true },
        'un-warehouse': { label: 'חוזר למחסן', enabled: true },
      });
    }
  };

  const loadOrderDetails = async (id: string, store: string) => {
    try {
      showLoader('טוען פרטי הזמנה...');
      setError('');

      const response = await getOrder(id, store);

      if (response.success && response.data) {
        setOrder(response.data);
      } else {
        throw new Error(response.message || 'שגיאה בטעינת ההזמנה');
      }
    } catch (err) {
      console.error('Error loading order:', err);
      setError(err instanceof Error ? err.message : 'שגיאה בטעינת ההזמנה');
    } finally {
      hideLoader();
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!newStatus || !order) return;

    try {
      showLoader('מעדכן סטטוס...');

      const response = await updateOrderStatus(orderId, storeId, newStatus);

      if (response.success) {
        const statusLabel = allowedStatuses[newStatus]?.label || newStatus;
        await addOrderNote(orderId, storeId, `שינוי סטטוס ל-${statusLabel}`, false);
        alert('הסטטוס עודכן בהצלחה');
        await loadOrderDetails(orderId, storeId);
      } else {
        throw new Error(response.message || 'שגיאה בעדכון הסטטוס');
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert('שגיאה בעדכון הסטטוס: ' + (err instanceof Error ? err.message : ''));
    } finally {
      hideLoader();
    }
  };

  // Compress image function
  const compressImage = (file: File, maxWidth: number = 1920, quality: number = 0.8): Promise<File> => {
    return new Promise((resolve, reject) => {
      // If not an image, return as-is
      if (!file.type.startsWith('image/')) {
        resolve(file);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Calculate new dimensions
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          // Create canvas and draw resized image
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            resolve(file);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Convert to blob
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                resolve(file);
                return;
              }
              
              // Create new file from blob
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: file.lastModified,
              });

              console.log(`Compressed ${file.name}: ${(file.size / 1024).toFixed(0)}KB -> ${(compressedFile.size / 1024).toFixed(0)}KB`);
              resolve(compressedFile);
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = () => resolve(file);
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    showLoader('מעבד תמונות...');
    
    try {
      const newFiles = new Map(selectedFiles);

      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        const extension = file.type.startsWith('image/') ? 'jpg' : (file.name.split('.').pop()?.toLowerCase() || 'jpg');
        const timestamp = Date.now();
        const newFileName = `order_${orderId}_${timestamp}_${index}.${extension}`;
        
        // Compress images before adding
        const processedFile = await compressImage(file);
        
        const renamedFile = new File([processedFile], newFileName, {
          type: processedFile.type,
          lastModified: processedFile.lastModified,
        });
        newFiles.set(newFileName, renamedFile);
      }

      setSelectedFiles(newFiles);
    } catch (err) {
      console.error('Error processing files:', err);
    } finally {
      hideLoader();
      // Reset the input so the same files can be selected again
      event.target.value = '';
    }
  };

  const removeFile = (fileName: string) => {
    const newFiles = new Map(selectedFiles);
    newFiles.delete(fileName);
    setSelectedFiles(newFiles);
  };

  const submitCommentWithFiles = async () => {
    if (!commentText.trim() && selectedFiles.size === 0) {
      alert('יש להעלות לפחות קובץ אחד או להוסיף טקסט');
      return;
    }

    try {
      showLoader('מעלה קבצים...');

      // Upload files one by one with progress
      const uploadedFiles: UploadedFile[] = [];
      const failedFiles: string[] = [];
      let uploadCount = 0;
      const totalFiles = selectedFiles.size;

      for (const [fileName, file] of selectedFiles) {
        uploadCount++;
        showLoader(`מעלה קובץ ${uploadCount} מתוך ${totalFiles}...`);
        
        try {
          const result = await uploadFile(file, orderId, storeId);
          if (result.success && result.fileUrl) {
            uploadedFiles.push({ name: fileName, url: result.fileUrl });
          } else {
            failedFiles.push(fileName);
            console.error(`Failed to upload ${fileName}:`, result.message);
          }
        } catch (uploadError) {
          failedFiles.push(fileName);
          console.error(`Error uploading ${fileName}:`, uploadError);
        }
      }

      // Show warning if some files failed
      if (failedFiles.length > 0) {
        alert(`שים לב: ${failedFiles.length} קבצים לא הועלו בהצלחה`);
      }

      // If no files uploaded and no text, show error
      if (uploadedFiles.length === 0 && !commentText.trim()) {
        throw new Error('לא הצלחנו להעלות אף קובץ');
      }

      showLoader('שומר הערה...');

      // Build note text
      const username = getCurrentUsername();
      let noteText = commentText.trim();

      if (uploadedFiles.length > 0) {
        if (noteText) noteText += '\n\n';
        noteText += 'קבצים מצורפים:\n';
        uploadedFiles.forEach((file) => {
          noteText += `- ${file.name} <a href="${file.url}">קישור לצפייה</a>\n`;
        });
      }

      const finalNoteText = `**${username}**: ${noteText}`;

      const response = await addOrderNote(orderId, storeId, finalNoteText, false);

      if (response.success) {
        // If files were uploaded, also attach them to signed_documents if one exists
        if (uploadedFiles.length > 0) {
          const imageUrls = uploadedFiles
            .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name))
            .map(f => f.url);

          if (imageUrls.length > 0) {
            try {
              const { data: existingDoc } = await supabase
                .from('signed_documents')
                .select('id, photos')
                .eq('order_id', parseInt(orderId))
                .order('signed_at', { ascending: false })
                .limit(1)
                .maybeSingle();

              if (existingDoc) {
                const currentPhotos = existingDoc.photos || [];
                await supabase
                  .from('signed_documents')
                  .update({ photos: [...currentPhotos, ...imageUrls] })
                  .eq('id', existingDoc.id);
              }
            } catch (e) {
              console.error('Error attaching photos to signed document:', e);
            }
          }
        }

        setCommentText('');
        setSelectedFiles(new Map());
        await loadOrderDetails(orderId, storeId);
      } else {
        throw new Error(response.message || 'שגיאה בהוספת הערה');
      }
    } catch (err) {
      console.error('Error:', err);
      alert('שגיאה: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      hideLoader();
    }
  };

  const renderStatusSelect = () => {
    const completionStatuses = Object.entries(allowedStatuses).filter(([key]) =>
      key.startsWith('done-')
    );
    const undeliveredStatuses = Object.entries(allowedStatuses).filter(([key]) =>
      key.startsWith('un-')
    );

    return (
      <select
        value=""
        onChange={(e) => handleStatusChange(e.target.value)}
        className="p-2 border rounded w-full sm:w-auto text-sm sm:text-base"
      >
        <option value="">בחר סטטוס לשינוי</option>
        {completionStatuses.length > 0 && (
          <optgroup label="סטטוסי השלמה">
            {completionStatuses.map(([key, status]) => (
              <option key={key} value={key}>
                {status.label}
              </option>
            ))}
          </optgroup>
        )}
        {undeliveredStatuses.length > 0 && (
          <optgroup label="סטטוסי אי-מסירה">
            {undeliveredStatuses.map(([key, status]) => (
              <option key={key} value={key}>
                {status.label}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    );
  };

  const renderNotes = () => {
    if (!order?.notes || order.notes.length === 0) {
      return (
        <div className="text-gray-500 text-center py-4">אין הערות</div>
      );
    }

    return order.notes.map((note) => {
      let username = 'מערכת';
      let content = note.note;

      const match = note.note.match(/^\*\*(.*?)\*\*:\s(.*)$/);
      if (match) {
        username = match[1];
        content = match[2];
      }

      // Convert links to clickable
      content = content.replace(
        /<a href="(.*?)">([^<]*)<\/a>/g,
        '<a href="$1" class="text-blue-600 hover:text-blue-800" target="_blank">$2</a>'
      );

      return (
        <div
          key={note.id}
          className="bg-gray-50 p-4 rounded-lg mb-4 border border-gray-200"
        >
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">
              {formatDate(note.date_created)}
            </span>
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
              {username}
            </span>
          </div>
          <div
            className="text-gray-800"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        </div>
      );
    });
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  const customerName = `${order.billing.first_name} ${order.billing.last_name}`;

  return (
    <PullToRefresh onRefresh={() => loadOrderDetails(orderId, storeId)}>
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="bg-gray-100 p-2 rounded-md hover:bg-gray-200 transition-colors flex-shrink-0"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                הזמנה #{order.number || order.id}
              </h1>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 whitespace-nowrap">סטטוס:</label>
                {renderStatusSelect()}
              </div>
              <SignatureForms
                order={order}
                orderId={orderId}
                storeId={storeId}
                onSuccess={() => loadOrderDetails(orderId, storeId)}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column - Products & Comments */}
          <div className="order-2 lg:order-1 lg:col-span-8 space-y-8">
            {/* Products Section */}
            <div className="bg-white shadow rounded-lg p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-4">פרטי המוצרים</h2>
              <div className="space-y-4">
                {order.line_items.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:justify-between p-3 sm:p-4 border-b gap-3"
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      {item.image ? (
                        <img
                          src={item.image.src}
                          alt={item.name}
                          className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded flex-shrink-0"
                        />
                      ) : (
                        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                          <svg
                            className="w-8 h-8 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-medium text-sm sm:text-base line-clamp-2">{item.name}</h3>
                        <p className="text-gray-600 text-sm">כמות: {item.quantity}</p>
                      </div>
                    </div>
                    <div className="text-left font-medium text-sm sm:text-base self-end sm:self-center">{formatPrice(item.total)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Staff Notes Section */}
            <div className="bg-white shadow rounded-lg p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-4">הערות מנהל</h2>

              {/* Comment Form */}
              <div className="mb-4 space-y-4">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-3 min-h-[80px] sm:min-h-[100px] resize-y text-sm sm:text-base"
                  placeholder="הוסף הערה..."
                />

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="file"
                    id="fileUpload"
                    multiple
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <button
                    type="button"
                    onClick={() => document.getElementById('fileUpload')?.click()}
                    className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-2 flex-1 sm:flex-none text-sm sm:text-base"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    צרף קבצים
                  </button>
                  <button
                    type="button"
                    onClick={submitCommentWithFiles}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex-1 sm:flex-none text-sm sm:text-base"
                  >
                    הוסף
                  </button>
                </div>

                {/* File Preview */}
                {selectedFiles.size > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {Array.from(selectedFiles.entries()).map(([fileName, file]) => (
                      <div key={fileName} className="relative group">
                        {file.type.startsWith('image/') ? (
                          <img
                            src={URL.createObjectURL(file)}
                            alt={fileName}
                            className="w-24 h-24 object-cover rounded"
                          />
                        ) : (
                          <div className="w-24 h-24 bg-gray-100 rounded flex items-center justify-center">
                            <span className="text-xs text-gray-500 truncate px-1">
                              {fileName}
                            </span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded">
                          <button
                            onClick={() => removeFile(fileName)}
                            className="text-white bg-red-500 hover:bg-red-600 p-1 rounded"
                          >
                            מחק
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes List */}
              {renderNotes()}
            </div>
          </div>

          {/* Right Column - Customer Details */}
          <div className="order-1 lg:order-2 lg:col-span-4 space-y-8">
            {/* Customer Details */}
            <div className="bg-white shadow rounded-lg p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-4">פרטי לקוח</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-500">שם מלא</label>
                  <p className="font-medium">{customerName}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">כתובת</label>
                  <p className="font-medium">{order.shipping.address_1}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">טלפון</label>
                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:${order.billing.phone}`}
                      className="font-medium text-blue-600 hover:text-blue-800"
                    >
                      {order.billing.phone}
                    </a>
                    <a
                      href={`https://wa.me/${order.billing.phone?.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 hover:text-green-800"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="bg-white shadow rounded-lg p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-4">סיכום הזמנה</h2>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">סה״כ ששולם</span>
                  <span className="font-medium">{formatPrice(order.total)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">תאריך הזמנה</span>
                  <span className="font-medium">
                    {formatDate(order.date_created)}
                  </span>
                </div>
              </div>
            </div>

            {/* Customer Notes */}
            <div className="bg-white shadow rounded-lg p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-4">הערות לקוח</h2>
              {order.customer_note && order.customer_note.trim() ? (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="text-gray-800">{order.customer_note}</div>
                </div>
              ) : (
                <div className="text-gray-500 text-center py-4">
                  אין הערות מהלקוח
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
    </PullToRefresh>
  );
}
