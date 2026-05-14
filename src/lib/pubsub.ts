import { publisher, subscriber } from "./redis.js";

export type MessageHandler = (channel: string, message: string) => void;

// register once at module level
subscriber.on("message", (channel: string, message: string) => {
    const handler = handlers.get(channel);
    if (handler) handler(channel, message);
});

// map to store channel → handler
const handlers = new Map<string, MessageHandler>();

// publish a message to a channel
export const publish = async (
    channel: string,
    message: unknown,
): Promise<void> => {
    await publisher.publish(channel, JSON.stringify(message));
};

// subscribe to a channel with a handler
export const subscribe = async (
    channel: string,
    handler: MessageHandler,
): Promise<void> => {
    handlers.set(channel, handler);
    await subscriber.subscribe(channel);
};

// unsubscribe from a channel
export const unsubscribe = async (channel: string): Promise<void> => {
    handlers.delete(channel);
    await subscriber.unsubscribe(channel);
};
