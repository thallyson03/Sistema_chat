import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { ContactListController } from '../controllers/contactListController';

const router = Router();
const contactListController = new ContactListController();
const adminOrSupervisor = authorizeRoles('ADMIN', 'SUPERVISOR');

// Todas as rotas precisam de autenticação e perfil ADMIN ou SUPERVISOR
router.use(authenticateToken, adminOrSupervisor);

// CRUD de listas
router.post('/', contactListController.createList.bind(contactListController));
router.get('/', contactListController.getLists.bind(contactListController));
router.get('/:id', contactListController.getListById.bind(contactListController));
router.put('/:id', contactListController.updateList.bind(contactListController));
router.delete('/:id', contactListController.deleteList.bind(contactListController));

// Gerenciar contatos nas listas
router.post('/:id/contacts', contactListController.addContacts.bind(contactListController));
router.delete('/:id/contacts', contactListController.removeContacts.bind(contactListController));
router.get('/:id/contacts', contactListController.getContacts.bind(contactListController));

export default router;




