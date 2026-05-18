import { Queue } from "bullmq";
import { config } from "../config/env.js";
export const connection = {
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD,
};

export const emailQueue = new Queue("email", {
    connection,
});
export const notificationQueue = new Queue("notification", {
    connection,
});
