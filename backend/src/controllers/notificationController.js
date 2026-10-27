import mongoose from "mongoose";
import Notification from "../models/Notification.js";

export async function listNotifications(request, response) {
  const limit = request.query.limit === undefined ? 25 : Number(request.query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    return response.status(400).json({ message: "Limit must be an integer between 1 and 50." });
  }

  const [unreadCount, notifications] = await Promise.all([
    Notification.countDocuments({ recipient: request.user._id, readAt: null }),
    Notification.find({ recipient: request.user._id })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean(),
  ]);

  return response.status(200).json({
    unreadCount,
    notifications: notifications.map((notification) => ({
      id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    })),
  });
}

export async function markNotificationRead(request, response) {
  const notificationId = request.params.notificationId;
  if (!mongoose.isValidObjectId(notificationId)) {
    return response.status(400).json({ message: "The notification ID is invalid." });
  }

  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: request.user._id, readAt: null },
    { $set: { readAt: new Date() } },
    { new: true },
  ).lean();
  if (!notification) {
    const alreadyRead = await Notification.exists({
      _id: notificationId,
      recipient: request.user._id,
    });
    if (!alreadyRead) {
      return response.status(404).json({ message: "Notification not found." });
    }

    return response.status(200).json({ read: true });
  }

  return response.status(200).json({ read: true, readAt: notification.readAt });
}

export async function markAllNotificationsRead(request, response) {
  const result = await Notification.updateMany(
    { recipient: request.user._id, readAt: null },
    { $set: { readAt: new Date() } },
  );

  return response.status(200).json({ updated: result.modifiedCount });
}
