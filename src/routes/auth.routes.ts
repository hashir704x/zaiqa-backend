import { Hono } from "hono";
import {
  registerController,
  loginController,
  logoutController,
} from "../controllers/auth.controllers";

const authRoutes = new Hono();

authRoutes.post("/register", registerController);
authRoutes.post("/login", loginController);
authRoutes.post("/logout", logoutController);

export default authRoutes;

