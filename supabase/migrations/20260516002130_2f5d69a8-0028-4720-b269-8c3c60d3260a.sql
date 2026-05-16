
-- ============================================
-- FASE 3: Tarjeta de crédito, solicitudes, panel admin/trabajador
-- ============================================

-- Helper: ID del dueño (usuario_id) según config.dueno_discord_id
CREATE OR REPLACE FUNCTION public.dueno_usuario_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id FROM public.usuarios u
  JOIN public.config c ON c.id = 1
  WHERE u.discord_id = c.dueno_discord_id
  LIMIT 1
$$;

-- Helper: registra ganancia y, si hay dueño definido, le acredita el monto al saldo_banco
CREATE OR REPLACE FUNCTION public.registrar_ganancia(_concepto text, _usuario uuid, _monto numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner_id uuid;
BEGIN
  IF _monto IS NULL OR _monto <= 0 THEN RETURN; END IF;
  INSERT INTO public.ganancias_banco(concepto, usuario_id, monto) VALUES (_concepto, _usuario, _monto);
  owner_id := public.dueno_usuario_id();
  IF owner_id IS NOT NULL THEN
    UPDATE public.usuarios SET saldo_banco = saldo_banco + _monto WHERE id = owner_id;
    INSERT INTO public.movimientos(usuario_id, tipo, monto, descripcion)
      VALUES (owner_id, 'ganancia_banco', _monto, 'Ganancia: ' || _concepto);
  END IF;
END;
$$;

-- Patch op_transferir para acreditar comisión al dueño
CREATE OR REPLACE FUNCTION public.op_transferir(_destino_numero text, _monto numeric, _concepto text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := public.current_usuario_id();
  destino usuarios%ROWTYPE;
  origen usuarios%ROWTYPE;
  pct numeric;
  comision numeric;
  total numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF _monto IS NULL OR _monto <= 0 THEN RAISE EXCEPTION 'Monto inválido'; END IF;
  IF _destino_numero IS NULL OR length(_destino_numero) = 0 THEN RAISE EXCEPTION 'Destino requerido'; END IF;

  SELECT * INTO destino FROM usuarios WHERE numero_cliente = _destino_numero;
  IF destino.id IS NULL THEN RAISE EXCEPTION 'Cliente destino no existe'; END IF;
  IF destino.id = uid THEN RAISE EXCEPTION 'No puedes transferirte a ti mismo'; END IF;

  SELECT comision_porcentaje INTO pct FROM config WHERE id = 1;
  pct := COALESCE(pct, 0);
  comision := round((_monto * pct / 100)::numeric, 2);
  total := _monto + comision;

  SELECT * INTO origen FROM usuarios WHERE id = uid FOR UPDATE;
  IF origen.saldo_banco < total THEN RAISE EXCEPTION 'Saldo insuficiente. Necesitas %', total; END IF;

  UPDATE usuarios SET saldo_banco = saldo_banco - total WHERE id = uid;
  UPDATE usuarios SET saldo_banco = saldo_banco + _monto WHERE id = destino.id;

  INSERT INTO movimientos (usuario_id, tipo, monto, descripcion, contraparte_id)
    VALUES (uid, 'transferencia_enviada', _monto,
            'A ' || destino.nombre || ' (' || destino.numero_cliente || ')' ||
            CASE WHEN _concepto IS NOT NULL AND length(_concepto)>0 THEN ' — '||_concepto ELSE '' END,
            destino.id);
  INSERT INTO movimientos (usuario_id, tipo, monto, descripcion, contraparte_id)
    VALUES (destino.id, 'transferencia_recibida', _monto,
            'De ' || origen.nombre || ' (' || origen.numero_cliente || ')' ||
            CASE WHEN _concepto IS NOT NULL AND length(_concepto)>0 THEN ' — '||_concepto ELSE '' END,
            uid);

  IF comision > 0 THEN
    INSERT INTO movimientos (usuario_id, tipo, monto, descripcion)
      VALUES (uid, 'comision', comision, 'Comisión por transferencia');
    PERFORM public.registrar_ganancia('comision_transferencia', uid, comision);
  END IF;

  RETURN jsonb_build_object('monto', _monto, 'comision', comision, 'total', total,
    'destino_nombre', destino.nombre, 'destino_numero', destino.numero_cliente);
END;
$$;

-- ===============================
-- Tarjeta de crédito: solicitar, aprobar/rechazar, usar, pagar
-- ===============================

CREATE OR REPLACE FUNCTION public.solicitar_tarjeta_credito()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := public.current_usuario_id();
  tc tarjetas_credito%ROWTYPE;
  sol_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO tc FROM tarjetas_credito WHERE usuario_id = uid;
  IF tc.id IS NULL THEN
    INSERT INTO tarjetas_credito(usuario_id, estado) VALUES (uid, 'pendiente') RETURNING id INTO tc.id;
  ELSE
    IF tc.estado IN ('pendiente','activa') THEN RAISE EXCEPTION 'Ya tienes una solicitud o tarjeta activa'; END IF;
    UPDATE tarjetas_credito SET estado='pendiente' WHERE id = tc.id;
  END IF;
  INSERT INTO solicitudes(usuario_id, tipo, estado) VALUES (uid, 'tarjeta_credito', 'pendiente') RETURNING id INTO sol_id;
  RETURN sol_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.aprobar_tarjeta_credito(_solicitud_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  staff uuid := public.current_usuario_id();
  s solicitudes%ROWTYPE;
  num text; cvv text; venc text;
BEGIN
  IF NOT (public.has_role('admin') OR public.has_role('trabajador')) THEN
    RAISE EXCEPTION 'No autorizado'; END IF;
  SELECT * INTO s FROM solicitudes WHERE id = _solicitud_id FOR UPDATE;
  IF s.id IS NULL OR s.tipo <> 'tarjeta_credito' THEN RAISE EXCEPTION 'Solicitud inválida'; END IF;
  IF s.estado <> 'pendiente' THEN RAISE EXCEPTION 'Solicitud ya resuelta'; END IF;

  num := '5' || lpad((floor(random()*999999999999999)::bigint)::text, 15, '0');
  cvv := lpad((floor(random()*999)::int)::text, 3, '0');
  venc := lpad((floor(random()*12)::int + 1)::text, 2, '0') || '/' || to_char(now() + interval '4 years', 'YY');

  UPDATE tarjetas_credito
    SET estado='activa', numero=num, cvv=cvv, vencimiento=venc, limite=COALESCE(limite,5000)
    WHERE usuario_id = s.usuario_id;
  UPDATE solicitudes SET estado='aprobada', resuelta_por=staff, resuelta_en=now() WHERE id=s.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rechazar_tarjeta_credito(_solicitud_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE staff uuid := public.current_usuario_id(); s solicitudes%ROWTYPE;
BEGIN
  IF NOT (public.has_role('admin') OR public.has_role('trabajador')) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  SELECT * INTO s FROM solicitudes WHERE id = _solicitud_id FOR UPDATE;
  IF s.id IS NULL OR s.tipo <> 'tarjeta_credito' THEN RAISE EXCEPTION 'Solicitud inválida'; END IF;
  IF s.estado <> 'pendiente' THEN RAISE EXCEPTION 'Solicitud ya resuelta'; END IF;
  UPDATE tarjetas_credito SET estado='rechazada' WHERE usuario_id = s.usuario_id;
  UPDATE solicitudes SET estado='rechazada', resuelta_por=staff, resuelta_en=now() WHERE id=s.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.usar_credito(_monto numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := public.current_usuario_id();
  tc tarjetas_credito%ROWTYPE;
  disponible numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF _monto IS NULL OR _monto <= 0 THEN RAISE EXCEPTION 'Monto inválido'; END IF;
  SELECT * INTO tc FROM tarjetas_credito WHERE usuario_id = uid FOR UPDATE;
  IF tc.id IS NULL OR tc.estado <> 'activa' THEN RAISE EXCEPTION 'No tienes tarjeta de crédito activa'; END IF;
  disponible := tc.limite - tc.saldo_usado;
  IF _monto > disponible THEN RAISE EXCEPTION 'Excede tu límite disponible (%)', disponible; END IF;

  UPDATE tarjetas_credito
    SET saldo_usado = saldo_usado + _monto,
        fecha_uso = COALESCE(fecha_uso, now()),
        fecha_limite_pago = COALESCE(fecha_limite_pago, now() + interval '6 days')
    WHERE id = tc.id;
  UPDATE usuarios SET saldo_banco = saldo_banco + _monto WHERE id = uid;
  INSERT INTO movimientos(usuario_id, tipo, monto, descripcion)
    VALUES (uid, 'uso_credito', _monto, 'Uso de crédito');
END;
$$;

CREATE OR REPLACE FUNCTION public.pagar_credito(_monto numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := public.current_usuario_id();
  tc tarjetas_credito%ROWTYPE;
  u usuarios%ROWTYPE;
  pago numeric;
  liquidada boolean := false;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF _monto IS NULL OR _monto <= 0 THEN RAISE EXCEPTION 'Monto inválido'; END IF;
  SELECT * INTO tc FROM tarjetas_credito WHERE usuario_id = uid FOR UPDATE;
  IF tc.id IS NULL OR tc.saldo_usado <= 0 THEN RAISE EXCEPTION 'No tienes deuda'; END IF;

  SELECT * INTO u FROM usuarios WHERE id = uid FOR UPDATE;
  pago := LEAST(_monto, tc.saldo_usado);
  IF u.saldo_banco < pago THEN RAISE EXCEPTION 'Saldo insuficiente en banco'; END IF;

  UPDATE usuarios SET saldo_banco = saldo_banco - pago WHERE id = uid;
  UPDATE tarjetas_credito SET saldo_usado = saldo_usado - pago WHERE id = tc.id;
  INSERT INTO movimientos(usuario_id, tipo, monto, descripcion)
    VALUES (uid, 'pago_credito', pago, 'Pago a tarjeta de crédito');

  IF (tc.saldo_usado - pago) <= 0 THEN
    liquidada := true;
    UPDATE tarjetas_credito
      SET fecha_uso = NULL, fecha_limite_pago = NULL, dias_vencidos = 0,
          pagos_a_tiempo = pagos_a_tiempo + 1,
          score = LEAST(100, score + 5),
          estado = CASE WHEN estado='bloqueada' THEN 'activa' ELSE estado END
      WHERE id = tc.id;
  END IF;

  RETURN jsonb_build_object('pagado', pago, 'liquidada', liquidada);
END;
$$;

-- ===============================
-- Trabajador / Admin: ajustes
-- ===============================

CREATE OR REPLACE FUNCTION public.ajustar_limite_credito(_usuario_id uuid, _nuevo_limite numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role('admin') OR public.has_role('trabajador')) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF _nuevo_limite < 0 OR _nuevo_limite > 10000000 THEN RAISE EXCEPTION 'Límite inválido'; END IF;
  UPDATE tarjetas_credito SET limite = _nuevo_limite WHERE usuario_id = _usuario_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.condonar_deuda(_usuario_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE deuda numeric;
BEGIN
  IF NOT (public.has_role('admin') OR public.has_role('trabajador')) THEN RAISE EXCEPTION 'No autorizado'; END IF;
  SELECT saldo_usado INTO deuda FROM tarjetas_credito WHERE usuario_id = _usuario_id FOR UPDATE;
  IF deuda IS NULL OR deuda <= 0 THEN RAISE EXCEPTION 'Sin deuda que condonar'; END IF;
  UPDATE tarjetas_credito
    SET saldo_usado = 0, fecha_uso = NULL, fecha_limite_pago = NULL, dias_vencidos = 0,
        estado = CASE WHEN estado='bloqueada' THEN 'activa' ELSE estado END
    WHERE usuario_id = _usuario_id;
  INSERT INTO movimientos(usuario_id, tipo, monto, descripcion)
    VALUES (_usuario_id, 'condonacion', deuda, 'Deuda condonada');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_ajustar_saldo(_usuario_id uuid, _delta numeric, _cuenta text, _motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE u usuarios%ROWTYPE;
BEGIN
  IF NOT public.has_role('admin') THEN RAISE EXCEPTION 'Solo admin'; END IF;
  IF _delta = 0 THEN RAISE EXCEPTION 'Monto inválido'; END IF;
  IF _cuenta NOT IN ('banco','cartera') THEN RAISE EXCEPTION 'Cuenta inválida'; END IF;

  SELECT * INTO u FROM usuarios WHERE id = _usuario_id FOR UPDATE;
  IF u.id IS NULL THEN RAISE EXCEPTION 'Usuario no encontrado'; END IF;

  IF _cuenta = 'banco' THEN
    IF u.saldo_banco + _delta < 0 THEN RAISE EXCEPTION 'Saldo banco quedaría negativo'; END IF;
    UPDATE usuarios SET saldo_banco = saldo_banco + _delta WHERE id = u.id;
  ELSE
    IF u.saldo_cartera + _delta < 0 THEN RAISE EXCEPTION 'Saldo cartera quedaría negativo'; END IF;
    UPDATE usuarios SET saldo_cartera = saldo_cartera + _delta WHERE id = u.id;
  END IF;

  INSERT INTO movimientos(usuario_id, tipo, monto, descripcion)
    VALUES (u.id,
            CASE WHEN _delta > 0 THEN 'admin_dar' ELSE 'admin_quitar' END,
            abs(_delta),
            'Admin (' || _cuenta || ')' || CASE WHEN _motivo IS NOT NULL AND length(_motivo)>0 THEN ' — '||_motivo ELSE '' END);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_dueno_banco(_discord_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role('admin') THEN RAISE EXCEPTION 'Solo admin'; END IF;
  UPDATE config SET dueno_discord_id = NULLIF(_discord_id, '') WHERE id = 1;
END;
$$;
