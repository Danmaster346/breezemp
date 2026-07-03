
-- Ограничиваем чтение профилей: только свой профиль
DROP POLICY IF EXISTS profiles_select_auth ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

-- Ограничиваем чтение ролей: только свои роли
DROP POLICY IF EXISTS roles_select_auth ON public.user_roles;
CREATE POLICY roles_select_own ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Разрешаем самостоятельно назначать себе только роль 'buyer' (роль 'seller' выдаётся серверной функцией)
DROP POLICY IF EXISTS roles_insert_own ON public.user_roles;
CREATE POLICY roles_insert_buyer_only ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND role = 'buyer'::public.app_role);

-- Переписываем политику вставки товаров без вызова SECURITY DEFINER функции has_role
DROP POLICY IF EXISTS products_seller_insert ON public.products;
CREATE POLICY products_seller_insert ON public.products FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = seller_id
    AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'seller'::public.app_role)
  );

-- Убираем возможность вызова has_role обычными пользователями
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO service_role;
