import React, { useState, useEffect } from 'react';
import api from '../utils/api';

interface CustomField {
  id: string;
  name: string;
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'EMAIL' | 'PHONE' | 'SELECT';
  required: boolean;
  options?: string[];
  order: number;
  isActive: boolean;
}

interface CustomFieldsManagerProps {
  pipelineId: string;
}

export default function CustomFieldsManager({ pipelineId }: CustomFieldsManagerProps) {
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'TEXT' as 'TEXT' | 'NUMBER' | 'DATE' | 'EMAIL' | 'PHONE' | 'SELECT',
    required: false,
    options: [] as string[],
  });
  const [newOption, setNewOption] = useState('');

  useEffect(() => {
    if (pipelineId) {
      fetchCustomFields();
    }
  }, [pipelineId]);

  const fetchCustomFields = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/pipelines/${pipelineId}/custom-fields`);
      setCustomFields(response.data || []);
    } catch (error: any) {
      console.error('Erro ao carregar campos personalizados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (field?: CustomField) => {
    if (field) {
      setEditingField(field);
      setFormData({
        name: field.name,
        type: field.type,
        required: field.required,
        options: field.options || [],
      });
    } else {
      setEditingField(null);
      setFormData({
        name: '',
        type: 'TEXT',
        required: false,
        options: [],
      });
    }
    setNewOption('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Nome do campo é obrigatório');
      return;
    }

    try {
      if (editingField) {
        await api.put(`/api/pipelines/custom-fields/${editingField.id}`, formData);
      } else {
        await api.post(`/api/pipelines/${pipelineId}/custom-fields`, formData);
      }
      await fetchCustomFields();
      setShowModal(false);
      setEditingField(null);
      setFormData({ name: '', type: 'TEXT', required: false, options: [] });
    } catch (error: any) {
      console.error('Erro ao salvar campo:', error);
      alert(error.response?.data?.error || 'Erro ao salvar campo');
    }
  };

  const handleDelete = async (fieldId: string) => {
    if (!confirm('Tem certeza que deseja deletar este campo?')) return;

    try {
      await api.delete(`/api/pipelines/custom-fields/${fieldId}`);
      await fetchCustomFields();
    } catch (error: any) {
      console.error('Erro ao deletar campo:', error);
      alert(error.response?.data?.error || 'Erro ao deletar campo');
    }
  };

  const handleAddOption = () => {
    if (newOption.trim() && !formData.options.includes(newOption.trim())) {
      setFormData({
        ...formData,
        options: [...formData.options, newOption.trim()],
      });
      setNewOption('');
    }
  };

  const handleRemoveOption = (option: string) => {
    setFormData({
      ...formData,
      options: formData.options.filter((o) => o !== option),
    });
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      TEXT: 'Texto',
      NUMBER: 'Número',
      DATE: 'Data',
      EMAIL: 'E-mail',
      PHONE: 'Telefone',
      SELECT: 'Seleção',
    };
    return labels[type] || type;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0, color: 'white' }}>Campos Personalizados</h3>
        <button
          onClick={() => handleOpenModal()}
          style={{
            padding: '6px 12px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '600',
          }}
        >
          + Novo Campo
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px', opacity: 0.8, color: 'white' }}>Carregando...</div>
      ) : customFields.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '20px', opacity: 0.8, color: 'white' }}>
          Nenhum campo personalizado criado ainda.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {customFields.map((field) => (
            <div
              key={field.id}
              style={{
                padding: '12px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <strong style={{ fontSize: '14px', color: 'white' }}>{field.name}</strong>
                    {field.required && (
                      <span style={{ fontSize: '10px', padding: '2px 6px', backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: '4px', color: 'white' }}>
                        Obrigatório
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', opacity: 0.8, marginBottom: '4px', color: 'white' }}>
                    Tipo: {getTypeLabel(field.type)}
                  </div>
                  <div style={{ fontSize: '10px', opacity: 0.7, fontFamily: 'monospace', marginTop: '4px', color: 'white' }}>
                    ID: {field.id}
                  </div>
                  {field.type === 'SELECT' && field.options && field.options.length > 0 && (
                    <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '6px', color: 'white' }}>
                      Opções: {field.options.join(', ')}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => handleOpenModal(field)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
                    }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(field.id)}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: 'rgba(239,68,68,0.3)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '11px',
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

      {/* Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              backgroundColor: '#0f766e',
              color: 'white',
              padding: '24px',
              borderRadius: '12px',
              width: '90%',
              maxWidth: '500px',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
              {editingField ? 'Editar Campo' : 'Novo Campo Personalizado'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '12px', opacity: 0.8, display: 'block', marginBottom: '6px' }}>
                  Nome do Campo *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Empresa, Cargo, Orçamento"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    fontSize: '14px',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', opacity: 0.8, display: 'block', marginBottom: '6px' }}>
                  Tipo
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any, options: e.target.value === 'SELECT' ? formData.options : [] })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.3)',
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    color: 'white',
                    fontSize: '14px',
                  }}
                >
                  <option value="TEXT" style={{ color: '#000' }}>Texto</option>
                  <option value="NUMBER" style={{ color: '#000' }}>Número</option>
                  <option value="DATE" style={{ color: '#000' }}>Data</option>
                  <option value="EMAIL" style={{ color: '#000' }}>E-mail</option>
                  <option value="PHONE" style={{ color: '#000' }}>Telefone</option>
                  <option value="SELECT" style={{ color: '#000' }}>Seleção</option>
                </select>
              </div>

              {formData.type === 'SELECT' && (
                <div>
                  <label style={{ fontSize: '12px', opacity: 0.8, display: 'block', marginBottom: '6px' }}>
                    Opções
                  </label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input
                      type="text"
                      value={newOption}
                      onChange={(e) => setNewOption(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddOption()}
                      placeholder="Digite uma opção e pressione Enter"
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255,255,255,0.3)',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                        color: 'white',
                        fontSize: '14px',
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddOption}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                      }}
                    >
                      Adicionar
                    </button>
                  </div>
                  {formData.options.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {formData.options.map((option, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            borderRadius: '4px',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: 'white',
                          }}
                        >
                          {option}
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(option)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'white',
                              cursor: 'pointer',
                              fontSize: '14px',
                              padding: 0,
                              lineHeight: 1,
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="required"
                  checked={formData.required}
                  onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="required" style={{ fontSize: '14px', cursor: 'pointer' }}>
                  Campo obrigatório
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingField(null);
                  setFormData({ name: '', type: 'TEXT', required: false, options: [] });
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'white',
                  color: '#0f766e',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                }}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



