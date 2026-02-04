/**
 * Safe error handling utilities to prevent information leakage
 */

import { devLog } from "@/lib/logger";

// Map of known error codes to user-friendly messages
const errorMessages: Record<string, string> = {
  // Postgres error codes
  '23505': 'This username is already taken. Please choose a different one.',
  '23503': 'The referenced data no longer exists.',
  '23502': 'Please fill in all required fields.',
  '22001': 'The input is too long. Please shorten it.',
  '23514': 'The input does not meet the required format.',
  
  // Supabase/PostgREST error codes
  'PGRST116': 'The requested resource was not found.',
  'PGRST301': 'The request could not be processed.',
  'PGRST204': 'No data was returned.',
  
  // Auth error codes
  'invalid_credentials': 'Invalid email or password. Please try again.',
  'email_not_confirmed': 'Please verify your email address before signing in.',
  'user_not_found': 'No account found with this email address.',
  'email_taken': 'An account with this email already exists.',
  'weak_password': 'Please choose a stronger password.',
  'invalid_email': 'Please enter a valid email address.',
  'signup_disabled': 'Account registration is temporarily disabled.',
  'over_request_rate_limit': 'Too many attempts. Please wait a moment and try again.',
  'over_email_send_rate_limit': 'Too many email requests. Please wait before trying again.',
  
  // Storage errors
  'storage/invalid-file-type': 'This file type is not allowed.',
  'storage/file-too-large': 'The file is too large. Please choose a smaller file.',
  'storage/unauthorized': 'You are not authorized to perform this action.',
};

// Patterns to detect sensitive information that should be hidden
const sensitivePatterns = [
  /constraint\s+\w+/i,
  /table\s+\w+\.\w+/i,
  /column\s+\w+/i,
  /violates\s+\w+/i,
  /relation\s+\w+/i,
  /schema\s+\w+/i,
  /JWT\s+token/i,
  /at\s+\d{4}-\d{2}-\d{2}/i,
  /stack\s*:/i,
  /Error:\s+at\s+/i,
];

/**
 * Converts raw error messages to user-friendly messages
 * Prevents leaking internal database/system information
 */
export function getSafeErrorMessage(error: unknown): string {
  // Default generic message
  const genericMessage = 'An error occurred. Please try again.';
  
  if (!error) {
    return genericMessage;
  }
  
  // Handle Error objects
  const errorObj = error as { 
    code?: string; 
    message?: string; 
    error_description?: string;
    status?: number;
  };
  
  // Check for known error codes first
  if (errorObj.code && errorMessages[errorObj.code]) {
    return errorMessages[errorObj.code];
  }
  
  // Check message for known patterns
  const message = errorObj.message || errorObj.error_description || '';
  
  // Check if message contains sensitive information
  for (const pattern of sensitivePatterns) {
    if (pattern.test(message)) {
      // Log the full error for debugging (only in development mode)
      devLog.error('[Error Details]:', error);
      return genericMessage;
    }
  }
  
  // Check for specific known message patterns
  if (message.toLowerCase().includes('duplicate key')) {
    return errorMessages['23505'];
  }
  
  if (message.toLowerCase().includes('password')) {
    if (message.toLowerCase().includes('weak') || message.toLowerCase().includes('short')) {
      return 'Please choose a stronger password (at least 6 characters).';
    }
    if (message.toLowerCase().includes('incorrect') || message.toLowerCase().includes('invalid')) {
      return 'Invalid email or password. Please try again.';
    }
  }
  
  if (message.toLowerCase().includes('email') && message.toLowerCase().includes('already')) {
    return 'An account with this email already exists.';
  }
  
  if (message.toLowerCase().includes('rate limit')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  
  if (message.toLowerCase().includes('network') || message.toLowerCase().includes('connection')) {
    return 'Connection error. Please check your internet and try again.';
  }
  
  // If message seems safe (short, no technical terms), return it
  if (message.length > 0 && message.length < 100 && !sensitivePatterns.some(p => p.test(message))) {
    // Additional safety check - reject messages with certain keywords
    const unsafeKeywords = ['sql', 'query', 'database', 'postgres', 'supabase', 'row', 'policy', 'rls'];
    const lowerMessage = message.toLowerCase();
    if (!unsafeKeywords.some(keyword => lowerMessage.includes(keyword))) {
      return message;
    }
  }
  
  return genericMessage;
}

/**
 * Gets a context-specific error message for auth operations
 */
export function getAuthErrorMessage(error: unknown, context: 'signin' | 'signup' | 'signout'): string {
  const baseMessage = getSafeErrorMessage(error);
  
  // Provide more helpful context-specific messages
  if (baseMessage === 'An error occurred. Please try again.') {
    switch (context) {
      case 'signin':
        return 'Unable to sign in. Please check your credentials and try again.';
      case 'signup':
        return 'Unable to create account. Please try again later.';
      case 'signout':
        return 'Unable to sign out. Please try again.';
    }
  }
  
  return baseMessage;
}

/**
 * Gets a context-specific error message for profile operations
 */
export function getProfileErrorMessage(error: unknown): string {
  const baseMessage = getSafeErrorMessage(error);
  
  // Check for specific profile-related error patterns
  const errorObj = error as { code?: string; message?: string };
  
  if (errorObj.code === '23505' || errorObj.message?.toLowerCase().includes('unique')) {
    return 'This username is already taken. Please choose a different one.';
  }
  
  if (errorObj.code === '23514' || errorObj.message?.toLowerCase().includes('check')) {
    return 'The input does not meet the required format. Please check and try again.';
  }
  
  if (baseMessage === 'An error occurred. Please try again.') {
    return 'Unable to update profile. Please try again.';
  }
  
  return baseMessage;
}

/**
 * Gets a context-specific error message for storage operations
 */
export function getStorageErrorMessage(error: unknown): string {
  const baseMessage = getSafeErrorMessage(error);
  
  if (baseMessage === 'An error occurred. Please try again.') {
    return 'Unable to upload file. Please try again.';
  }
  
  return baseMessage;
}
