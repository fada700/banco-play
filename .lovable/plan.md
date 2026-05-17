# Fase 4 — Paneles staff reforzados + mejoras UX

## 1. Rutas y flujo de login para staff

Nuevas rutas públicas (fuera de `_authenticated`):

- `/admin-login` — pantalla dedicada "Acceso administradores"
- `/trabajador-login` — pantalla dedicada "Acceso trabajadores"

Cada una:
- Botón "Continuar con Discord" (mismo OAuth que login normal, pero con `state` que marca el rol esperado).
- Tras el callback, se valida el rol del usuario (admin / trabajador). Si NO tiene el rol → mensaje "No tienes acceso" + botón cerrar sesión, sin redirigir al home.
- Si sí lo tiene → redirige a `/admin` o `/trabajador-panel`.

Cambios de URL:
- `/trabajador` → renombrar a `/trabajador-panel` (más explícito como pediste).
- `/admin` se queda igual.

Guard reforzado en `_authenticated/admin.tsx` y `_authenticated/trabajador-panel.tsx`:
- Si no autenticado → `redirect → /admin-login` o `/trabajador-login` (no al `/login` general).
- Si autenticado pero sin rol → pantalla "Sin acceso" con botón "Cerrar sesión y volver".

## 2. Bloqueo de PWA en paneles staff

En `_authenticated/admin.tsx` y `_authenticated/trabajador-panel.tsx`, hook que detecta:
```ts
window.matchMedia('(display-mode: standalone)').matches
  || (navigator as any).standalone === true
```
Si es true → pantalla "Por seguridad, el panel de staff no funciona en la app instalada. Ábrelo en navegador (móvil o PC): banco-play.lovable.app/admin".

Aplica solo a estas dos rutas; el resto de la app sigue funcionando como PWA.

## 3. CVV obligatorio en montos grandes (>$35,000)

En `/transferir` y `/retirar`:
- Si `monto > 35000`, antes de confirmar pedir CVV de la tarjeta de débito.
- Nueva server fn `verificarCvv(cvv)` que compara con `tarjetas_debito.cvv` del usuario (usando `current_usuario_id()`).
- Si falla → error "CVV incorrecto", bloquea operación.
- Si éxito → continúa con la transferencia/retiro normal.

UI: modal compacto con NumPad de 3 dígitos.

## 4. Solicitudes de tarjeta de crédito → panel trabajador

Ya existe `solicitar_tarjeta_credito` insertando en `solicitudes`, y `listarSolicitudes` ya las muestra. Verificar que el flujo desde `/credito` realmente cree la solicitud con `tipo='tarjeta_credito'` y aparezca en `/trabajador-panel`. Si falta, se ajusta.

## 5. UI tarjetas (débito y crédito) más viva

Las tarjetas actuales usan gradientes muy sutiles sobre `bg-surface`. Se rehacen como tarjetas reales tipo Banorte (basado en las referencias que mandaste):

- **Débito básica**: rojo intenso con patrón geométrico sutil, logo "PlayBank", chip dorado, contactless, número formateado, marca "VISA Platinum" abajo.
- **Débito Plus**: negro con franja tricolor (verde/blanco/rojo) tipo edición selección mexicana.
- **Débito Black**: negro mate con detalles dorados.
- **Crédito**: gris platino con gradiente metálico, chip + contactless prominentes.

Archivos que se tocan para esto (también te los dejo listados para que puedas ajustar tú):
- `src/components/CreditCard.tsx` (nuevo) — tarjeta de crédito
- `src/components/DebitCard.tsx` (nuevo) — tarjeta de débito con variant por membresía
- `src/routes/_authenticated/tarjetas.tsx` — usa `DebitCard`
- `src/routes/_authenticated/credito.tsx` — usa `CreditCard`
- `src/styles.css` — añadir tokens `--card-red`, `--card-gold`, `--card-platinum`, gradientes

## 6. Rendimiento

- `staleTime: 30s` en queries de panel staff (`buscar`, `ganancias`, `sols`, `deudores`) para evitar refetch en cada navegación.
- Lazy load de `/admin` y `/trabajador-panel` (TanStack ya code-splittea por ruta automáticamente, verificar que no haya imports innecesarios).
- Quitar `enabled: !!isAdmin` dependiente de `me` por `enabled: me?.roles.includes('admin')` para no disparar queries antes.

## Detalles técnicos

- El bloqueo PWA es solo client-side (UX), no es seguridad real — la seguridad real sigue siendo el rol en DB validado server-side en cada `assertStaff`.
- CVV se verifica server-side comparando texto plano (como ya está guardado en `tarjetas_debito.cvv`). No se loguea.
- Rate limit de intentos CVV: máx 3 por sesión, luego bloquea la operación 5 min (estado en memoria del cliente, suficiente para UX; el server function valida en cada llamada).

## Archivos a crear/editar

Crear:
- `src/routes/admin-login.tsx`
- `src/routes/trabajador-login.tsx`
- `src/routes/_authenticated/trabajador-panel.tsx` (mueve trabajador.tsx)
- `src/components/CreditCard.tsx`
- `src/components/DebitCard.tsx`
- `src/components/CvvDialog.tsx`
- `src/hooks/use-is-pwa.ts`

Editar:
- `src/routes/_authenticated/admin.tsx` (guard PWA + login dedicado + sin-acceso)
- `src/routes/_authenticated/transferir.tsx` (CVV >35k)
- `src/routes/_authenticated/retirar.tsx` (CVV >35k)
- `src/routes/_authenticated/tarjetas.tsx` (usar DebitCard)
- `src/routes/_authenticated/credito.tsx` (usar CreditCard)
- `src/routes/_authenticated/perfil.tsx` (links a `/admin-login` y `/trabajador-login` cuando no esté logeado como staff; a paneles directos si sí)
- `src/routes/_authenticated.tsx` (ocultar navbar también en `/trabajador-panel`)
- `src/lib/auth.functions.ts` (server fn `verificarCvv`)
- `src/styles.css` (tokens de color para tarjetas)
- Eliminar `src/routes/_authenticated/trabajador.tsx` (movido)

Migración mínima: ninguna nueva si `solicitar_tarjeta_credito` ya inserta en `solicitudes`. Verifico antes de cerrar la fase.

¿Apruebas? Una vez confirmes empiezo con todo de una.