require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const Stripe = require('stripe');
const path = require('path');
const fs = require('fs');

// Importa seu robô atual (certifique-se que o nome do arquivo é automato-core.js)
const AutomatoCore = require('./automato-core'); 

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.static('public')); // Serve o site
app.use(express.json({ limit: '50mb' }));

// Conecta ao Banco de Dados
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Banco de Dados Conectado'))
  .catch(err => console.error('❌ Erro DB:', err));

// Modelo do Usuário (Assinante)
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  stripeCustomerId: String,
  subscriptionStatus: { type: String, default: 'inactive' }, // active, inactive
  limiteDiario: { type: Number, default: 5 }, // Limite de execuções por dia
  execucoesHoje: { type: Number, default: 0 },
  ultimaExecucao: Date,
  resultados: [{
    titulo: String,
    conteudo: String,
    preco: Number,
    data: { type: Date, default: Date.now }
  }]
});
const User = mongoose.model('User', UserSchema);

// --- ROTAS DE PAGAMENTO ---

// Criar Checkout
app.post('/api/subscribe', async (req, res) => {
  const { email } = req.body;
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'subscription',
    customer_email: email,
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${process.env.FRONTEND_URL}/dashboard.html?success=true`,
    cancel_url: `${process.env.FRONTEND_URL}/index.html?canceled=true`,
  });
  res.json({ url: session.url });
});

// Webhook (Confirmação automática do Stripe)
app.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) { return res.status(400).send(`Webhook Error: ${err.message}`); }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    await User.findOneAndUpdate(
      { email: session.customer_email },
      { stripeCustomerId: session.customer, subscriptionStatus: 'active', execucoesHoje: 0 },
      { upsert: true }
    );
  }
  res.json({received: true});
});

// --- ROTAS DO ROBÔ ---

// Verificar Status e Limites
app.get('/api/status', async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: 'Email necessário' });
  
  const user = await User.findOne({ email });
  if (!user || user.subscriptionStatus !== 'active') {
    return res.json({ ativo: false, mensagem: 'Assinatura inativa ou não encontrada.' });
  }

  // Reseta contador se for um novo dia
  const hoje = new Date().toDateString();
  const ultimoDia = user.ultimaExecucao ? new Date(user.ultimaExecucao).toDateString() : null;
  if (hoje !== ultimoDia) {
    user.execucoesHoje = 0;
  }

  const podeRodar = user.execucoesHoje < user.limiteDiario;
  
  res.json({
    ativo: true,
    podeRodar,
    execucoesRestantes: user.limiteDiario - user.execucoesHoje,
    resultados: user.resultados.slice(-10) // Últimos 10 resultados
  });
});

// Executar o Robô (Botão do Cliente)
app.post('/api/run', async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user || user.subscriptionStatus !== 'active') {
    return res.status(403).json({ error: 'Assinatura necessária.' });
  }

  // Checa limite diário
  const hoje = new Date().toDateString();
  const ultimoDia = user.ultimaExecucao ? new Date(user.ultimaExecucao).toDateString() : null;
  if (hoje !== ultimoDia) user.execucoesHoje = 0;

  if (user.execucoesHoje >= user.limiteDiario) {
    return res.status(429).json({ error: 'Limite diário atingido. Volte amanhã!' });
  }

  try {
    console.log(`🤖 Rodando para ${email}...`);
    // Chama seu código original do Autômato
    const resultado = await AutomatoCore.executarCiclo(); 
    
    // Salva o resultado no banco do usuário
    if (resultado && resultado.monetizacao && resultado.monetizacao.produto) {
      user.resultados.push({
        titulo: resultado.monetizacao.produto.titulo,
        conteudo: resultado.monetizacao.conteudo,
        preco: resultado.monetizacao.produto.preco
      });
    }

    user.execucoesHoje += 1;
    user.ultimaExecucao = new Date();
    await user.save();

    res.json({ sucesso: true, dados: resultado });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ error: 'Erro ao executar o robô.' });
  }
});

// Inicia Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor SaaS rodando na porta ${PORT}`));