import { Router } from 'express';
import { TicketController } from '../controllers/ticketController';
import { authenticateToken } from '../middleware/auth';
import { validateBody } from '../middleware/validateBody';
import {
  addTicketNoteSchema,
  assignTicketSchema,
  closeTicketSchema,
  createTicketSchema,
  updateTicketSchema,
} from '../schemas/ticketSchemas';

const router = Router();
const ticketController = new TicketController();

router.use(authenticateToken);

router.get('/stats', ticketController.getStats.bind(ticketController));
router.get(
  '/by-conversation/:conversationId',
  ticketController.getByConversationId.bind(ticketController),
);
router.get('/', ticketController.list.bind(ticketController));
router.post('/', validateBody(createTicketSchema), ticketController.create.bind(ticketController));
router.get('/:id', ticketController.getById.bind(ticketController));
router.put('/:id', validateBody(updateTicketSchema), ticketController.update.bind(ticketController));
router.post(
  '/:id/assign',
  validateBody(assignTicketSchema),
  ticketController.assign.bind(ticketController),
);
router.post(
  '/:id/close',
  validateBody(closeTicketSchema),
  ticketController.close.bind(ticketController),
);
router.post(
  '/:id/notes',
  validateBody(addTicketNoteSchema),
  ticketController.addNote.bind(ticketController),
);
router.post('/:id/reopen', ticketController.reopen.bind(ticketController));
router.delete('/:id', ticketController.delete.bind(ticketController));

export default router;
