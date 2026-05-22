
ALTER TABLE public.config 
  ADD COLUMN IF NOT EXISTS costo_hackeo numeric NOT NULL DEFAULT 15000,
  ADD COLUMN IF NOT EXISTS costo_antivirus numeric NOT NULL DEFAULT 8000,
  ADD COLUMN IF NOT EXISTS cooldown_hackeo_horas integer NOT NULL DEFAULT 48;

ALTER TABLE public.usuarios 
  ADD COLUMN IF NOT EXISTS ultimo_hackeo timestamptz,
  ADD COLUMN IF NOT EXISTS antivirus_hasta timestamptz,
  ADD COLUMN IF NOT EXISTS hackeo_targets jsonb,
  ADD COLUMN IF NOT EXISTS hackeo_targets_en timestamptz;

CREATE TABLE IF NOT EXISTS public.hackeos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  atacante_id uuid NOT NULL,
  victima_id uuid NOT NULL,
  monto numeric NOT NULL DEFAULT 0,
  exito boolean NOT NULL,
  detalle text,
  fecha timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hackeos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver hackeos propios o staff" ON public.hackeos;
CREATE POLICY "Ver hackeos propios o staff" ON public.hackeos
  FOR SELECT USING (
    atacante_id = public.current_usuario_id() 
    OR victima_id = public.current_usuario_id() 
    OR public.has_role('admin') 
    OR public.has_role('trabajador')
  );

CREATE INDEX IF NOT EXISTS idx_hackeos_atacante ON public.hackeos(atacante_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_hackeos_victima ON public.hackeos(victima_id, fecha DESC);

-- Antivirus
CREATE OR REPLACE FUNCTION public.op_comprar_antivirus()
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := public.current_usuario_id();
  u public.usuarios%ROWTYPE;
  costo numeric;
  nuevo timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT costo_antivirus INTO costo FROM public.config WHERE id = 1;
  SELECT * INTO u FROM public.usuarios WHERE id = uid FOR UPDATE;
  IF u.saldo_banco < costo THEN RAISE EXCEPTION 'Saldo insuficiente en banco (necesitas %)', costo; END IF;
  nuevo := GREATEST(COALESCE(u.antivirus_hasta, now()), now()) + interval '7 days';
  UPDATE public.usuarios SET saldo_banco = saldo_banco - costo, antivirus_hasta = nuevo WHERE id = uid;
  INSERT INTO public.movimientos(usuario_id, tipo, monto, descripcion)
    VALUES (uid, 'comision', costo, 'Compra: Antivirus (7 días de inmunidad)');
  PERFORM public.registrar_ganancia('compra_antivirus', uid, costo);
  RETURN nuevo;
END $$;

-- Escanear
CREATE OR REPLACE FUNCTION public.op_escanear_hackeo()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := public.current_usuario_id();
  u public.usuarios%ROWTYPE;
  costo numeric;
  cooldown_h int;
  targets jsonb;
  espera_seg numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT costo_hackeo, cooldown_hackeo_horas INTO costo, cooldown_h FROM public.config WHERE id = 1;
  SELECT * INTO u FROM public.usuarios WHERE id = uid FOR UPDATE;
  
  IF u.ultimo_hackeo IS NOT NULL 
     AND u.ultimo_hackeo + (cooldown_h || ' hours')::interval > now() THEN
    espera_seg := extract(epoch FROM (u.ultimo_hackeo + (cooldown_h || ' hours')::interval - now()));
    RAISE EXCEPTION 'Cooldown activo. Disponible en % horas', ceil(espera_seg/3600);
  END IF;
  
  IF u.saldo_banco < costo THEN 
    RAISE EXCEPTION 'Saldo insuficiente. El kit cuesta %', costo; 
  END IF;
  
  WITH candidatos AS (
    SELECT v.id, v.nombre, v.numero_cliente, v.saldo_banco, td.numero AS tarjeta, td.cvv, td.vencimiento
    FROM public.usuarios v
    LEFT JOIN public.tarjetas_debito td ON td.usuario_id = v.id
    WHERE v.id <> uid
      AND v.saldo_banco >= 5000
      AND (v.antivirus_hasta IS NULL OR v.antivirus_hasta < now())
      AND NOT EXISTS (
        SELECT 1 FROM public.roles_usuario r 
        WHERE r.usuario_id = v.id AND r.role IN ('admin','trabajador')
      )
    ORDER BY random()
    LIMIT 3
  )
  SELECT jsonb_agg(jsonb_build_object(
    'id', id,
    'nombre_mask', left(nombre, 2) || repeat('*', greatest(length(nombre)-3, 1)) || right(nombre, 1),
    'cliente_mask', left(numero_cliente, 3) || '****' || right(numero_cliente, 2),
    'tarjeta', COALESCE(tarjeta, '0000000000000000'),
    'cvv', COALESCE(cvv, '000'),
    'vencimiento', COALESCE(vencimiento, '00/00'),
    'saldo_aprox', round(saldo_banco / 1000) * 1000
  )) INTO targets FROM candidatos;
  
  IF targets IS NULL OR jsonb_array_length(targets) = 0 THEN
    RAISE EXCEPTION 'Sin objetivos disponibles ahora. Intenta más tarde';
  END IF;
  
  UPDATE public.usuarios SET 
    saldo_banco = saldo_banco - costo,
    ultimo_hackeo = now(),
    hackeo_targets = targets,
    hackeo_targets_en = now()
  WHERE id = uid;
  
  INSERT INTO public.movimientos(usuario_id, tipo, monto, descripcion)
    VALUES (uid, 'comision', costo, 'Compra: Kit de hackeo');
  PERFORM public.registrar_ganancia('compra_hackeo_kit', uid, costo);
  
  RETURN targets;
END $$;

-- Ejecutar
CREATE OR REPLACE FUNCTION public.op_ejecutar_hackeo(_victima_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := public.current_usuario_id();
  u public.usuarios%ROWTYPE;
  v public.usuarios%ROWTYPE;
  porcentaje numeric;
  monto numeric;
  prob_fallo numeric := 0.30;
  comision_banco numeric;
  neto numeric;
  target_match boolean := false;
  t jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT * INTO u FROM public.usuarios WHERE id = uid FOR UPDATE;
  
  IF u.hackeo_targets IS NULL OR u.hackeo_targets_en IS NULL 
     OR u.hackeo_targets_en + interval '5 minutes' < now() THEN
    RAISE EXCEPTION 'No hay objetivos activos. Vuelve a escanear';
  END IF;
  
  FOR t IN SELECT * FROM jsonb_array_elements(u.hackeo_targets) LOOP
    IF (t->>'id')::uuid = _victima_id THEN target_match := true; EXIT; END IF;
  END LOOP;
  IF NOT target_match THEN RAISE EXCEPTION 'Objetivo inválido'; END IF;
  
  -- Un solo intento: limpiar targets
  UPDATE public.usuarios SET hackeo_targets = NULL, hackeo_targets_en = NULL WHERE id = uid;
  
  SELECT * INTO v FROM public.usuarios WHERE id = _victima_id FOR UPDATE;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Objetivo no encontrado'; END IF;
  
  -- Antivirus = inmune
  IF v.antivirus_hasta IS NOT NULL AND v.antivirus_hasta > now() THEN
    INSERT INTO public.hackeos(atacante_id, victima_id, monto, exito, detalle)
      VALUES (uid, v.id, 0, false, 'Bloqueado por antivirus');
    RETURN jsonb_build_object('exito', false, 'razon', 'antivirus', 'monto', 0);
  END IF;
  
  IF v.membresia IN ('plus','black') THEN 
    prob_fallo := prob_fallo + 0.20; 
  END IF;
  
  IF random() < prob_fallo THEN
    INSERT INTO public.hackeos(atacante_id, victima_id, monto, exito, detalle)
      VALUES (uid, v.id, 0, false, 'Firewall detectó la intrusión');
    RETURN jsonb_build_object('exito', false, 'razon', 'firewall', 'monto', 0);
  END IF;
  
  porcentaje := 0.05 + random() * 0.10;
  monto := round(LEAST(v.saldo_banco * porcentaje, 20000)::numeric, 2);
  IF monto < 100 THEN monto := LEAST(v.saldo_banco, 100); END IF;
  
  comision_banco := round((monto * 0.10)::numeric, 2);
  neto := monto - comision_banco;
  
  UPDATE public.usuarios SET saldo_banco = saldo_banco - monto WHERE id = v.id;
  UPDATE public.usuarios SET saldo_cartera = saldo_cartera + neto WHERE id = uid;
  
  INSERT INTO public.movimientos(usuario_id, tipo, monto, descripcion, contraparte_id)
    VALUES (uid, 'admin_dar', neto, 'Hackeo exitoso: botín a cartera', v.id);
  INSERT INTO public.movimientos(usuario_id, tipo, monto, descripcion, contraparte_id)
    VALUES (v.id, 'admin_quitar', monto, 'Intrusión detectada: fondos sustraídos', uid);
  
  PERFORM public.registrar_ganancia('comision_hackeo', uid, comision_banco);
  
  INSERT INTO public.hackeos(atacante_id, victima_id, monto, exito, detalle)
    VALUES (uid, v.id, neto, true, 'Botín ' || monto || ' MXN, comisión ' || comision_banco);
  
  RETURN jsonb_build_object(
    'exito', true, 
    'monto', neto, 
    'bruto', monto,
    'comision', comision_banco,
    'victima_nombre', v.nombre
  );
END $$;
