export type TaskStatus = "pending" | "in_progress" | "completed";

export interface Task {
    id: string;
    title: string;
    description: string;
    status: TaskStatus;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateTaskDto {
    title: string;
    description: string;
    userId: string;
}

export interface UpdateTaskDto {
    title?: string;
    description?: string;
    status?: TaskStatus;
}
