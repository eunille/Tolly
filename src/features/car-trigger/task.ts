import { refreshAll } from '@/features/balances/refresh';
import { buildAnnouncement } from '@/features/voice/announcement';
import { speak } from '@/features/voice/speak';

/** Headless task run by the Android AnnounceService when the paired car connects. */
export async function announceTask(): Promise<void> {
  const readings = await refreshAll();
  await speak(buildAnnouncement(readings));
}
