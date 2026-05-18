import { Worker } from "bullmq";
import { connection } from "../queue.js";
// import { redis } from "../../lib/redis.js";

export const emailWorker = new Worker(
    "email",
    async (job) => {
        // job.name  → the job type e.g. 'send-welcome'
        switch (job.name) {
            case "send-welcome":
                console.log("Sending welcome email to", job.data.email);
                break;
            case "send-reset-password":
                console.log("Sending reset password email to", job.data.email);
                break;
            case "task-created":
                console.log("Sending task created email to", job.data.email);
                break;
            case "task-updated":
                console.log("Sending task updated email to", job.data.email);
                break;
            case "task-deleted":
                console.log("Sending task deleted email to", job.data.email);
                break;
            default:
                console.log("Unknown job type:", job.name);
        }
        // job.data  → the payload you passed in queue.add()
        // do the work here
    },
    { connection: connection },
);

emailWorker.on("completed", (job) =>
    console.log(`✅ Email job ${job.id} completed`),
);
emailWorker.on("failed", (job, err) =>
    console.error(`❌ Email job ${job?.id} failed:`, err.message),
);
