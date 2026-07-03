GRANT SELECT, INSERT, UPDATE, DELETE ON public.chats TO authenticated;
GRANT ALL ON public.chats TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;