import { useEffect, useState } from 'react';
import api from '../utils/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  sectors?: Array<{
    sector: {
      id: string;
      name: string;
      color: string;
    };
  }>;
  _count?: {
    assignedConversations: number;
    assignedTickets: number;
  };
}

interface Sector {
  id: string;
  name: string;
  color: string;
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'AGENT',
    sectorIds: [] as string[],
    isActive: true,
  });

  useEffect(() => {
    fetchUsers();
    fetchSectors();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/users?includeInactive=true');
      setUsers(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSectors = async () => {
    try {
      const response = await api.get('/api/sectors');
      setSectors(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar setores:', error);
    }
  };

  const handleCreate = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      password: '',
      name: '',
      role: 'AGENT',
      sectorIds: [],
      isActive: true,
    });
    setShowModal(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '',
      name: user.name,
      role: user.role,
      sectorIds: user.sectors?.map((us) => us.sector.id) || [],
      isActive: user.isActive,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este usuário?')) {
      return;
    }

    try {
      await api.delete(`/api/users/${id}`);
      await fetchUsers();
    } catch (error: any) {
      console.error('Erro ao deletar usuário:', error);
      alert(error.response?.data?.error || 'Erro ao deletar usuário');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.name) {
      alert('Email e nome são obrigatórios');
      return;
    }

    if (!editingUser && !formData.password) {
      alert('Senha é obrigatória para novos usuários');
      return;
    }

    try {
      if (editingUser) {
        await api.put(`/api/users/${editingUser.id}`, formData);
      } else {
        await api.post('/api/users', formData);
      }

      setShowModal(false);
      await fetchUsers();
    } catch (error: any) {
      console.error('Erro ao salvar usuário:', error);
      alert(error.response?.data?.error || 'Erro ao salvar usuário');
    }
  };

  const handleToggleSector = (sectorId: string) => {
    setFormData((prev) => ({
      ...prev,
      sectorIds: prev.sectorIds.includes(sectorId)
        ? prev.sectorIds.filter((id) => id !== sectorId)
        : [...prev.sectorIds, sectorId],
    }));
  };

  const filteredUsers = users.filter((user) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      user.name.toLowerCase().includes(search) ||
      user.email.toLowerCase().includes(search) ||
      user.role.toLowerCase().includes(search)
    );
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0 }}>Usuários</h1>
        <button
          onClick={handleCreate}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
          }}
        >
          + Novo Usuário
        </button>
      </div>

      {/* Busca */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Buscar usuários..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '10px',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            fontSize: '14px',
          }}
        />
      </div>

      {/* Lista de Usuários */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>Carregando...</div>
      ) : filteredUsers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
          <p>Nenhum usuário encontrado.</p>
          <button
            onClick={handleCreate}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Criar primeiro usuário
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              style={{
                padding: '20px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                backgroundColor: 'white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>{user.name}</h3>
                  <p style={{ margin: '6px 0', color: '#6b7280', fontSize: '14px' }}>{user.email}</p>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor:
                          user.role === 'ADMIN'
                            ? '#dc2626'
                            : user.role === 'SUPERVISOR'
                            ? '#f59e0b'
                            : '#3b82f6',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: '600',
                      }}
                    >
                      {user.role}
                    </span>
                    {!user.isActive && (
                      <span
                        style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          backgroundColor: '#fef2f2',
                          color: '#dc2626',
                          fontSize: '12px',
                          fontWeight: '600',
                        }}
                      >
                        Inativo
                      </span>
                    )}
                  </div>
                  {user.sectors && user.sectors.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '6px' }}>Setores:</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {user.sectors.map((us) => (
                          <span
                            key={us.sector.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              backgroundColor: `${us.sector.color}20`,
                              color: us.sector.color,
                              fontSize: '11px',
                              fontWeight: '600',
                            }}
                          >
                            <span
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: us.sector.color,
                              }}
                            />
                            {us.sector.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '13px', color: '#6b7280' }}>
                    <span>
                      <strong>{user._count?.assignedConversations || 0}</strong> conversa(s)
                    </span>
                    <span>
                      <strong>{user._count?.assignedTickets || 0}</strong> ticket(s)
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button
                    onClick={() => handleEdit(user)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(user.id)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                  >
                    Deletar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Criar/Editar */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: '20px' }}>
              {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
            </h2>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Nome <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: João Silva"
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Email <span style={{ color: 'red' }}>*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="exemplo@email.com"
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Senha {!editingUser && <span style={{ color: 'red' }}>*</span>}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={editingUser ? 'Deixe em branco para não alterar' : 'Mínimo 6 caracteres'}
                  required={!editingUser}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '14px',
                  }}
                />
                {editingUser && (
                  <small style={{ color: '#6b7280', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                    Deixe em branco para manter a senha atual
                  </small>
                )}
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Função
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  <option value="AGENT">Agente</option>
                  <option value="SUPERVISOR">Supervisor</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
                  Setores que pode atender
                </label>
                <div
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    padding: '10px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                  }}
                >
                  {sectors.length === 0 ? (
                    <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
                      Nenhum setor cadastrado. Crie setores primeiro.
                    </p>
                  ) : (
                    sectors.map((sector) => (
                      <label
                        key={sector.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#f9fafb';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={formData.sectorIds.includes(sector.id)}
                          onChange={() => handleToggleSector(sector.id)}
                          style={{ cursor: 'pointer' }}
                        />
                        <div
                          style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '4px',
                            backgroundColor: sector.color,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: '14px' }}>{sector.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  <span style={{ fontWeight: '600' }}>Ativo</span>
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#e5e7eb',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
                >
                  {editingUser ? 'Salvar Alterações' : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

