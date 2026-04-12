/**
 * NotificationManager — Local notifications via @capacitor/local-notifications
 * Gracefully degrades when running in a browser or when permission is denied.
 */

let LocalNotifications = null;

async function getLocalNotifications() {
  if (LocalNotifications) return LocalNotifications;
  try {
    const mod = await import('@capacitor/local-notifications');
    LocalNotifications = mod.LocalNotifications;
  } catch {
    LocalNotifications = null;
  }
  return LocalNotifications;
}

function slotNotificationId(slotId) {
  // Derive a stable numeric ID from the slot string ID (positive 32-bit int)
  let hash = 0;
  for (let i = 0; i < slotId.length; i++) {
    hash = ((hash << 5) - hash + slotId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

export const NotificationManager = {
  async requestPermission() {
    const LN = await getLocalNotifications();
    if (!LN) return false;
    try {
      const result = await LN.requestPermissions();
      return result.display === 'granted';
    } catch {
      return false;
    }
  },

  async scheduleForSlot(slot, assetTitle) {
    const LN = await getLocalNotifications();
    if (!LN) return;
    try {
      // Cancel any existing notification for this slot first
      await this.cancelForSlot(slot.id);

      // Build the notification timestamp: slot date+time minus 15 minutes
      const [hours, minutes] = slot.time.split(':').map(Number);
      const dt = new Date(`${slot.date}T${slot.time}:00`);
      dt.setMinutes(dt.getMinutes() - 15);

      // Don't schedule if the trigger time is in the past
      if (dt <= new Date()) return;

      await LN.schedule({
        notifications: [{
          id: slotNotificationId(slot.id),
          title: '⏰ Time to post!',
          body: `${assetTitle} — ${slot.platform}`,
          schedule: { at: dt },
          extra: { slotId: slot.id },
        }],
      });
    } catch (e) {
      console.warn('[NotificationManager] scheduleForSlot error:', e);
    }
  },

  async cancelForSlot(slotId) {
    const LN = await getLocalNotifications();
    if (!LN) return;
    try {
      await LN.cancel({ notifications: [{ id: slotNotificationId(slotId) }] });
    } catch (e) {
      console.warn('[NotificationManager] cancelForSlot error:', e);
    }
  },

  async cancelAll() {
    const LN = await getLocalNotifications();
    if (!LN) return;
    try {
      const pending = await LN.getPending();
      if (pending.notifications.length > 0) {
        await LN.cancel({ notifications: pending.notifications });
      }
    } catch (e) {
      console.warn('[NotificationManager] cancelAll error:', e);
    }
  },
};
