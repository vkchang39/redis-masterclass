import { Task } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { CreateTaskDto, UpdateTaskDto } from "./task.types.js";

export class TaskRepository {
    async findAll(): Promise<Task[]> {
        return await prisma.task.findMany();
    }

    async findById(id: string): Promise<Task | null> {
        return await prisma.task.findUnique({ where: { id } });
    }

    async findByUserId(userId: string): Promise<Task[]> {
        return await prisma.task.findMany({ where: { userId } });
    }

    async create(task: CreateTaskDto): Promise<Task> {
        return await prisma.task.create({
            data: task,
        });
    }

    async update(id: string, task: UpdateTaskDto): Promise<Task> {
        return await prisma.task.update({
            where: { id },
            data: task,
        });
    }

    async delete(id: string): Promise<Task> {
        return await prisma.task.delete({ where: { id } });
    }
}
