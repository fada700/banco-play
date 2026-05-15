
-- Fix search_path
CREATE OR REPLACE FUNCTION public.generar_numero_cliente()
RETURNS TEXT LANGUAGE plpgsql SET search_path = public AS $$
DECLARE num TEXT;
BEGIN
  num := 'BMX' || lpad((floor(random()*9999999)::int)::text, 7, '0');
  RETURN num;
END;
$$;

-- Revoke public execute from SECURITY DEFINER functions (still callable from server with service_role)
REVOKE EXECUTE ON FUNCTION public.crear_tarjeta_debito_inicial() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_usuario_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_usuario_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(public.app_role) TO authenticated;

-- Tighten "Admin inserta usuarios": restringir a admins (los nuevos usuarios se insertan via service_role en server fn, que bypasa RLS)
DROP POLICY IF EXISTS "Admin inserta usuarios" ON public.usuarios;
CREATE POLICY "Admin inserta usuarios" ON public.usuarios
  FOR INSERT WITH CHECK (public.has_role('admin'));
