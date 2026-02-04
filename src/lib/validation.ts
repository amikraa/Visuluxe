import { z } from 'zod';

/**
 * Validation schemas for user input
 */

// Username validation: 3-30 chars, alphanumeric + underscore/dash only
export const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be less than 30 characters')
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    'Username can only contain letters, numbers, underscores, and dashes'
  )
  .transform((val) => val.trim());

// Display name validation: 1-100 chars, printable characters
export const displayNameSchema = z
  .string()
  .min(1, 'Display name cannot be empty')
  .max(100, 'Display name must be less than 100 characters')
  .regex(
    /^[\p{L}\p{N}\p{P}\p{S}\s]+$/u,
    'Display name contains invalid characters'
  )
  .transform((val) => val.trim());

// Optional versions for form handling (allow empty strings)
export const optionalUsernameSchema = z
  .string()
  .transform((val) => val.trim())
  .refine(
    (val) => val === '' || (val.length >= 3 && val.length <= 30),
    'Username must be 3-30 characters'
  )
  .refine(
    (val) => val === '' || /^[a-zA-Z0-9_-]+$/.test(val),
    'Username can only contain letters, numbers, underscores, and dashes'
  );

export const optionalDisplayNameSchema = z
  .string()
  .transform((val) => val.trim())
  .refine(
    (val) => val === '' || val.length <= 100,
    'Display name must be less than 100 characters'
  )
  .refine(
    (val) => val === '' || /^[\p{L}\p{N}\p{P}\p{S}\s]+$/u.test(val),
    'Display name contains invalid characters'
  );

// Profile update schema
export const profileUpdateSchema = z.object({
  displayName: optionalDisplayNameSchema.optional(),
  username: optionalUsernameSchema.optional(),
});

// Email validation
export const emailSchema = z
  .string()
  .email('Please enter a valid email address')
  .max(255, 'Email must be less than 255 characters')
  .transform((val) => val.trim().toLowerCase());

// Password validation
export const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .max(128, 'Password must be less than 128 characters');

// Sign in form schema
export const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

// Sign up form schema
export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

/**
 * Validate and sanitize profile update data
 * Returns validated data or throws an error with user-friendly message
 */
export function validateProfileUpdate(data: { displayName?: string; username?: string }) {
  const result = profileUpdateSchema.safeParse(data);
  
  if (!result.success) {
    const firstError = result.error.errors[0];
    throw new Error(firstError.message);
  }
  
  return {
    displayName: result.data.displayName || null,
    username: result.data.username || null,
  };
}

/**
 * Validate sign in data
 */
export function validateSignIn(data: { email: string; password: string }) {
  const result = signInSchema.safeParse(data);
  
  if (!result.success) {
    const firstError = result.error.errors[0];
    throw new Error(firstError.message);
  }
  
  return result.data;
}

/**
 * Validate sign up data
 */
export function validateSignUp(data: { email: string; password: string; confirmPassword: string }) {
  const result = signUpSchema.safeParse(data);
  
  if (!result.success) {
    const firstError = result.error.errors[0];
    throw new Error(firstError.message);
  }
  
  return result.data;
}
