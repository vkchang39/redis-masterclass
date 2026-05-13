import express from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";

const authService = new AuthService();
const authController = new AuthController(authService);

const authRouter = express.Router();

authRouter.post("/register", authController.register);
authRouter.post("/login", authController.login);
authRouter.post("/refresh", authController.refresh);
authRouter.post("/logout", authenticate, authController.logout);
authRouter.post("/logout-all", authenticate, authController.logoutAll);

export { authRouter };
