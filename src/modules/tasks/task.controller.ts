import { TaskService } from "./task.service.js";
import { Request, Response } from "express";
import { CreateTaskDto, UpdateTaskDto } from "./task.types.js";

export class TaskController {
    constructor(private readonly taskService: TaskService) {
        this.findAll = this.findAll.bind(this);
        this.findById = this.findById.bind(this);
        this.findByUserId = this.findByUserId.bind(this);
        this.create = this.create.bind(this);
        this.update = this.update.bind(this);
        this.delete = this.delete.bind(this);
    }

    async findAll(req: Request, res: Response) {
        const { id: userId } = req.user!;
        const tasks = await this.taskService.findByUserId(userId);
        res.status(200).json(tasks);
    }

    async findById(req: Request, res: Response) {
        const { id: userId } = req.user!;
        const { id } = req.params as { id: string };

        const task = await this.taskService.findById(id);
        if (!task) {
            throw new Error("Task not found");
        }
        if (task.userId !== userId) {
            throw new Error("Unauthorized");
        }
        res.status(200).json(task);
    }

    async findByUserId(req: Request, res: Response) {
        const { id: userId } = req.user!;
        const tasks = await this.taskService.findByUserId(userId);
        res.status(200).json(tasks);
    }

    async create(req: Request, res: Response) {
        const { title, description } = req.body as CreateTaskDto;
        const { id: userId } = req.user!;
        const task = await this.taskService.create({
            title,
            description,
            userId,
        });
        res.status(201).json(task);
    }

    async update(req: Request, res: Response) {
        const { id } = req.params as { id: string };
        const { title, description, status } = req.body as UpdateTaskDto;
        const { id: userId } = req.user!;
        const existingTask = await this.taskService.findById(id);
        if (!existingTask) {
            throw new Error("Task not found");
        }
        if (existingTask.userId !== userId) {
            throw new Error("Unauthorized");
        }
        const task = await this.taskService.update(id, {
            title,
            description,
            status,
        });
        res.status(200).json(task);
    }

    async delete(req: Request, res: Response) {
        const { id } = req.params as { id: string };
        const { id: userId } = req.user!;
        const existingTask = await this.taskService.findById(id);
        if (!existingTask) {
            throw new Error("Task not found");
        }
        if (existingTask.userId !== userId) {
            throw new Error("Unauthorized");
        }
        const task = await this.taskService.delete(id);
        res.status(200).json(task);
    }
}
