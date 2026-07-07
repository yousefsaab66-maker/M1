export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  sound?: "default" | null;
  channelId?: string;
  priority?: "default" | "normal" | "high";
};

type ExpoPushTicket = { status: "ok"; id?: string } | { status: "error"; message?: string; details?: unknown };

export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<void> {
  if (messages.length === 0) return;

  const accessToken = process.env.EXPO_ACCESS_TOKEN?.trim();
  const headers: HeadersInit = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };

  const chunkSize = 100;
  for (let i = 0; i < messages.length; i += chunkSize) {
    const chunk = messages.slice(i, i + chunkSize);
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers,
        body: JSON.stringify(chunk),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as { data?: ExpoPushTicket[] };
      const tickets = json.data ?? [];
      const deadTokens: string[] = [];
      tickets.forEach((ticket, idx) => {
        if (ticket.status === "error") {
          const detail = ticket.details as { error?: string } | undefined;
          if (detail?.error === "DeviceNotRegistered") {
            deadTokens.push(chunk[idx]?.to);
          }
        }
      });
      if (deadTokens.length > 0) {
        const { deletePushTokens } = await import("@/lib/push-tokens-db");
        await deletePushTokens(deadTokens.filter(Boolean));
      }
    } catch {
      /* best-effort */
    }
  }
}
