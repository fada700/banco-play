// Helpers para hablar con la API de Discord. Solo servidor.
const DISCORD_API = "https://discord.com/api/v10";

function botToken(): string {
  const t = process.env.DISCORD_BOT_TOKEN;
  if (!t) throw new Error("DISCORD_BOT_TOKEN no configurado");
  return t;
}

export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
}

export async function sendDM(discordUserId: string, embed: DiscordEmbed): Promise<void> {
  const dmRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ recipient_id: discordUserId }),
  });
  if (!dmRes.ok) {
    const text = await dmRes.text();
    throw new Error(`${dmRes.status} ${text}`);
  }
  const channel = (await dmRes.json()) as { id: string };

  const msgRes = await fetch(`${DISCORD_API}/channels/${channel.id}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${botToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ embeds: [embed] }),
  });
  if (!msgRes.ok) {
    const text = await msgRes.text();
    throw new Error(`${msgRes.status} ${text}`);
  }
}

export async function exchangeOAuthCode(
  code: string,
  redirectUri: string,
): Promise<{ access_token: string; token_type: string; expires_in: number; refresh_token?: string; scope: string }> {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Credenciales OAuth de Discord no configuradas");

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth exchange falló: ${res.status} ${text}`);
  }
  return res.json();
}

export interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`No se pudo obtener usuario de Discord: ${res.status}`);
  return res.json();
}

export async function fetchCurrentUserGuildRoles(accessToken: string, guildId: string): Promise<string[]> {
  const res = await fetch(`${DISCORD_API}/users/@me/guilds/${guildId}/member`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) return [];
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`No se pudieron obtener roles por OAuth: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { roles?: string[] };
  return data.roles ?? [];
}

export async function fetchUserRoles(discordUserId: string, guildId: string): Promise<string[]> {
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${discordUserId}`, {
    headers: { Authorization: `Bot ${botToken()}` },
  });
  if (res.status === 404) return [];
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`No se pudieron obtener roles: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { roles: string[] };
  return data.roles ?? [];
}

export function discordAvatarUrl(userId: string, avatar: string | null): string | null {
  if (!avatar) return null;
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=256`;
}
