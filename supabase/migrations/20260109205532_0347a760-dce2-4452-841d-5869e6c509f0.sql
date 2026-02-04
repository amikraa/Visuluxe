-- Make the avatars storage bucket private for enhanced security
-- This prevents unauthorized enumeration and access to user avatars
UPDATE storage.buckets 
SET public = false 
WHERE id = 'avatars';

-- Update storage policies to allow authenticated users to read their own avatars
-- Drop existing public read policy if it exists
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;

-- Create policy for authenticated users to read their own avatars
CREATE POLICY "Users can view their own avatars"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Ensure upload policy exists for users to upload their own avatars
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Ensure update policy exists for users to update their own avatars  
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Ensure delete policy exists for users to delete their own avatars
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);