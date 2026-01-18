declare module 'bcrypt';
declare module 'bcryptjs';
declare module 'jsonwebtoken';

declare namespace NodeJS {
  interface ProcessEnv {
    JWT_SECRET?: string;
    MONGODB_URI?: string;
    PORT?: string;
  }
}
