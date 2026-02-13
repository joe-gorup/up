import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

// Salt rounds for bcrypt (12 is secure and reasonable performance)
const SALT_ROUNDS = 12;

// JWT secret - in production this should be a strong secret from environment
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '8h'; // Match session timeout

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  role: string;
  userType: 'user' | 'employee';
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    return await bcrypt.hash(password, SALT_ROUNDS);
  } catch (error) {
    logger.error({ error }, 'Failed to hash password');
    throw new Error('Password hashing failed');
  }
}

/**
 * Compare a plain text password with a hashed password
 */
export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    logger.error({ error }, 'Failed to compare password');
    return false;
  }
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(user: AuthUser): string {
  try {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        userType: user.userType
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  } catch (error) {
    logger.error({ error, userId: user.id }, 'Failed to generate JWT token');
    throw new Error('Token generation failed');
  }
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      first_name: decoded.first_name,
      last_name: decoded.last_name,
      role: decoded.role,
      userType: decoded.userType
    };
  } catch (error) {
    logger.error({ error }, 'Failed to verify JWT token');
    return null;
  }
}

/**
 * Middleware to authenticate API requests
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Attach user to request object
  (req as any).user = user;
  next();
}

/**
 * Middleware to check if user has required role
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as AuthUser;
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}