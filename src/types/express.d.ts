// src/types/express.d.ts
import { User } from "../generated/prisma/client.js";
import "cookie-parser";

declare global {
    namespace Express {
        interface Request {
            user?: User;
        }
    }
}
