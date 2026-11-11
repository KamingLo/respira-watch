import type { Response } from 'express';
import { AppError } from './AppError.js';

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200
): void => {
  res.status(statusCode).json({
    success: true,
    ...(message ? { message } : {}),
    data,
  });
};

export const handleControllerError = (
  res: Response,
  error: unknown,
  context: string,
  fallbackMessage: string
): void => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
    return;
  }

  console.error(`[${context}] Error:`, error);
  res.status(500).json({
    success: false,
    message: fallbackMessage,
  });
};
