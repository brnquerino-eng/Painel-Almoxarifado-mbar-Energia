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
    const emailCorporativo = 'bruno.querino@ambarenergia.com.br';

    // Remetente verificado no Brevo (Gmail)
    const REMETENTE = {
      name: 'Visão Estoque · Âmbar Energia',
      email: 'brnquerino@gmail.com',
    };

    const enviarEmailBrevo = async ({ to, subject, html }) => {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: REMETENTE,
          to: [{ email: to }],
          subject,
          htmlContent: html,
          // Reply-To agora aponta para o e-mail corporativo
          replyTo: { email: emailCorporativo, name: 'Visão Estoque · Âmbar Energia' },
        }),
      });

      const data = await response.json();
      return { ok: response.ok, status: response.status, data };
    };

    // 1. E-mail para o solicitante
    const envioSolicitante = enviarEmailBrevo({
      to: email,
      subject: 'Solicitação de Acesso Recebida · Visão Estoque',
      html: `
        <div style="background:#f9f9f9;color:#333333;font-family:Arial,Helvetica,sans-serif;padding:24px;line-height:1.5;">
          <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;padding:28px;">
            <h2 style="margin:0 0 16px;font-size:20px;color:#111;">Solicitação de Acesso Recebida</h2>
            <p>Olá, <strong>${nome}</strong>,</p>
            <p>Recebemos sua solicitação de acesso ao painel <strong>Visão Estoque</strong> da Âmbar Energia.</p>
            <p>Seu pedido está na fila de avaliação do administrador.</p>
            <div style="background:#f5f5f5;border-radius:6px;padding:16px;margin:20px 0;font-size:14px;">
              <strong>Perfil solicitado:</strong> ${cargoLabel}<br/>
              ${escopoHtml}<br/>
              <strong>Status:</strong> Em avaliação
            </div>
            <p style="font-size:13px;color:#666;">
              Assim que o acesso for liberado, você receberá as instruções para o primeiro login.
              Não é necessário enviar uma nova solicitação.
            </p>
            <p style="font-size:12px;color:#999;margin-top:28px;">
              Este é um e-mail automático. <strong>Não responda esta mensagem.</strong><br/>
              Em caso de dúvidas, entre em contato com: <strong>${emailCorporativo}</strong>
            </p>
          </div>
        </div>
      `,
    });

    // 2. E-mail para o Administrador
    const envioAdmin = ADMIN_EMAIL
      ? enviarEmailBrevo({
          to: ADMIN_EMAIL,
          subject: `[Nova Solicitação] ${nome} – ${cargoLabel}`,
          html: `
            <div style="background:#f9f9f9;color:#333333;font-family:Arial,Helvetica,sans-serif;padding:24px;line-height:1.5;">
              <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;padding:28px;">
                <h2 style="margin:0 0 16px;font-size:20px;color:#111;">Nova Solicitação de Acesso</h2>
                <p>Um colaborador solicitou acesso ao painel Visão Estoque:</p>
                <div style="background:#f5f5f5;border-radius:6px;padding:16px;margin:20px 0;font-size:14px;">
                  <strong>Nome:</strong> ${nome}<br/>
                  <strong>E-mail:</strong> ${email}<br/>
                  <strong>Cargo:</strong> ${cargoLabel}<br/>
                  ${escopoHtml}
                </div>
                <p style="font-size:14px;margin:20px 0;">
                  <strong>Acesse o painel para aprovar:</strong><br/>
                  ${linkPainel}
                </p>
                <p style="font-size:12px;color:#999;margin-top:28px;">
                  Este é um aviso automático do sistema. Não responda este e-mail.
                </p>
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