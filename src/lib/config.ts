export const config = {
  db: {
    host: process.env.DB_HOST || '167.172.191.47',
    user: process.env.DB_USER || 'rkjcuwqssf',
    password: process.env.DB_PASS || 'RwwgUA2Wf8',
    database: process.env.DB_NAME || 'rkjcuwqssf',
  },
  googleDrive: {
    clientId: process.env.GOOGLE_DRIVE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET || '',
    refreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN || '',
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
  },
  jwt: {
    secret: process.env.JWT_SECRET || '122sdfafs-cascq34-axcaefqsf-1234dqsac',
  },
};

export type StoreId = string;
