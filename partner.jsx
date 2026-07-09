/* partner.jsx — cadastro público de parceiros */

const PartnerForm = () => {
  const [form, setForm] = React.useState({
    nome: "", cidade: "", email: "", contato: "",
    tipoServico: "", equipamento: "", portfolio: "", mediaValor: "",
  });
  const [sending, setSending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.nome || !form.cidade || !form.email || !form.tipoServico || !form.equipamento) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }
    setSending(true);
    try {
      await window.API.submitPartner(form);
      setDone(true);
    } catch (ex) {
      setError(ex?.error || "Erro ao enviar. Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="partner-shell">
        <div className="partner-card partner-success">
          <div className="partner-success-icon">
            <Icon name="check" size={32} />
          </div>
          <h2>Cadastro enviado!</h2>
          <p>Obrigado pelo interesse em fazer parte da rede Framety.<br/>Entraremos em contato em breve.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="partner-shell">
      <div className="partner-card">
        <header className="partner-header">
          <div className="partner-logos">
            <img src="/vector_framety.svg?v=1" alt="Framety" style={{ height: 52, transform: "translateY(8px)" }} />
            <img src="/vector_bar.svg?v=1" alt="|" style={{ height: 30, opacity: 0.4 }} />
            <img src="/vector_skyline.svg?v=1" alt="Grupo Skyline" style={{ height: 30 }} />
          </div>
          <h1>Cadastro de Parceiro</h1>
          <p>Faça parte da nossa rede de profissionais de captação e locução.</p>
        </header>

        <form className="partner-form" onSubmit={handleSubmit} noValidate>
          <div className="partner-grid">

            <div className="pf-field pf-full">
              <label>Nome completo <span className="pf-req">*</span></label>
              <input
                type="text"
                value={form.nome}
                onChange={e => set("nome", e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>

            <div className="pf-field">
              <label>Cidade / Estado <span className="pf-req">*</span></label>
              <input
                type="text"
                value={form.cidade}
                onChange={e => set("cidade", e.target.value)}
                placeholder="Ex: São Paulo, SP"
              />
            </div>

            <div className="pf-field">
              <label>E-mail <span className="pf-req">*</span></label>
              <input
                type="email"
                value={form.email}
                onChange={e => set("email", e.target.value)}
                placeholder="seu@email.com"
              />
            </div>

            <div className="pf-field">
              <label>WhatsApp</label>
              <input
                type="tel"
                value={form.contato}
                onChange={e => set("contato", e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className="pf-field">
              <label>Tipo de serviço <span className="pf-req">*</span></label>
              <select value={form.tipoServico} onChange={e => set("tipoServico", e.target.value)}>
                <option value="">Selecione…</option>
                <option value="Locução">Locução</option>
                <option value="Captação">Captação</option>
                <option value="Locução e Captação">Locução e Captação</option>
              </select>
            </div>

            <div className="pf-field pf-full">
              <label>Equipamentos que possui <span className="pf-req">*</span></label>
              <textarea
                rows={3}
                value={form.equipamento}
                onChange={e => set("equipamento", e.target.value)}
                placeholder="Câmeras, lentes, microfones, iluminação…"
              />
            </div>

            <div className="pf-field">
              <label>Link do portfólio</label>
              <input
                type="url"
                value={form.portfolio}
                onChange={e => set("portfolio", e.target.value)}
                placeholder="https://…"
              />
            </div>

            <div className="pf-field">
              <label>Média de valores por diária</label>
              <input
                type="text"
                value={form.mediaValor}
                onChange={e => set("mediaValor", e.target.value)}
                placeholder="Ex: R$ 800"
              />
            </div>

          </div>

          {error && <div className="pf-error">{error}</div>}

          <div className="pf-actions">
            <button type="submit" className="btn btn-accent pf-submit" disabled={sending} data-cursor="hover">
              {sending
                ? <><Icon name="loader" size={14} /> Enviando…</>
                : <><Icon name="send" size={14} /> Enviar cadastro</>
              }
            </button>
          </div>

          <p className="pf-note">Campos marcados com <span className="pf-req">*</span> são obrigatórios.</p>
        </form>
      </div>
    </div>
  );
};

Object.assign(window, { PartnerForm });
