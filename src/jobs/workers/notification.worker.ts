import { Worker } from "bullmq";
import { connection } from "../queue.js";
// import { redis } from "../../lib/redis.js";

export const notificationWorker = new Worker(
    "notification",
    async (job) => {
        switch (job.name) {
            case "task-created":
                console.log(
                    "Sending task created notification to",
                    job.data.data.title,
                );
                break;
            case "task-updated":
                console.log(
                    "Sending task updated notification to",
                    job.data.data.title,
                );
                break;
            case "task-deleted":
                console.log(
                    "Sending task deleted notification to",
                    job.data.data.title,
                );
                break;
            default:
                console.log("Unknown job type:", job.name);
        }
        // job.data  → the payload you passed in queue.add()
        // do the work here
    },
    { connection: connection },
);

notificationWorker.on("completed", (job) =>
    console.log(`✅ Notification job ${job.id} completed`),
);
notificationWorker.on("failed", (job, err) =>
    console.error(`❌ Notification job ${job?.id} failed:`, err.message),
);
