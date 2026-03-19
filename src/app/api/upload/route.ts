import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { uploadToGoogleDrive } from '@/lib/google-drive';
import { logActivity } from '@/lib/activity-log';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'אין טוקן הרשאה' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'לא נמצא קובץ' },
        { status: 400 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Google Drive
    const result = await uploadToGoogleDrive(buffer, file.name, file.type);

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 500 }
      );
    }

    // Log file upload activity
    await logActivity({
      driverId: user.user_id,
      driverName: user.username,
      action: 'file_uploaded',
      details: { file_name: file.name, file_type: file.type },
    });

    return NextResponse.json({
      success: true,
      fileUrl: result.fileUrl,
      fileId: result.fileId,
    });
  } catch (error) {
    console.error('Upload error:', error);
    const message = error instanceof Error ? error.message : 'שגיאה בהעלאת הקובץ';
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
