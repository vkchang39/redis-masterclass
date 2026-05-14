import { MessageHandler, publish, subscribe } from "../../lib/pubsub.js";
import { Task } from "../tasks/task.types.js";

export const NotificationChannels = {
    taskCreated: "tasks:created",
    taskUpdated: "tasks:updated",
    taskDeleted: "tasks:deleted",
} as const;

export class NotificationService {
    // publish task events
    async publishTaskEvent(
        event: "created" | "updated" | "deleted",
        task: Task,
    ): Promise<void> {
        const channel =
            NotificationChannels[
                `task${event.charAt(0).toUpperCase()}${event.slice(1)}` as keyof typeof NotificationChannels
            ];
        await publish(channel, task);
    }

    // initialize all subscribers at startup
    async initializeSubscribers(): Promise<void> {
        const handler: MessageHandler = (channel, message) => {
            console.log(`[Notification] Received on ${channel}:`, message);
            // TODO: add notification logic
        };

        for (const channel of Object.values(NotificationChannels)) {
            await subscribe(channel, handler);
        }
    }
}
