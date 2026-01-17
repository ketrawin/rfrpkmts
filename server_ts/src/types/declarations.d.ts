declare module 'bcrypt';
declare module 'bcryptjs';
declare module 'jsonwebtoken';

declare namespace NodeJS {
  interface ProcessEnv {
    JWT_SECRET?: string;
    MONGODB_URI?: string;
    BYPASS_CAPTCHA?: string;
    PORT?: string;
  }
}
