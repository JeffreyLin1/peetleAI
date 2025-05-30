import { Response } from 'express';
import { ApiResponse, ApiError } from '../types/api.types';
import { HTTP_STATUS } from '../config/constants';

export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode: number = HTTP_STATUS.OK
): void => {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };
  res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  error: string,
  message?: string,
  statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR
): void => {
  const response: ApiError = {
    error,
    message: message || error,
  };
  res.status(statusCode).json(response);
};

export const sendValidationError = (
  res: Response,
  message: string
): void => {
  sendError(res, 'Validation Error', message, HTTP_STATUS.BAD_REQUEST);
};

export const sendNotFound = (
  res: Response,
  resource: string = 'Resource'
): void => {
  sendError(res, 'Not Found', `${resource} not found`, HTTP_STATUS.NOT_FOUND);
};

export const sendUnauthorized = (
  res: Response,
  message: string = 'Authentication required'
): void => {
  sendError(res, 'Unauthorized', message, HTTP_STATUS.UNAUTHORIZED);
}; 