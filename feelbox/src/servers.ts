export type ListedServer = {
  id: string;
  name: string;
  map: string;
  mapTitle: string;
  phase: string;
  players: number;
  max: number;
  online: boolean;
};

export async function fetchServers(): Promise<ListedServer[]> {
  try {
    const res = await fetch("/api/servers");
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    return Array.isArray(data) ? (data as ListedServer[]) : [];
  } catch {
    return [];
  }
}
