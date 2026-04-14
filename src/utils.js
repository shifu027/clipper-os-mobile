export const PLATFORMS = ['TikTok', 'Instagram Reels', 'YouTube Shorts', 'LinkedIn', 'Facebook', 'X / Twitter'];
export const TAGS = ['viral', 'vendas', 'engajamento', 'atemporal', 'tutorial', 'reutilizável', 'tendência'];

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(text)));
  return div.innerHTML;
}

export function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function csvEscape(val) {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function getSocialDeepLink(platform) {
  const links = {
    'TikTok': 'https://www.tiktok.com/upload',
    'Instagram Reels': 'https://www.instagram.com/reels/create/',
    'YouTube Shorts': 'https://studio.youtube.com/',
    'LinkedIn': 'https://www.linkedin.com/feed/',
    'Facebook': 'https://www.facebook.com/reels/create/',
    'X / Twitter': 'https://x.com/compose/post'
  };
  return links[platform] || 'https://google.com';
}
