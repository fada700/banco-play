
-- ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'trabajador', 'usuario');
CREATE TYPE public.tipo_movimiento AS ENUM ('deposito', 'retiro', 'transferencia_enviada', 'transferencia_recibida', 'comision', 'pago_credito', 'uso_credito', 'interes_credito', 'membresia', 'admin_dar', 'admin_quitar', 'condonacion', 'ganancia_banco');
CREATE TYPE public.tipo_membresia AS ENUM ('basica', 'plus', 'black');
CREATE TYPE public.estado_solicitud AS ENUM ('pendiente', 'aprobada', 'rechazada');
CREATE TYPE public.estado_credito AS ENUM ('sin_solicitar', 'pendiente', 'activa', 'bloqueada', 'rechazada');

-- USUARIOS
CREATE TABLE public.usuarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id TEXT NOT NULL UNIQUE,
  discord_username TEXT NOT NULL,
  discord_avatar_url TEXT,
  nombre TEXT NOT NULL,
  numero_cliente TEXT NOT NULL UNIQUE,
  saldo_cartera NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo_banco NUMERIC(14,2) NOT NULL DEFAULT 0,
  nip_hash TEXT,
  membresia public.tipo_membresia NOT NULL DEFAULT 'basica',
  intentos_fallidos INT NOT NULL DEFAULT 0,
  bloqueado_hasta TIMESTAMPTZ,
  fecha_registro TIMESTAMPTZ NOT NULL DEFAULT now(),
  auth_user_id UUID UNIQUE
);
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- ROLES
CREATE TABLE public.roles_usuario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE(usuario_id, role)
);
ALTER TABLE public.roles_usuario ENABLE ROW LEVEL SECURITY;

-- has_role helpers
CREATE OR REPLACE FUNCTION public.current_usuario_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.roles_usuario r
    JOIN public.usuarios u ON u.id = r.usuario_id
    WHERE u.auth_user_id = auth.uid() AND r.role = _role
  )
$$;

-- MOVIMIENTOS
CREATE TABLE public.movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tipo public.tipo_movimiento NOT NULL,
  monto NUMERIC(14,2) NOT NULL,
  descripcion TEXT NOT NULL,
  contraparte_id UUID REFERENCES public.usuarios(id),
  fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_movimientos_usuario ON public.movimientos(usuario_id, fecha DESC);
ALTER TABLE public.movimientos ENABLE ROW LEVEL SECURITY;

-- TARJETAS DEBITO
CREATE TABLE public.tarjetas_debito (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL UNIQUE REFERENCES public.usuarios(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  cvv TEXT NOT NULL,
  vencimiento TEXT NOT NULL,
  congelada BOOLEAN NOT NULL DEFAULT false,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tarjetas_debito ENABLE ROW LEVEL SECURITY;

-- TARJETAS CREDITO
CREATE TABLE public.tarjetas_credito (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL UNIQUE REFERENCES public.usuarios(id) ON DELETE CASCADE,
  numero TEXT,
  cvv TEXT,
  vencimiento TEXT,
  limite NUMERIC(14,2) NOT NULL DEFAULT 5000,
  saldo_usado NUMERIC(14,2) NOT NULL DEFAULT 0,
  nivel INT NOT NULL DEFAULT 1,
  estado public.estado_credito NOT NULL DEFAULT 'sin_solicitar',
  fecha_uso TIMESTAMPTZ,
  fecha_limite_pago TIMESTAMPTZ,
  dias_vencidos INT NOT NULL DEFAULT 0,
  pagos_a_tiempo INT NOT NULL DEFAULT 0,
  score INT NOT NULL DEFAULT 50
);
ALTER TABLE public.tarjetas_credito ENABLE ROW LEVEL SECURITY;

-- SOLICITUDES
CREATE TABLE public.solicitudes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  estado public.estado_solicitud NOT NULL DEFAULT 'pendiente',
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  resuelta_en TIMESTAMPTZ,
  resuelta_por UUID REFERENCES public.usuarios(id)
);
ALTER TABLE public.solicitudes ENABLE ROW LEVEL SECURITY;

-- MEMBRESIAS
CREATE TABLE public.membresias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  tipo public.tipo_membresia NOT NULL,
  fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_renovacion TIMESTAMPTZ NOT NULL,
  activa BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.membresias ENABLE ROW LEVEL SECURITY;

-- CONFIG (singleton)
CREATE TABLE public.config (
  id INT PRIMARY KEY DEFAULT 1,
  dueno_discord_id TEXT,
  comision_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 1.5,
  interes_diario_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 5.0,
  costo_membresia_plus NUMERIC(14,2) NOT NULL DEFAULT 75000,
  costo_membresia_black NUMERIC(14,2) NOT NULL DEFAULT 350000,
  CONSTRAINT singleton CHECK (id = 1)
);
INSERT INTO public.config (id) VALUES (1);
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;

-- GANANCIAS
CREATE TABLE public.ganancias_banco (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concepto TEXT NOT NULL,
  usuario_id UUID REFERENCES public.usuarios(id),
  monto NUMERIC(14,2) NOT NULL,
  fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ganancias_fecha ON public.ganancias_banco(fecha DESC);
ALTER TABLE public.ganancias_banco ENABLE ROW LEVEL SECURITY;

-- LOGIN CODIGOS (2FA)
CREATE TABLE public.login_codigos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_id TEXT NOT NULL,
  codigo_hash TEXT NOT NULL,
  intentos INT NOT NULL DEFAULT 0,
  expira_en TIMESTAMPTZ NOT NULL,
  usado BOOLEAN NOT NULL DEFAULT false,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_login_codigos_discord ON public.login_codigos(discord_id, creado_en DESC);
ALTER TABLE public.login_codigos ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES
-- usuarios: el propio usuario lee/edita; staff lee todo
CREATE POLICY "Usuarios ven su propio perfil" ON public.usuarios
  FOR SELECT USING (auth_user_id = auth.uid() OR public.has_role('admin') OR public.has_role('trabajador'));
CREATE POLICY "Usuarios editan su propio perfil" ON public.usuarios
  FOR UPDATE USING (auth_user_id = auth.uid() OR public.has_role('admin'));
CREATE POLICY "Admin inserta usuarios" ON public.usuarios
  FOR INSERT WITH CHECK (true);

-- roles
CREATE POLICY "Lectura roles propios o admin" ON public.roles_usuario
  FOR SELECT USING (usuario_id = public.current_usuario_id() OR public.has_role('admin'));
CREATE POLICY "Admin gestiona roles" ON public.roles_usuario
  FOR ALL USING (public.has_role('admin')) WITH CHECK (public.has_role('admin'));

-- movimientos
CREATE POLICY "Ver movimientos propios o staff" ON public.movimientos
  FOR SELECT USING (usuario_id = public.current_usuario_id() OR public.has_role('admin') OR public.has_role('trabajador'));

-- tarjetas debito
CREATE POLICY "Ver tarjeta propia o staff" ON public.tarjetas_debito
  FOR SELECT USING (usuario_id = public.current_usuario_id() OR public.has_role('admin') OR public.has_role('trabajador'));
CREATE POLICY "Editar tarjeta propia" ON public.tarjetas_debito
  FOR UPDATE USING (usuario_id = public.current_usuario_id());

-- tarjetas credito
CREATE POLICY "Ver credito propio o staff" ON public.tarjetas_credito
  FOR SELECT USING (usuario_id = public.current_usuario_id() OR public.has_role('admin') OR public.has_role('trabajador'));

-- solicitudes
CREATE POLICY "Ver solicitudes propias o staff" ON public.solicitudes
  FOR SELECT USING (usuario_id = public.current_usuario_id() OR public.has_role('admin') OR public.has_role('trabajador'));
CREATE POLICY "Crear solicitudes propias" ON public.solicitudes
  FOR INSERT WITH CHECK (usuario_id = public.current_usuario_id());

-- membresias
CREATE POLICY "Ver membresias propias o staff" ON public.membresias
  FOR SELECT USING (usuario_id = public.current_usuario_id() OR public.has_role('admin') OR public.has_role('trabajador'));

-- config
CREATE POLICY "Lectura config staff" ON public.config
  FOR SELECT USING (public.has_role('admin') OR public.has_role('trabajador'));
CREATE POLICY "Admin edita config" ON public.config
  FOR UPDATE USING (public.has_role('admin'));

-- ganancias
CREATE POLICY "Staff ve ganancias" ON public.ganancias_banco
  FOR SELECT USING (public.has_role('admin') OR public.has_role('trabajador'));

-- login_codigos: ningún acceso desde el cliente (solo service role)
-- (sin policies = nadie puede leer/escribir vía RLS)

-- numero de cliente generador
CREATE OR REPLACE FUNCTION public.generar_numero_cliente()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  num TEXT;
BEGIN
  num := 'BMX' || lpad((floor(random()*9999999)::int)::text, 7, '0');
  RETURN num;
END;
$$;

-- generar tarjeta debito al insertar usuario
CREATE OR REPLACE FUNCTION public.crear_tarjeta_debito_inicial()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  num TEXT;
  cvv TEXT;
  venc TEXT;
BEGIN
  num := '4' || lpad((floor(random()*999999999999999)::bigint)::text, 15, '0');
  cvv := lpad((floor(random()*999)::int)::text, 3, '0');
  venc := lpad((floor(random()*12)::int + 1)::text, 2, '0') || '/' || to_char(now() + interval '4 years', 'YY');
  INSERT INTO public.tarjetas_debito(usuario_id, numero, cvv, vencimiento)
  VALUES (NEW.id, num, cvv, venc);
  INSERT INTO public.roles_usuario(usuario_id, role) VALUES (NEW.id, 'usuario');
  INSERT INTO public.tarjetas_credito(usuario_id, estado) VALUES (NEW.id, 'sin_solicitar');
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_crear_tarjeta_debito
  AFTER INSERT ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.crear_tarjeta_debito_inicial();
