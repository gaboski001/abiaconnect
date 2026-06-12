
DROP POLICY IF EXISTS "Users create replies" ON public.replies;
DROP POLICY IF EXISTS "Author or admin update reply" ON public.replies;
DROP POLICY IF EXISTS "Author or admin delete reply" ON public.replies;

CREATE POLICY "Users can insert replies under any parent"
  ON public.replies
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own replies"
  ON public.replies
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own replies"
  ON public.replies
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
