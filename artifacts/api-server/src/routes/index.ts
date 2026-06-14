import { Router, type IRouter } from "express";
import healthRouter from "./health";
import theaterRouter from "./theater";

const router: IRouter = Router();

router.use(healthRouter);
router.use(theaterRouter);

export default router;
