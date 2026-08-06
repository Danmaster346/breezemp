CREATE POLICY "chat_files_insert_participant" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-files'
    AND public.is_conversation_participant(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "chat_files_select_participant" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-files'
    AND (
      public.is_conversation_participant(((storage.foldername(name))[1])::uuid, auth.uid())
      OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "chat_files_delete_owner" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'chat-files' AND owner = auth.uid());