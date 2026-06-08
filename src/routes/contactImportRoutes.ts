import { Router } from 'express';
import { ContactImportController } from '../controllers/contactImportController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = Router();
const contactImportController = new ContactImportController();

// Todas as rotas precisam de autenticação
router.use(authenticateToken);

// POST - Importar contatos via CSV
router.post(
  '/import',
  authorizeRoles('ADMIN', 'SUPERVISOR'),
  contactImportController.importContacts.bind(contactImportController),
);

export default router;

