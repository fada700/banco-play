# Plan: Banco De Mexico PWA

Proyecto extenso. Lo dividiré en fases entregables. Antes de empezar necesito confirmar algunos puntos clave porque condicionan toda la arquitectura.

## Preguntas bloqueantes

1. **Bot de Discord**: ¿Tienes ya un bot creado con token? El bot es necesario para:
   - Enviar el código de 4 dígitos al DM (login 2FA)
   - Enviar DMs de confirmación de cada operación
   - Verificar roles de trabajador/admin
   
   Necesitaré: `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_GUILD_ID`, `ROLE_ID_TRABAJADOR`, `ROLE_ID_ADMIN`.

2. **Discord OAuth redirect**: Usaré la URL del preview de Lovable. ¿OK?

3. **Cron jobs**: Los intereses diarios del 5%, recordatorios de pago, bloqueo de tarjeta el día 9, y cobros de membresía mensuales requieren tareas programadas. Usaré `pg_cron` de Supabase.

## Arquitectura

- **Frontend**: TanStack Start, mobile-first, Tailwind con tokens en `oklch`, fuentes Outfit + JetBrains Mono, manifest PWA (sin service worker para evitar problemas de cache).
- **Backend**: Lovable Cloud (Supabase). Server functions de TanStack para toda la lógica (auth, transacciones, bot DMs).
- **Auth**: Discord OAuth2 → genera código 4 dígitos → bot lo manda por DM → usuario lo ingresa → sesión Supabase. Bloqueo 5 min tras 3 fallos.
- **Roles**: detectados al login leyendo roles del usuario en el guild → redirige a `/`, `/trabajadores` o `/admin`.

## Fases de entrega

### Fase 1 — Fundación (esta entrega)
- Design system completo (paleta, fuentes, tokens)
- Manifest PWA + íconos + splash
- Schema Supabase completo (8 tablas + RLS + triggers)
- Pantalla splash + login Discord OAuth + pantalla de código 4 dígitos con teclado
- Edge logic: generar código, mandar DM vía bot, validar, bloqueo 5 min
- Home de usuario: header, saludo, cards Cartera/Banco con ojito, tarjeta débito con flip CVV, 3 botones acción, últimos 5 movimientos
- Generación automática de tarjeta de débito al crear cuenta

### Fase 2 — Operaciones
- Depositar / Retirar / Transferir (con búsqueda destinatario, comisión 1.5%, NIP, animación éxito, DMs bot)
- Historial completo con filtros
- Perfil (cambiar NIP, cerrar sesión)

### Fase 3 — Crédito y Membresías
- Solicitar tarjeta crédito, niveles, score
- Membresías Plus/Black con cobro automático
- Cron: recordatorios día 1-5, interés 5% día 6+, bloqueo día 9, cobro auto
- Acreditación de ganancias al dueño + DM

### Fase 4 — Paneles
- Panel Trabajadores: aprobar tarjetas, ver deudores, subir/bajar límite, condonar deuda
- Panel Admin: buscador, dar/quitar dinero, dashboard ganancias (día/semana/mes), config dueño

## Detalles técnicos

- Tokens de color en `oklch` en `src/styles.css`; clases semánticas (`bg-card-debit`, `text-money-in`, etc.)
- NIP: hash con bcrypt (server-side)
- Número de tarjeta/CVV: generados aleatorios, guardados encriptados
- Comisión 1.5% y todos los intereses → `INSERT` en `ganancias_banco` + `UPDATE` saldo_banco del dueño (leído de tabla `config`)
- Bot DMs: helper `sendDiscordDM(userId, embed)` server-side llamando `https://discord.com/api/v10/users/@me/channels` + `/channels/{id}/messages`

## Confirmación

¿Procedo con la **Fase 1** una vez me confirmes el bot de Discord y me proporciones los secrets? Si no tienes el bot aún, te guío paso a paso para crearlo en el Discord Developer Portal antes de empezar.
