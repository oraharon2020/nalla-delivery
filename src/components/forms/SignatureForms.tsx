'use client';

import { useRef, useEffect, useState } from 'react';
import SignaturePad from 'signature_pad';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import type { WCOrder } from '@/types';
import { formatPrice } from '@/utils/helpers';
import { uploadFile, addOrderNote } from '@/utils/api';
import { useLoader } from '@/components/ui/Loader';
import { supabase } from '@/lib/supabase';

interface SignatureFormsProps {
  order: WCOrder;
  orderId: string;
  storeId: string;
  onSuccess?: () => void;
}

function getDriverInfoFromToken(): { user_id: string; username: string } | null {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const base64 = token.split('.')[1];
    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    );
    const payload = JSON.parse(decoded);
    return { user_id: payload.user_id, username: payload.username };
  } catch {
    return null;
  }
}

function resolveCompanyName(storeId: string): string {
  const lower = storeId.toLowerCase();
  if (lower === 'nalla' || lower === '2') return 'נלה רהיטים בע"מ';
  if (lower === 'bellano' || lower === '1') return 'בלאנו';
  return storeId;
}

export function SignatureForms({ order, orderId, storeId, onSuccess }: SignatureFormsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeForm, setActiveForm] = useState<'delivery' | 'repair' | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [repairDescription, setRepairDescription] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);
  const formContentRef = useRef<HTMLDivElement>(null);
  const { show: showLoader, hide: hideLoader } = useLoader();

  const companyName = resolveCompanyName(storeId);
  const customerName = `${order.billing.first_name} ${order.billing.last_name}`;
  const phone = order.billing.phone;
  const address = order.shipping.address_1;
  const orderDate = order.date_created
    ? new Date(order.date_created).toLocaleDateString('he-IL')
    : '';
  const orderTotal = formatPrice(order.total);

  useEffect(() => {
    if (canvasRef.current && activeForm) {
      signaturePadRef.current = new SignaturePad(canvasRef.current, {
        backgroundColor: 'rgb(250, 250, 250)',
      });

      const resizeCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
          const ratio = Math.max(window.devicePixelRatio || 1, 1);
          canvas.width = canvas.offsetWidth * ratio;
          canvas.height = canvas.offsetHeight * ratio;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.scale(ratio, ratio);
          }
          signaturePadRef.current?.clear();
        }
      };

      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      return () => {
        window.removeEventListener('resize', resizeCanvas);
      };
    }
  }, [activeForm]);

  const clearSignature = () => {
    signaturePadRef.current?.clear();
  };

  const closeForm = () => {
    setActiveForm(null);
    setIsFullscreen(false);
    signaturePadRef.current = null;
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const generatePDF = async (type: 'delivery' | 'repair'): Promise<Blob> => {
    const signatureDataUrl = signaturePadRef.current?.toDataURL('image/png') || '';

    // Build an offscreen HTML element — NO <img> for signature (html2canvas can't handle data URLs reliably)
    const container = document.createElement('div');
    container.style.cssText =
      'position:absolute;left:-9999px;top:0;width:794px;padding:40px;background:#fff;font-family:Arial,sans-serif;direction:rtl;';

    const formTitle =
      type === 'delivery' ? 'תעודת משלוח ואחריות' : 'טופס תיקון';

    const itemsHtml = order.line_items
      .map(
        (item) => `
        <tr>
          <td style="padding:8px;border:1px solid #ddd;text-align:right">${item.name}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:center">${item.quantity}</td>
          <td style="padding:8px;border:1px solid #ddd;text-align:left">${formatPrice(item.total)}</td>
        </tr>`
      )
      .join('');

    const repairSection =
      type === 'repair'
        ? `<div style="margin-top:16px;padding:12px;border:1px solid #ddd;border-radius:8px;background:#f9f9f9">
            <h3 style="margin:0 0 8px;font-size:16px">תיאור התיקון</h3>
            <p style="margin:0;white-space:pre-wrap">${repairDescription}</p>
          </div>`
        : '';

    const declarationText =
      type === 'delivery'
        ? `אני החתום מטה, מאשר/ת שקיבלתי את המוצר שרכשתי מחברת ${companyName} במצב תקין ולשביעות רצוני המלאה. אני מודע/ת שלאחר חתימתי זו, לא תהיה לי אפשרות להחזיר את המוצר או לדרוש החזר כספי, למעט מקרים של תקלה טכנית או פגם ייצור שהתגלו לאחר החתימה.`
        : `אני מאשר/ת כי ידוע לי שתהליך תיקון המוצר עשוי להימשך עד 14 ימי עסקים.`;

    // Signature placeholder — just text label, actual image added via jsPDF below
    container.innerHTML = `
      <div style="text-align:center;margin-bottom:24px">
        <h1 style="margin:0;font-size:24px">${companyName}</h1>
        <h2 style="margin:8px 0 0;font-size:20px;color:#333">${formTitle}</h2>
        <p style="margin:4px 0 0;color:#666;font-size:14px">תאריך: ${new Date().toLocaleDateString('he-IL')} | הזמנה: #${orderId}</p>
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:20px;padding:16px;border:1px solid #ddd;border-radius:8px;background:#f8f9fa">
        <div style="flex:1;min-width:200px">
          <p style="margin:0;color:#666;font-size:12px">שם מלא</p>
          <p style="margin:2px 0 0;font-weight:bold">${customerName}</p>
        </div>
        <div style="flex:1;min-width:200px">
          <p style="margin:0;color:#666;font-size:12px">טלפון</p>
          <p style="margin:2px 0 0;font-weight:bold">${phone}</p>
        </div>
        <div style="flex:1;min-width:200px">
          <p style="margin:0;color:#666;font-size:12px">כתובת</p>
          <p style="margin:2px 0 0;font-weight:bold">${address}</p>
        </div>
        <div style="flex:1;min-width:200px">
          <p style="margin:0;color:#666;font-size:12px">תאריך הזמנה</p>
          <p style="margin:2px 0 0;font-weight:bold">${orderDate}</p>
        </div>
      </div>

      <h3 style="font-size:16px;margin:0 0 8px">פרטי הזמנה</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <thead>
          <tr style="background:#f0f0f0">
            <th style="padding:8px;border:1px solid #ddd;text-align:right">פריט</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:center">כמות</th>
            <th style="padding:8px;border:1px solid #ddd;text-align:left">מחיר</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          <tr style="background:#f0f0f0;font-weight:bold">
            <td colspan="2" style="padding:8px;border:1px solid #ddd;text-align:right">סה"כ</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:left">${orderTotal}</td>
          </tr>
        </tfoot>
      </table>

      ${repairSection}

      <div style="margin:20px 0;padding:16px;border:2px solid #dc2626;border-radius:8px;background:#fef2f2">
        <p style="margin:0;color:#dc2626;font-weight:bold;font-size:15px;line-height:1.6">${declarationText}</p>
      </div>

      <div style="margin-top:24px">
        <p style="margin:0 0 8px;color:#666;font-size:14px">חתימת הלקוח:</p>
      </div>

      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;text-align:center;color:#999;font-size:11px">
        <p style="margin:0">מסמך זה הופק באופן דיגיטלי על ידי מערכת ${companyName}</p>
      </div>
    `;

    document.body.appendChild(container);

    try {
      const captured = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const imgData = captured.toDataURL('image/jpeg', 0.92);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pageWidth - 20;
      const imgHeight = (captured.height * imgWidth) / captured.width;

      // Add the main form content image
      pdf.addImage(imgData, 'JPEG', 10, 10, imgWidth, imgHeight);

      // Now add the signature directly via jsPDF (bypasses html2canvas entirely)
      if (signatureDataUrl) {
        // Calculate where the signature should go — after the form content
        const sigY = Math.min(10 + imgHeight - 30, pageHeight - 55);
        if (sigY > pageHeight - 50) {
          pdf.addPage();
          pdf.addImage(signatureDataUrl, 'PNG', pageWidth - 90, 20, 70, 35);
        } else {
          pdf.addImage(signatureDataUrl, 'PNG', pageWidth - 90, sigY, 70, 35);
        }
      }

      return pdf.output('blob');
    } finally {
      document.body.removeChild(container);
    }
  };

  const saveSignedDocument = async (
    signatureDataUrl: string,
    documentUrl: string
  ) => {
    try {
      const driverInfo = getDriverInfoFromToken();

      // Find the delivery assignment for this order
      const today = new Date().toISOString().split('T')[0];
      const { data: delivery } = await supabase
        .from('delivery_assignments')
        .select('id')
        .eq('order_id', parseInt(orderId))
        .eq('delivery_date', today)
        .limit(1)
        .maybeSingle();

      await supabase.from('signed_documents').insert({
        order_id: parseInt(orderId),
        delivery_id: delivery?.id || null,
        driver_id: driverInfo?.user_id || null,
        signature_url: signatureDataUrl,
        document_url: documentUrl,
        signed_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error saving signed document:', err);
    }
  };

  const submitForm = async (type: 'delivery' | 'repair') => {
    if (signaturePadRef.current?.isEmpty()) {
      alert('נא לחתום על הטופס');
      return;
    }

    if (type === 'repair' && !repairDescription.trim()) {
      alert('נא למלא תיאור התיקון');
      return;
    }

    try {
      showLoader('שומר טופס...');

      const signatureDataUrl = signaturePadRef.current?.toDataURL('image/png') || '';
      const pdfBlob = await generatePDF(type);
      const fileName =
        type === 'delivery'
          ? `delivery_form_${orderId}.pdf`
          : `repair_form_${orderId}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      const uploadResult = await uploadFile(file, orderId, storeId);

      if (uploadResult.success && uploadResult.fileUrl) {
        const noteLabel =
          type === 'delivery' ? 'טופס משלוח חתום' : 'טופס תיקון חתום';

        await addOrderNote(
          orderId,
          storeId,
          `${noteLabel}: <a href="${uploadResult.fileUrl}" target="_blank">צפה בטופס</a>`,
          true
        );

        // Save to signed_documents table
        await saveSignedDocument(signatureDataUrl, uploadResult.fileUrl);

        alert('הטופס נשמר ונשלח בהצלחה');
        closeForm();
        setIsModalOpen(false);
        onSuccess?.();
      } else {
        throw new Error(uploadResult.message || 'שגיאה בהעלאת הטופס');
      }
    } catch (error) {
      console.error('Error:', error);
      alert(
        'אירעה שגיאה: ' +
          (error instanceof Error ? error.message : 'Unknown error')
      );
    } finally {
      hideLoader();
    }
  };

  const renderOrderItems = () => (
    <div className="space-y-2">
      {order.line_items.map((item) => (
        <div key={item.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
          <span className="font-medium">{item.name}</span>
          <div className="flex gap-3 text-gray-600">
            <span>כמות: {item.quantity}</span>
            <span>{formatPrice(item.total)}</span>
          </div>
        </div>
      ))}
      <div className="flex justify-between items-center p-2 bg-blue-50 rounded font-bold">
        <span>סה&quot;כ</span>
        <span>{orderTotal}</span>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
      >
        טפסי חתימה
      </button>

      {/* Modal */}
      {isModalOpen && !activeForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">טפסי חתימה</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <button
                onClick={() => setActiveForm('delivery')}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700"
              >
                טופס תעודת משלוח ואחריות
              </button>
              <button
                onClick={() => setActiveForm('repair')}
                className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700"
              >
                טופס תיקון
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Form */}
      {activeForm === 'delivery' && (
        <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-6" ref={formContentRef}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">תעודת משלוח ואחריות</h2>
              <button onClick={closeForm} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {/* Company & Order Info */}
              <div className="text-center border-b pb-4">
                <p className="text-lg font-bold">{companyName}</p>
                <p className="text-gray-500">הזמנה #{orderId} | {orderDate}</p>
              </div>

              {/* Customer Details */}
              <div className="border-b pb-4">
                <h3 className="text-xl font-semibold mb-3">פרטי לקוח</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-600">שם מלא</p>
                    <p className="font-medium">{customerName}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">טלפון</p>
                    <p className="font-medium">{phone}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-600">כתובת</p>
                    <p className="font-medium">{address}</p>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="border-b pb-4">
                <h3 className="text-xl font-semibold mb-3">פרטי הזמנה</h3>
                {renderOrderItems()}
              </div>

              {/* Declaration */}
              <div className="border-b pb-4">
                <p className="text-red-600 font-bold text-lg leading-relaxed">
                  אני החתום מטה, מאשר זאת שקיבלתי את המוצר שרכשתי מחברת {companyName}
                  במצב תקין ולשביעות רצוני המלאה. אני מודע/ת שלאחר חתימתי זו, לא תהיה לי אפשרות
                  להחזיר את המוצר או לדרוש החזר כספי, למעט מקרים של תקלה טכנית או פגם ייצור שהתגלו לאחר החתימה.
                </p>
              </div>

              {/* Signature */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-gray-600">חתימת הלקוח:</p>
                  <button
                    onClick={toggleFullscreen}
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
                    </svg>
                    הגדל אזור חתימה
                  </button>
                </div>
                <canvas
                  ref={canvasRef}
                  className={`border-2 border-gray-300 rounded-lg w-full bg-gray-50 hover:border-blue-400 transition-colors ${
                    isFullscreen ? 'h-96' : 'h-64'
                  }`}
                />
                <button
                  onClick={clearSignature}
                  className="mt-2 text-gray-600 hover:text-gray-800 flex items-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  נקה חתימה
                </button>
              </div>

              <button
                onClick={() => submitForm('delivery')}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
              >
                שלח טופס
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Repair Form */}
      {activeForm === 'repair' && (
        <div className="fixed inset-0 bg-white z-50 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">טופס תיקון</h2>
              <button onClick={closeForm} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {/* Company & Order Info */}
              <div className="text-center border-b pb-4">
                <p className="text-lg font-bold">{companyName}</p>
                <p className="text-gray-500">הזמנה #{orderId} | {orderDate}</p>
              </div>

              {/* Customer Details */}
              <div className="border-b pb-4">
                <h3 className="text-xl font-semibold mb-3">פרטי לקוח</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-600">שם מלא</p>
                    <p className="font-medium">{customerName}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">טלפון</p>
                    <p className="font-medium">{phone}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-gray-600">כתובת</p>
                    <p className="font-medium">{address}</p>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="border-b pb-4">
                <h3 className="text-xl font-semibold mb-3">פרטי הזמנה</h3>
                {renderOrderItems()}
              </div>

              {/* Repair Description */}
              <div className="border-b pb-4">
                <h3 className="text-xl font-semibold mb-3">תיאור התיקון</h3>
                <textarea
                  value={repairDescription}
                  onChange={(e) => setRepairDescription(e.target.value)}
                  className="w-full h-32 p-3 border rounded-lg resize-none"
                  placeholder="תיאור התיקון הנדרש..."
                />
              </div>

              {/* Declaration */}
              <div className="border-b pb-4">
                <p className="text-red-600 font-bold text-lg">
                  אני מאשר/ת כי ידוע לי שתהליך תיקון המוצר עשוי להימשך עד 14 ימי עסקים.
                </p>
              </div>

              {/* Signature */}
              <div>
                <p className="text-gray-600 mb-2">חתימת הלקוח:</p>
                <canvas
                  ref={canvasRef}
                  className={`border-2 border-gray-300 rounded-lg w-full bg-gray-50 hover:border-blue-400 transition-colors ${
                    isFullscreen ? 'h-96' : 'h-64'
                  }`}
                />
                <button
                  onClick={clearSignature}
                  className="mt-2 text-gray-600 hover:text-gray-800 flex items-center"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  נקה חתימה
                </button>
              </div>

              <button
                onClick={() => submitForm('repair')}
                className="w-full bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-medium"
              >
                שלח טופס
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
