import express from "express";
import { TaskService } from "./task.service.js";
import { TaskController } from "./task.controller.js";
import { authenticate } from "../../middleware/authenticate.js";

const taskRouter = express.Router();
const taskService = new TaskService();
const taskController = new TaskController(taskService);

taskRouter.get("/", authenticate, taskController.findAll);
taskRouter.get("/:id", authenticate, taskController.findById);
taskRouter.post("/", authenticate, taskController.create);
taskRouter.put("/:id", authenticate, taskController.update);
taskRouter.delete("/:id", authenticate, taskController.delete);

export { taskRouter };
