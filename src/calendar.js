/**
 * CalendarManager — Calendar integration
 * Supports:
 *   - Native calendar via @capacitor-community/calendar (when available)
 *   - Google Calendar URL fallback
 *   - .ics file download
 */

function toISOBasic(date) {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function pad(n) {
  return String(n).padStart(2, '0');
}

export const CalendarManager = {
  async requestPermission() {
    try {
      const { Calendar } = await import('@ebarooni/capacitor-calendar');
      const result = await Calendar.requestPermission();
      return result.granted === true;
    } catch {
      return false;
    }
  },

  async addEvent(slot, assetTitle) {
    const [year, month, day] = slot.date.split('-').map(Number);
    const [hours, minutes] = slot.time.split(':').map(Number);
    const startDate = new Date(year, month - 1, day, hours, minutes, 0);
    const endDate = new Date(startDate.getTime() + 30 * 60 * 1000); // +30 min

    // Try native Capacitor calendar first
    try {
      const { Calendar } = await import('@ebarooni/capacitor-calendar');
      await Calendar.createEvent({
        title: `⏰ Post: ${assetTitle}`,
        startDate: startDate.getTime(),
        endDate: endDate.getTime(),
        notes: `Platform: ${slot.platform}`,
        location: '',
      });
      return { success: true, method: 'native' };
    } catch {
      // Native not available — fall back to Google Calendar URL
      this.openGoogleCalendar(slot, assetTitle);
      return { success: true, method: 'google' };
    }
  },

  openGoogleCalendar(slot, assetTitle) {
    const [year, month, day] = slot.date.split('-').map(Number);
    const [hours, minutes] = slot.time.split(':').map(Number);
    const startDate = new Date(year, month - 1, day, hours, minutes, 0);
    const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);

    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: `⏰ Post: ${assetTitle}`,
      dates: `${toISOBasic(startDate)}/${toISOBasic(endDate)}`,
      details: `Platform: ${slot.platform}`,
    });

    window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, '_blank');
  },

  generateICSContent(slots, assets) {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Clipper OS//ClipperOS Mobile//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
    ];

    for (const slot of slots) {
      if (slot.isPosted) continue;
      const asset = assets.find(a => a.id === slot.assetId);
      const title = asset ? (asset.title || asset.name) : 'Scheduled Post';
      const platform = slot.platform || '';

      const [year, month, day] = slot.date.split('-').map(Number);
      const [slotHours, slotMinutes] = slot.time.split(':').map(Number);
      const startDate = new Date(year, month - 1, day, slotHours, slotMinutes, 0);
      const endDate = new Date(startDate.getTime() + 30 * 60 * 1000);
      const now = new Date();

      lines.push('BEGIN:VEVENT');
      lines.push(`UID:clipper-os-${slot.id}@io.clipper.os`);
      lines.push(`DTSTAMP:${toISOBasic(now)}`);
      lines.push(`DTSTART:${toISOBasic(startDate)}`);
      lines.push(`DTEND:${toISOBasic(endDate)}`);
      lines.push(`SUMMARY:⏰ Post: ${title}`);
      lines.push(`DESCRIPTION:Platform: ${platform}`);
      lines.push('END:VEVENT');
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  },

  downloadICS(slots, assets) {
    const today = new Date().toISOString().split('T')[0];
    const content = this.generateICSContent(slots, assets);
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ClipperOS_Schedule_${today}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
