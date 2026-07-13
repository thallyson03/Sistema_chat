import { useEffect, useState } from 'react';
import api from '../utils/api';

type VoiceChannel = {
  id: string;
  name: string;
  status: string;
  sector?: { id: string; name: string } | null;
  config: {
    provider?: string;
    phoneNumber?: string | null;
    phoneNumberSid?: string | null;
    accountSid?: string;
    hasAuthToken?: boolean;
    hasApiKeySecret?: boolean;
    twimlAppSid?: string | null;
    recordingEnabled?: boolean;
  };
};

type AvailableNumber = {
  phoneNumber: string;
  friendlyName: string;
  locality?: string;
  region?: string;
  isoCountry: string;
};

type Sector = { id: string; name: string };

export default function Voice() {
  const [channels, setChannels] = useState<VoiceChannel[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    accountSid: '',
    authToken: '',
    apiKeySid: '',
    apiKeySecret: '',
    twimlAppSid: '',
    recordingEnabled: false,
    sectorId: '',
  });

  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [searchForm, setSearchForm] = useState({
    country: 'BR',
    areaCode: '',
    contains: '',
    type: 'local' as 'local' | 'mobile' | 'tollFree',
  });
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);
  const [searching, setSearching] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [chRes, secRes] = await Promise.all([
        api.get('/api/voice/channels'),
        api.get('/api/sectors').catch(() => ({ data: [] })),
      ]);
      setChannels(chRes.data || []);
      setSectors(secRes.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao carregar canais de voz');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      await api.post('/api/voice/channels', {
        ...createForm,
        sectorId: createForm.sectorId || undefined,
      });
      setShowCreate(false);
      setCreateForm({
        name: '',
        accountSid: '',
        authToken: '',
        apiKeySid: '',
        apiKeySecret: '',
        twimlAppSid: '',
        recordingEnabled: false,
        sectorId: '',
      });
      setSuccess('Conta Twilio vinculada. Agora busque e compre um número.');
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao criar canal');
    }
  };

  const handleSearch = async (channelId: string) => {
    setError('');
    setSearching(true);
    setActiveChannelId(channelId);
    try {
      const res = await api.get(`/api/voice/channels/${channelId}/numbers/search`, {
        params: {
          country: searchForm.country,
          areaCode: searchForm.areaCode || undefined,
          contains: searchForm.contains || undefined,
          type: searchForm.type,
          limit: 20,
        },
      });
      setAvailableNumbers(res.data.numbers || []);
      if (!(res.data.numbers || []).length) {
        setError('Nenhum número disponível com esses filtros na Twilio.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao buscar números na Twilio');
      setAvailableNumbers([]);
    } finally {
      setSearching(false);
    }
  };

  const handlePurchase = async (channelId: string, phoneNumber: string) => {
    setError('');
    setSuccess('');
    setPurchasing(phoneNumber);
    try {
      await api.post(`/api/voice/channels/${channelId}/numbers/purchase`, { phoneNumber });
      setSuccess(`Número ${phoneNumber} comprado na Twilio e ativado no CRM.`);
      setAvailableNumbers([]);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao comprar número');
    } finally {
      setPurchasing(null);
    }
  };

  const handleRelease = async (channelId: string) => {
    if (!confirm('Liberar este número na Twilio? A cobrança mensal para de ser feita pela provedora.')) {
      return;
    }
    setError('');
    try {
      await api.post(`/api/voice/channels/${channelId}/numbers/release`);
      setSuccess('Número liberado na Twilio.');
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao liberar número');
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl font-bold tracking-tight text-on-surface">
            Telefonia / VoIP
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Vincule sua conta Twilio e compre números diretamente na provedora. O CRM só orquestra a
            compra e as ligações.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-on-primary shadow-emerald-send transition hover:brightness-110"
        >
          + Conta Twilio
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-error/40 bg-error/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-primary-fixed-dim">
          {success}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-on-surface-variant">Carregando...</p>
      ) : channels.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container px-6 py-10 text-center">
          <p className="text-sm text-on-surface-variant">
            Nenhum canal de voz. Cadastre as credenciais da sua conta Twilio para começar.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {channels.map((channel) => (
            <div
              key={channel.id}
              className="rounded-2xl border border-outline-variant bg-surface-container-highest p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-on-surface">{channel.name}</h2>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Status: <span className="text-on-surface">{channel.status}</span>
                    {channel.config.phoneNumber
                      ? ` · Número: ${channel.config.phoneNumber}`
                      : ' · Sem número comprado'}
                    {channel.sector ? ` · Setor: ${channel.sector.name}` : ''}
                  </p>
                  <p className="mt-1 text-[11px] text-on-surface-variant/80">
                    Conta {channel.config.accountSid || '—'} · Softphone{' '}
                    {channel.config.twimlAppSid && channel.config.hasApiKeySecret
                      ? 'configurado'
                      : 'pendente (API Key + TwiML App)'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleSearch(channel.id)}
                    disabled={searching && activeChannelId === channel.id}
                    className="rounded-lg border border-primary/35 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary-fixed-dim transition hover:bg-primary/15"
                  >
                    {searching && activeChannelId === channel.id
                      ? 'Buscando...'
                      : 'Buscar números'}
                  </button>
                  {channel.config.phoneNumberSid ? (
                    <button
                      type="button"
                      onClick={() => handleRelease(channel.id)}
                      className="rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-error/20"
                    >
                      Liberar número
                    </button>
                  ) : null}
                </div>
              </div>

              {activeChannelId === channel.id ? (
                <div className="mt-4 space-y-3 border-t border-outline-variant pt-4">
                  <div className="grid gap-2 sm:grid-cols-4">
                    <input
                      className="rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm"
                      value={searchForm.country}
                      onChange={(e) => setSearchForm({ ...searchForm, country: e.target.value })}
                      placeholder="País (BR)"
                    />
                    <input
                      className="rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm"
                      value={searchForm.areaCode}
                      onChange={(e) => setSearchForm({ ...searchForm, areaCode: e.target.value })}
                      placeholder="DDD / Area code"
                    />
                    <input
                      className="rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm"
                      value={searchForm.contains}
                      onChange={(e) => setSearchForm({ ...searchForm, contains: e.target.value })}
                      placeholder="Contém dígitos"
                    />
                    <select
                      className="rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm"
                      value={searchForm.type}
                      onChange={(e) =>
                        setSearchForm({
                          ...searchForm,
                          type: e.target.value as 'local' | 'mobile' | 'tollFree',
                        })
                      }
                    >
                      <option value="local">Local</option>
                      <option value="mobile">Móvel</option>
                      <option value="tollFree">Toll-free</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSearch(channel.id)}
                    className="text-xs font-semibold text-primary-fixed-dim underline"
                  >
                    Atualizar busca
                  </button>

                  {availableNumbers.length > 0 ? (
                    <ul className="divide-y divide-outline-variant rounded-lg border border-outline-variant">
                      {availableNumbers.map((num) => (
                        <li
                          key={num.phoneNumber}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                        >
                          <div>
                            <p className="font-medium text-on-surface">{num.phoneNumber}</p>
                            <p className="text-xs text-on-surface-variant">
                              {[num.locality, num.region, num.isoCountry].filter(Boolean).join(' · ')}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={purchasing === num.phoneNumber}
                            onClick={() => handlePurchase(channel.id, num.phoneNumber)}
                            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary transition hover:brightness-110 disabled:opacity-50"
                          >
                            {purchasing === num.phoneNumber ? 'Comprando...' : 'Comprar na Twilio'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {showCreate ? (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-[2px]"
          onClick={() => setShowCreate(false)}
          role="presentation"
        >
          <form
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-outline-variant bg-surface-container-highest p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreate}
          >
            <h2 className="mb-1 text-lg font-bold">Vincular conta Twilio</h2>
            <p className="mb-4 text-xs text-on-surface-variant">
              As credenciais ficam no CRM criptografadas. A compra do número é feita na sua conta
              Twilio.
            </p>
            <div className="space-y-3">
              <input
                required
                placeholder="Nome do canal"
                className="w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2.5 text-sm"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              />
              <input
                required
                placeholder="Account SID"
                className="w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2.5 text-sm"
                value={createForm.accountSid}
                onChange={(e) => setCreateForm({ ...createForm, accountSid: e.target.value })}
              />
              <input
                required
                type="password"
                placeholder="Auth Token"
                className="w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2.5 text-sm"
                value={createForm.authToken}
                onChange={(e) => setCreateForm({ ...createForm, authToken: e.target.value })}
              />
              <input
                placeholder="API Key SID (softphone)"
                className="w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2.5 text-sm"
                value={createForm.apiKeySid}
                onChange={(e) => setCreateForm({ ...createForm, apiKeySid: e.target.value })}
              />
              <input
                type="password"
                placeholder="API Key Secret (softphone)"
                className="w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2.5 text-sm"
                value={createForm.apiKeySecret}
                onChange={(e) => setCreateForm({ ...createForm, apiKeySecret: e.target.value })}
              />
              <input
                placeholder="TwiML App SID (softphone)"
                className="w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2.5 text-sm"
                value={createForm.twimlAppSid}
                onChange={(e) => setCreateForm({ ...createForm, twimlAppSid: e.target.value })}
              />
              <select
                className="w-full rounded-lg border border-outline-variant bg-surface-container px-3 py-2.5 text-sm"
                value={createForm.sectorId}
                onChange={(e) => setCreateForm({ ...createForm, sectorId: e.target.value })}
              >
                <option value="">Setor (opcional)</option>
                {sectors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-on-surface">
                <input
                  type="checkbox"
                  checked={createForm.recordingEnabled}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, recordingEnabled: e.target.checked })
                  }
                />
                Gravar chamadas por padrão
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-on-primary"
              >
                Salvar
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
