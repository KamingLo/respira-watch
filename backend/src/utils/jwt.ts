import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { OfficerRole } from '../models/Officer.js';

export interface JwtOfficerPayload extends JWTPayload {
  officerId: string;
  email: string;
  role: OfficerRole;
  nip: string;
}

export const getJwtSecretKey = (): Uint8Array => {
  const secret = process.env.JWT_SECRET || 'respirawatch_super_secret_jwt_key_change_in_prod';
  return new TextEncoder().encode(secret);
};

export const signOfficerToken = async (payload: JwtOfficerPayload): Promise<string> => {
  const secretKey = getJwtSecretKey();
  const expiresIn = process.env.JWT_EXPIRES_IN || '8h';

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(payload.officerId)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey);
};

export const verifyOfficerToken = async (token: string): Promise<JwtOfficerPayload> => {
  const secretKey = getJwtSecretKey();
  const { payload } = await jwtVerify(token, secretKey, {
    algorithms: ['HS256'],
  });
  return payload as JwtOfficerPayload;
};
