import { Task } from "../../generated/prisma/client.js";
import { CacheService } from "../../lib/cache.service.js";
import { CacheKeys } from "../../lib/cacheKeys.js";
import { NotificationService } from "../notifications/notification.service.js";
import { TaskRepository } from "./task.repository.js";
import { CreateTaskDto, UpdateTaskDto } from "./task.types.js";

export class TaskService {
    private readonly cacheService: CacheService = new CacheService();
    private readonly taskRepository: TaskRepository = new TaskRepository();
    private readonly notificationService = new NotificationService();

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
        return deletedTask;
    }
}
