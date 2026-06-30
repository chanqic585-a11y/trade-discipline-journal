import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function scheduleReviewReminder(time: string) {
  const [hourText, minuteText] = time.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return;

  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return;

  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Trade review reminder',
      body: '先完成复盘，再考虑新的交易计划。',
    },
    trigger: {
      hour,
      minute,
      repeats: true,
    },
  });
}

export async function sendPriceAlertNotification(title: string, body: string) {
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
    },
    trigger: null,
  });
}
