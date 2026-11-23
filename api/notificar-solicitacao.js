export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

  if (!BREVO_API_KEY) {
    return res.status(500).json({ error: 'BREVO_API_KEY não configurada no servidor.' });
  }

  try {
    const { nome, email, cargo, regioes = [], unidades = [], urlPainel } = req.body || {};

    if (!nome || !email || !cargo) {
      return res.status(400).json({ error: 'Dados obrigatórios ausentes (nome, email, cargo).' });
    }

    const cargoLabel =
      cargo === 'gerente'
        ? 'Gerente Corporativo'
        : cargo === 'coordenador'
        ? 'Coordenador Regional'
        : 'Supervisor de Almoxarifado';

    const escopoHtml =
      cargo === 'gerente'
        ? 'Acesso Global (Todas as regiões e usinas)'
        : `<strong>Regiões:</strong> ${regioes.join(', ') || 'Nenhuma'}<br/><strong>Unidades:</strong> ${
            unidades.join(', ') || 'Nenhuma'
          }`;

    const linkPainel = urlPainel || 'https://painelgetaoalmoxambar.vercel.app';

    // Função auxiliar para enviar e-mail via Brevo
    const enviarEmailBrevo = async ({ to, subject, html }) => {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: 'Visão Estoque · Âmbar Energia',
            email: 'bruno.querino@ambarenergia.com.br', // pode trocar depois se quiser
          },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        }),
      });

      const data = await response.json();
      return { ok: response.ok, status: response.status, data };
    };

    // 1. E-mail para o solicitante
    const envioSolicitante = enviarEmailBrevo({
      to: email,
      subject: 'Solicitação de Acesso Recebida · Visão Estoque Âmbar Energia',
      html: `
        <div style="background:#080808;color:#ffffff;font-family:Arial,sans-serif;padding:32px 20px;">
          <div style="max-width:540px;margin:0 auto;background:#111111;border:1px solid #262626;border-radius:16px;padding:28px;">
            <div style="border-bottom:1px solid #222;padding-bottom:16px;margin-bottom:20px;">
              <span style="color:#f58220;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Âmbar Energia</span>
              <h2 style="margin:6px 0 0;font-size:20px;color:#ffffff;">Solicitação de Acesso Recebida</h2>
            </div>
            <p style="font-size:14px;color:#d4d4d4;line-height:1.6;">
              Olá, <strong style="color:#ffffff;">${nome}</strong>!
            </p>
            <p style="font-size:14px;color:#d4d4d4;line-height:1.6;">
              Recebemos seu pedido de liberação de acesso ao painel <strong style="color:#f58220;">Visão Estoque</strong>. Sua solicitação já está na fila de avaliação do Administrador.
            </p>
            <div style="background:#0b0b0b;border:1px solid #242424;border-radius:12px;padding:16px;margin:20px 0;font-size:13px;color:#cccccc;line-height:1.6;">
              <strong>Perfil solicitado:</strong> ${cargoLabel}<br/>
              ${escopoHtml}<br/>
              <strong>Status atual:</strong> <span style="color:#f58220;font-weight:bold;">EM AVALIAÇÃO</span>
            </div>
            <p style="font-size:13px;color:#9ca3af;line-height:1.6;">
              Assim que o acesso for aprovado e sua senha provisória for liberada, você poderá entrar diretamente pelo painel. Não é necessário enviar uma nova solicitação.
            </p>
          </div>
        </div>
      `,
    });

    // 2. E-mail para o Administrador
    const envioAdmin = ADMIN_EMAIL
      ? enviarEmailBrevo({
          to: ADMIN_EMAIL,
          subject: `[Novo Pedido de Acesso] ${nome} (${cargoLabel})`,
          html: `
            <div style="background:#080808;color:#ffffff;font-family:Arial,sans-serif;padding:32px 20px;">
              <div style="max-width:540px;margin:0 auto;background:#111111;border:1px solid #f58220;border-radius:16px;padding:28px;">
                <div style="border-bottom:1px solid #222;padding-bottom:16px;margin-bottom:20px;">
                  <span style="color:#f58220;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Administração · Visão Estoque</span>
                  <h2 style="margin:6px 0 0;font-size:20px;color:#ffffff;">Nova Solicitação de Acesso Pendente</h2>
                </div>
                <p style="font-size:14px;color:#d4d4d4;line-height:1.6;">
                  Um colaborador solicitou liberação de acesso e está aguardando sua aprovação no módulo <strong>Controle de Acessos</strong>:
                </p>
                <div style="background:#0b0b0b;border:1px solid #242424;border-radius:12px;padding:16px;margin:20px 0;font-size:13px;color:#cccccc;line-height:1.7;">
                  <strong>Nome:</strong> ${nome}<br/>
                  <strong>E-mail:</strong> ${email}<br/>
                  <strong>Cargo:</strong> ${cargoLabel}<br/>
                  ${escopoHtml}
                </div>
                <div style="text-align:center;margin-top:24px;">
                  <a href="${linkPainel}" style="display:inline-block;background:#f58220;color:#000000;font-weight:bold;font-size:13px;text-decoration:none;padding:12px 24px;border-radius:10px;text-transform:uppercase;">
                    Abrir Painel para Aprovar
                  </a>
                </div>
              </div>
            </div>
          `,
        })
      : Promise.resolve(null);

    const [resSol, resAdm] = await Promise.all([envioSolicitante, envioAdmin]);

    return res.status(200).json({
      ok: true,
      solicitante: resSol,
      admin: resAdm,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Erro interno ao enviar e-mails.' });
  }
}