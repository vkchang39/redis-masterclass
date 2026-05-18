import { Task, User } from "../../generated/prisma/client.js";
import { CacheService } from "../../lib/cache.service.js";
import { CacheKeys } from "../../lib/cacheKeys.js";
import { NotificationService } from "../notifications/notification.service.js";
import { TaskRepository } from "./task.repository.js";
import { CreateTaskDto, UpdateTaskDto } from "./task.types.js";
import { LeaderBoardService } from "../leaderboard/leaderboard.service.js";
import { emailQueue, notificationQueue } from "../../jobs/queue.js";
import { prisma } from "../../lib/prisma.js";

export class TaskService {
    private readonly cacheService: CacheService = new CacheService();
    private readonly taskRepository: TaskRepository = new TaskRepository();
    private readonly notificationService = new NotificationService();
    private readonly leaderboardService = new LeaderBoardService();

    private async getUserEmail(userId: string): Promise<string | undefined> {
        const cachedUser = await this.cacheService.get<User>(
            CacheKeys.auth.user(userId),
        );
        return (
            cachedUser?.email ??
            (
                await prisma.user.findUnique({
                    where: { id: userId },
                    select: { email: true },
                })
            )?.email
        );
    }

    async findAll(): Promise<Task[]> {
        const cachedTasks = await this.cacheService.get<Task[]>(
            CacheKeys.tasks.all(),
        );
        if (cachedTasks) return cachedTasks;
        const tasks = await this.taskRepository.findAll();
        await this.cacheService.set<Task[]>(CacheKeys.tasks.all(), tasks);
        return tasks;
    }

    async findById(id: string): Promise<Task | null> {
        const cachedTask = await this.cacheService.get<Task>(
            CacheKeys.tasks.byId(id),
        );
        if (cachedTask) return cachedTask;
        const task = await this.taskRepository.findById(id);
        if (task)
            await this.cacheService.set<Task>(CacheKeys.tasks.byId(id), task);
        return task;
    }

    async findByUserId(userId: string): Promise<Task[]> {
        const cachedTasks = await this.cacheService.get<Task[]>(
            CacheKeys.tasks.byUser(userId),
        );
        if (cachedTasks) return cachedTasks;
        const tasks = await this.taskRepository.findByUserId(userId);
        if (tasks)
            await this.cacheService.set<Task[]>(
                CacheKeys.tasks.byUser(userId),
                tasks,
            );
        return tasks;
    }

    async create(task: CreateTaskDto): Promise<Task> {
        const newTask = await this.taskRepository.create(task);
        await this.cacheService.set<Task>(
            CacheKeys.tasks.byId(newTask.id),
            newTask,
        );
        await this.cacheService.delMany([
            CacheKeys.tasks.all(),
            CacheKeys.tasks.byUser(newTask.userId),
        ]);
        await this.notificationService.publishTaskEvent("created", newTask);
        const userEmail = await this.getUserEmail(newTask.userId);

        await emailQueue.add("task-created", {
            email: userEmail,
            task: newTask,
        });
        await notificationQueue.add("task-created", {
            userId: newTask.userId,
            data: newTask,
        });
        return newTask;
    }

    async update(id: string, task: UpdateTaskDto): Promise<Task> {
        const updatedTask = await this.taskRepository.update(id, task);
        await this.cacheService.delMany([
            CacheKeys.tasks.byId(id),
            CacheKeys.tasks.byUser(updatedTask.userId),
            CacheKeys.tasks.all(),
        ]);
        await this.notificationService.publishTaskEvent("updated", updatedTask);
        if (task.status === "completed") {
            await this.leaderboardService.incrementScore(updatedTask.userId);
        }
        const userEmail = await this.getUserEmail(updatedTask.userId);
        await emailQueue.add("task-updated", {
            email: userEmail,
            task: updatedTask,
        });
        await notificationQueue.add("task-updated", {
            userId: updatedTask.userId,
            data: updatedTask,
        });
        return updatedTask;
    }

    async delete(id: string): Promise<Task> {
        const deletedTask = await this.taskRepository.delete(id);
        await this.cacheService.delMany([
            CacheKeys.tasks.byId(id),
            CacheKeys.tasks.byUser(deletedTask.userId),
            CacheKeys.tasks.all(),
        ]);
        await this.notificationService.publishTaskEvent("deleted", deletedTask);
        const userEmail = await this.getUserEmail(deletedTask.userId);
        await emailQueue.add("task-deleted", {
            email: userEmail,
            task: deletedTask,
        });
        await notificationQueue.add("task-deleted", {
            userId: deletedTask.userId,
            data: deletedTask,
        });
        return deletedTask;
    }
}
