import { Router, Request, Response } from 'express';

export const webhookRouter: Router = Router();

// Phase 0 Stub: Webhook processing will be implemented in Phase 1
webhookRouter.post('/github', (_req: Request, res: Response) => {
  res.status(501).json({
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'GitHub webhook processing is Phase 1 functionality',
    },
  });
});
