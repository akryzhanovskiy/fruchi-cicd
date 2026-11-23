/** Attention signals for new orders: a short chime and a system (browser) notification. */

let audio: AudioContext | null = null;

/** Two-tone chime made with Web Audio — no sound file to ship. */
export function playChime() {
  try {
    audio ??= new AudioContext();
    void audio.resume();
    const start = audio.currentTime;
    [880, 1320].forEach((frequency, i) => {
      const osc = audio!.createOscillator();
      const gain = audio!.createGain();
      const t = start + i * 0.18;
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(audio!.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch {
    // Audio unavailable (or blocked until the user interacts with the page) — skip.
  }
}

export const browserNotificationsSupported = () => typeof Notification !== 'undefined';

export function browserNotificationPermission(): NotificationPermission | 'unsupported' {
  return browserNotificationsSupported() ? Notification.permission : 'unsupported';
}

export async function requestBrowserNotifications() {
  if (!browserNotificationsSupported()) return 'unsupported' as const;
  return Notification.requestPermission();
}

/** Shows a system notification while the admin tab is in the background. */
export function showBrowserNotification(title: string, body: string, onClick: () => void) {
  if (browserNotificationPermission() !== 'granted' || !document.hidden) return;
  const notification = new Notification(title, { body, tag: title, icon: '/favicon.svg' });
  notification.onclick = () => {
    window.focus();
    onClick();
    notification.close();
  };
}
