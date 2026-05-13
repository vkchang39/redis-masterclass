// A const object is simpler and equally typed
export const CacheKeys = {
    tasks: {
        all: () => `tasks:all`,
        byId: (id: string | number) => `tasks:id:${id}`,
        byUser: (userId: string | number) => `tasks:user:${userId}`,
    },
    auth: {
        userSessions: (userId: string) => `auth:sessions:${userId}`,
        user: (userId: string) => `auth:user:${userId}`,
    },
} as const;
