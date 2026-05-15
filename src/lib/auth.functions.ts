import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  exchangeOAuthCode,
  fetchDiscordUser,
  fetchUserRoles,
  fetchCurrentUserGuildRoles,
  discordAvatarUrl,
  sendDM,
} from "./discord.server";
import { DISCORD_GUILD_ID, DISCORD_OAUTH_SCOPES, ROLE_ID_ADMIN, ROLE_ID_TRABAJADOR } from "./discord-config";

async function derivePassword(discordId: string): Promise<string> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "fallback";
  const data = new TextEncoder().encode(`${discordId}:${secret}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function userEmail(discordId: string): string {
  return `${discordId}@bancomx.local`;
}

async function ensureUsuario(discord: {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}): Promise<{ usuario_id: string; auth_user_id: string }> {
  const email = userEmail(discord.id);
  const password = await derivePassword(discord.id);
  const nombre = discord.global_name ?? discord.username;
  const avatar_url = discordAvatarUrl(discord.id, discord.avatar);

  const { data: existing } = await supabaseAdmin
    .from("usuarios")
    .select("id, auth_user_id")
    .eq("discord_id", discord.id)
    .maybeSingle();

  if (existing?.auth_user_id) {
    await supabaseAdmin
      .from("usuarios")
      .update({ nombre, discord_username: discord.username, discord_avatar_url: avatar_url })
      .eq("id", existing.id);
    return { usuario_id: existing.id, auth_user_id: existing.auth_user_id };
  }

  let authUserId: string | null = null;
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { discord_id: discord.id },
  });
  if (createErr && !/already registered|already exists|duplicate/i.test(createErr.message)) {
    throw createErr;
  }
  if (created?.user) {
    authUserId = created.user.id;
  } else {
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = list?.users.find((u) => u.email === email);
    if (!found) throw new Error("Auth user no encontrado tras conflicto");
    await supabaseAdmin.auth.admin.updateUserById(found.id, { password });
    authUserId = found.id;
  }

  const { data: numData } = await supabaseAdmin.rpc("generar_numero_cliente");
  const numero_cliente = (numData as string) ?? `BMX${Math.floor(Math.random() * 9999999)}`;

  const { data: nuevoUsuario, error: insErr } = await supabaseAdmin
    .from("usuarios")
    .insert({
      discord_id: discord.id,
      discord_username: discord.username,
      discord_avatar_url: avatar_url,
      nombre,
      numero_cliente,
      saldo_cartera: 0,
      saldo_banco: 0,
      auth_user_id: authUserId,
    })
    .select("id, auth_user_id")
    .single();
  if (insErr) throw insErr;

  return { usuario_id: nuevoUsuario.id, auth_user_id: nuevoUsuario.auth_user_id! };
}

async function syncRoles(usuarioId: string, discordUserId: string, accessToken: string): Promise<void> {
  let roles: string[] = [];
  try {
    roles = await fetchCurrentUserGuildRoles(accessToken, DISCORD_GUILD_ID);
  } catch (oauthError) {
    console.warn("Discord OAuth role sync fallback:", oauthError);
    try {
      roles = await fetchUserRoles(discordUserId, DISCORD_GUILD_ID);
    } catch (botError) {
      console.error("Discord role sync failed:", botError);
      return;
    }
  }

  const isAdmin = roles.includes(ROLE_ID_ADMIN);
  const isTrabajador = roles.includes(ROLE_ID_TRABAJADOR);

  await supabaseAdmin
    .from("roles_usuario")
    .delete()
    .eq("usuario_id", usuarioId)
    .in("role", ["admin", "trabajador"]);

  const toInsert: { usuario_id: string; role: "admin" | "trabajador" }[] = [];
  if (isAdmin) toInsert.push({ usuario_id: usuarioId, role: "admin" });
  if (isTrabajador) toInsert.push({ usuario_id: usuarioId, role: "trabajador" });
  if (toInsert.length) {
    await supabaseAdmin.from("roles_usuario").upsert(toInsert, { onConflict: "usuario_id,role" });
  }
}

export const startLogin = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      code: z.string().min(1).max(200),
      redirectUri: z.string().url(),
    }).parse,
  )
  .handler(async ({ data }) => {
    const tokens = await exchangeOAuthCode(data.code, data.redirectUri);
    const discord = await fetchDiscordUser(tokens.access_token);

    const { usuario_id } = await ensureUsuario(discord);
    await syncRoles(usuario_id, discord.id, tokens.access_token);

    const { data: user } = await supabaseAdmin
      .from("usuarios")
      .select("bloqueado_hasta")
      .eq("id", usuario_id)
      .single();

    if (user?.bloqueado_hasta && new Date(user.bloqueado_hasta) > new Date()) {
      const min = Math.ceil((new Date(user.bloqueado_hasta).getTime() - Date.now()) / 60000);
      throw new Error(`Cuenta bloqueada. Intenta de nuevo en ${min} min.`);
    }

    const codigo = String(Math.floor(1000 + Math.random() * 9000));
    const codigoHash = await sha256(codigo);

    await supabaseAdmin
      .from("login_codigos")
      .update({ usado: true })
      .eq("discord_id", discord.id)
      .eq("usado", false);

    const { data: cod, error: codErr } = await supabaseAdmin
      .from("login_codigos")
      .insert({
        discord_id: discord.id,
        codigo_hash: codigoHash,
        expira_en: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single();
    if (codErr) throw codErr;

    try {
      await sendDM(discord.id, {
        title: "🔐 Banco De México — Código de acceso",
        description: `Tu código de verificación es:\n\n# **${codigo}**\n\nCaduca en 5 minutos. No lo compartas con nadie.`,
        color: 0x0a0a0a,
        footer: { text: "Banco De México · Seguridad" },
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      console.error("DM error:", e);
      const msg = (e as Error).message ?? "";
      if (msg.includes("50007")) {
        throw new Error(
          "No podemos enviarte un DM. En Discord: click derecho en el servidor → Configuración de privacidad → activa 'Permitir mensajes directos de miembros del servidor'.",
        );
      }
      if (msg.includes("401")) {
        throw new Error("Token del bot inválido. Contacta al administrador.");
      }
      if (msg.includes("403")) {
        throw new Error("El bot no tiene permisos para enviarte un DM. Contacta al administrador.");
      }
      throw new Error(`No se pudo enviar el código por DM: ${msg}`);
    }

    return {
      sessionId: cod.id,
      discordId: discord.id,
      username: discord.global_name ?? discord.username,
      avatarUrl: discordAvatarUrl(discord.id, discord.avatar),
    };
  });

export const verifyCode = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      sessionId: z.string().uuid(),
      discordId: z.string().min(1).max(40),
      codigo: z.string().regex(/^\d{4}$/),
    }).parse,
  )
  .handler(async ({ data }) => {
    const { data: row } = await supabaseAdmin
      .from("login_codigos")
      .select("id, codigo_hash, intentos, expira_en, usado")
      .eq("id", data.sessionId)
      .eq("discord_id", data.discordId)
      .maybeSingle();

    if (!row) throw new Error("Sesión inválida");
    if (row.usado) throw new Error("Código ya usado");
    if (new Date(row.expira_en) < new Date()) throw new Error("Código expirado");

    const hash = await sha256(data.codigo);
    if (hash !== row.codigo_hash) {
      const intentos = row.intentos + 1;
      await supabaseAdmin.from("login_codigos").update({ intentos }).eq("id", row.id);

      const { data: u } = await supabaseAdmin
        .from("usuarios")
        .select("id, intentos_fallidos")
        .eq("discord_id", data.discordId)
        .single();
      const total = (u?.intentos_fallidos ?? 0) + 1;
      if (total >= 3) {
        await supabaseAdmin
          .from("usuarios")
          .update({
            intentos_fallidos: 0,
            bloqueado_hasta: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          })
          .eq("id", u!.id);
        await supabaseAdmin.from("login_codigos").update({ usado: true }).eq("id", row.id);
        throw new Error("3 intentos fallidos. Cuenta bloqueada 5 minutos.");
      } else {
        await supabaseAdmin.from("usuarios").update({ intentos_fallidos: total }).eq("id", u!.id);
        throw new Error(`Código incorrecto. Intentos restantes: ${3 - total}`);
      }
    }

    await supabaseAdmin.from("login_codigos").update({ usado: true }).eq("id", row.id);
    await supabaseAdmin
      .from("usuarios")
      .update({ intentos_fallidos: 0, bloqueado_hasta: null })
      .eq("discord_id", data.discordId);

    const password = await derivePassword(data.discordId);
    return { email: userEmail(data.discordId), password };
  });

export const getOAuthUrl = createServerFn({ method: "POST" })
  .inputValidator(z.object({ redirectUri: z.string().url() }).parse)
  .handler(async ({ data }) => {
    const clientId = process.env.DISCORD_CLIENT_ID;
    if (!clientId) throw new Error("DISCORD_CLIENT_ID no configurado");
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: data.redirectUri,
      response_type: "code",
      scope: DISCORD_OAUTH_SCOPES,
      prompt: "consent",
    });
    return { url: `https://discord.com/api/oauth2/authorize?${params}` };
  });

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
