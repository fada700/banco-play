
-- Fix: aprobar_tarjeta_credito ahora es defensivo: crea la fila tarjetas_credito si no existe
-- y reporta mensajes de error más útiles.
CREATE OR REPLACE FUNCTION public.aprobar_tarjeta_credito(_solicitud_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  staff uuid := public.current_usuario_id();
  s solicitudes%ROWTYPE;
  tc tarjetas_credito%ROWTYPE;
  num text; ncvv text; venc text;
BEGIN
  IF NOT (public.has_role('admin') OR public.has_role('trabajador')) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO s FROM solicitudes WHERE id = _solicitud_id FOR UPDATE;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF s.tipo <> 'tarjeta_credito' THEN RAISE EXCEPTION 'Tipo de solicitud no es tarjeta_credito (%)', s.tipo; END IF;
  IF s.estado <> 'pendiente' THEN RAISE EXCEPTION 'Solicitud ya resuelta (%)', s.estado; END IF;

  num  := '5' || lpad((floor(random()*999999999999999)::bigint)::text, 15, '0');
  ncvv := lpad((floor(random()*999)::int)::text, 3, '0');
  venc := lpad((floor(random()*12)::int + 1)::text, 2, '0') || '/' || to_char(now() + interval '4 years', 'YY');

  SELECT * INTO tc FROM tarjetas_credito WHERE usuario_id = s.usuario_id FOR UPDATE;
  IF tc.id IS NULL THEN
    INSERT INTO tarjetas_credito(usuario_id, estado, numero, cvv, vencimiento, limite)
    VALUES (s.usuario_id, 'activa', num, ncvv, venc, 5000);
  ELSE
    UPDATE tarjetas_credito
      SET estado='activa', numero=num, cvv=ncvv, vencimiento=venc,
          limite = COALESCE(NULLIF(limite,0), 5000)
      WHERE id = tc.id;
  END IF;

  UPDATE solicitudes SET estado='aprobada', resuelta_por=staff, resuelta_en=now() WHERE id=s.id;
END;
$$;

-- Fix: set_dueno_banco valida que el discord_id corresponda a un usuario registrado
CREATE OR REPLACE FUNCTION public.set_dueno_banco(_discord_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE clean text := NULLIF(trim(_discord_id), '');
BEGIN
  IF NOT public.has_role('admin') THEN RAISE EXCEPTION 'Solo admin'; END IF;
  IF clean IS NULL THEN
    UPDATE config SET dueno_discord_id = NULL WHERE id = 1;
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM usuarios WHERE discord_id = clean) THEN
    RAISE EXCEPTION 'Ese Discord ID no está registrado en el banco';
  END IF;
  UPDATE config SET dueno_discord_id = clean WHERE id = 1;
END;
$$;
