-- Add foreign key relationships for joins
ALTER TABLE public.user_credits 
ADD CONSTRAINT user_credits_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.credits_transactions 
ADD CONSTRAINT credits_transactions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

ALTER TABLE public.api_keys 
ADD CONSTRAINT api_keys_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;