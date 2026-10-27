import Notification from "../models/Notification.js";

export async function createNotification(notification, session) {
  const options = session ? { session } : {};
  await Notification.updateOne(
    { eventKey: notification.eventKey },
    { $setOnInsert: notification },
    { upsert: true, ...options },
  );
}
