export default async function handler(req, res) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método não permitido' });
    }
  
    const BREVO_API_KEY = process.env.BREVO_API_KEY;
  
    if (!BREVO_API_KEY) {
      return res.status(500).json({ error: 'BREVO_API_KEY não configurada no servidor.' });
    }
  
    try {
      const { nome, email, senhaTemporaria, urlPainel } = req.body || {};
  
      if (!nome || !email || !senhaTemporaria) {
        return res.status(400).json({ error: 'Dados obrigatórios ausentes (nome, email, senhaTemporaria).' });
      }
  
      const linkPainel = urlPainel || 'https://gestao-estoque-ambar.vercel.app';
      const emailCorporativo = 'bruno.querino@ambarenergia.com.br';
  
      const REMETENTE = {
        name: 'Visão Estoque · Âmbar Energia',
        email: 'brnquerino@gmail.com',
      };
  
      const html = `
        <div style="background:#f9f9f9;color:#333333;font-family:Arial,Helvetica,sans-serif;padding:24px;line-height:1.5;">
          <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e5e5;border-radius:8px;padding:28px;">
            <h2 style="margin:0 0 16px;font-size:20px;color:#111;">Acesso Liberado · Visão Estoque</h2>
            <p>Olá, <strong>${nome}</strong>,</p>
            <p>Seu acesso ao painel <strong>Visão Estoque</strong> da Âmbar Energia foi aprovado.</p>
            
            <div style="background:#f5f5f5;border-radius:6px;padding:16px;margin:20px 0;font-size:14px;">
              <strong>E-mail de acesso:</strong> ${email}<br/>
              <strong>Senha temporária:</strong> <span style="font-family:monospace;font-size:16px;color:#f58220;font-weight:bold;">${senhaTemporaria}</span>
            </div>
  
            <p style="font-size:14px;">
              <strong>Importante:</strong> No primeiro acesso você será obrigado a criar uma nova senha pessoal.
              A senha temporária acima serve apenas para o primeiro login.
            </p>
  
            <p style="font-size:14px;margin:20px 0;">
              <strong>Acesse o painel:</strong><br/>
              ${linkPainel}
            </p>
  
            <p style="font-size:12px;color:#999;margin-top:28px;">
              Este é um e-mail automático. <strong>Não responda esta mensagem.</strong><br/>
              Em caso de dúvidas, entre em contato com: <strong>${emailCorporativo}</strong>
            </p>
          </div>
        </div>
      `;
  
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: REMETENTE,
          to: [{ email }],
          subject: 'Acesso Liberado · Visão Estoque Âmbar Energia',
          htmlContent: html,
          replyTo: { email: emailCorporativo, name: 'Visão Estoque · Âmbar Energia' },
        }),
      });
  
      const data = await response.json();
  
      return res.status(200).json({
        ok: response.ok,
        status: response.status,
        data,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Erro interno ao enviar e-mail de aprovação.' });
    }
  }