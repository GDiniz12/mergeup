export function generateRoomId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export interface RoomConfig {
  id: string;
  mode: 'time' | 'score';
  timeLimit?: number;
  scoreTarget?: number;
  password?: string;
  hasPassword: boolean;
  createdAt: number;
}

export function saveRoomConfig(config: RoomConfig): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`room_${config.id}`, JSON.stringify(config));
  }
}

export function getRoomConfig(id: string): RoomConfig | null {
  if (typeof window !== 'undefined') {
    const data = localStorage.getItem(`room_${id}`);
    return data ? JSON.parse(data) : null;
  }
  return null;
}
