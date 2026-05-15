
-- Atomic money operations

CREATE OR REPLACE FUNCTION public.op_depositar(_monto numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := public.current_usuario_id();
  cartera numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF _monto IS NULL OR _monto <= 0 THEN RAISE EXCEPTION 'Monto inválido'; END IF;

  SELECT saldo_cartera INTO cartera FROM usuarios WHERE id = uid FOR UPDATE;
  IF cartera < _monto THEN RAISE EXCEPTION 'Saldo insuficiente en cartera'; END IF;

  UPDATE usuarios
    SET saldo_cartera = saldo_cartera - _monto,
        saldo_banco = saldo_banco + _monto
    WHERE id = uid;

  INSERT INTO movimientos (usuario_id, tipo, monto, descripcion)
    VALUES (uid, 'deposito', _monto, 'Depósito a cuenta');
END;
$$;

CREATE OR REPLACE FUNCTION public.op_retirar(_monto numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := public.current_usuario_id();
  banco numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF _monto IS NULL OR _monto <= 0 THEN RAISE EXCEPTION 'Monto inválido'; END IF;

  SELECT saldo_banco INTO banco FROM usuarios WHERE id = uid FOR UPDATE;
  IF banco < _monto THEN RAISE EXCEPTION 'Saldo insuficiente en banco'; END IF;

  UPDATE usuarios
    SET saldo_banco = saldo_banco - _monto,
        saldo_cartera = saldo_cartera + _monto
    WHERE id = uid;

  INSERT INTO movimientos (usuario_id, tipo, monto, descripcion)
    VALUES (uid, 'retiro', _monto, 'Retiro a cartera');
END;
$$;

CREATE OR REPLACE FUNCTION public.op_transferir(_destino_numero text, _monto numeric, _concepto text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  IF origen.saldo_banco < total THEN
    RAISE EXCEPTION 'Saldo insuficiente. Necesitas %', total;
  END IF;

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
    INSERT INTO ganancias_banco (concepto, usuario_id, monto)
      VALUES ('comision_transferencia', uid, comision);
  END IF;

  RETURN jsonb_build_object('monto', _monto, 'comision', comision, 'total', total,
    'destino_nombre', destino.nombre, 'destino_numero', destino.numero_cliente);
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_tarjeta_debito()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := public.current_usuario_id();
  nuevo boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  UPDATE tarjetas_debito SET congelada = NOT congelada
    WHERE usuario_id = uid
    RETURNING congelada INTO nuevo;
  RETURN nuevo;
END;
$$;
