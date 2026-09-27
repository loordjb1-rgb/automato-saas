// ==========================================
// AUTÔMATO — RADAR v3.1
// RADAR DE OPORTUNIDADES MONETIZÁVEIS
// ==========================================
//
// Objetivo:
//
// DESCOBRIR
//    ↓
// PROBLEMA
//    ↓
// DEMANDA
//    ↓
// DINHEIRO
//    ↓
// OPORTUNIDADE
//    ↓
// INVESTIGAÇÃO
//    ↓
// EXPERIMENTO
//    ↓
// APRENDIZADO
//
// O Radar NÃO depende somente de notícias.
// Ele procura sinais de intenção comercial,
// problemas, procura por soluções,
// automação, pequenos negócios e dinheiro.
//
// v3.1:
// - Mantida toda a lógica do Radar v3.0.
// - Melhorada a camada HTTPS.
// - Fallback seguro para curl do sistema.
// - Não desativa validação SSL.
// ==========================================

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const VERSAO = "3.1";

const CONFIG = {
  MIN_PONTUACAO: 30,
  MIN_PONTUACAO_ADAPTATIVA: 22,

  MAX_OPORTUNIDADES: 15,
  MAX_RESULTADOS_POR_FONTE: 30,

  TIMEOUT_MS: 15000,

  MEMORIA: path.join(
    __dirname,
    "radar-memoria.json"
  )
};

// ==========================================
// MEMÓRIA
// ==========================================

function memoriaPadrao() {
  return {
    versao: 1,

    ciclos: 0,

    oportunidadesDetectadas: 0,

    experimentos: 0,
    sucessos: 0,
    fracassos: 0,

    palavrasBoas: {},
    palavrasRuins: {},

    categoriasBoas: {},
    categoriasRuins: {},

    fontesBoas: {},
    fontesRuins: {},

    vistos: {},

    ultimosResultados: [],

    historico: []
  };
}

function carregarMemoria() {
  try {
    if (!fs.existsSync(CONFIG.MEMORIA)) {
      return memoriaPadrao();
    }

    const memoria = JSON.parse(
      fs.readFileSync(
        CONFIG.MEMORIA,
        "utf8"
      )
    );

    return {
      ...memoriaPadrao(),
      ...memoria
    };

  } catch (erro) {
    return memoriaPadrao();
  }
}

function salvarMemoria(memoria) {
  try {
    fs.writeFileSync(
      CONFIG.MEMORIA,
      JSON.stringify(
        memoria,
        null,
        2
      ),
      "utf8"
    );
  } catch (erro) {
    console.log(
      "[MEMÓRIA] Não foi possível salvar:",
      erro.message
    );
  }
}

// ==========================================
// UTILITÁRIOS
// ==========================================

function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function limpar(texto) {
  return String(texto || "")
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      " "
    )
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      " "
    )
    .replace(
      /<[^>]+>/g,
      " "
    )
    .replace(
      /<!\[CDATA\[|\]\]>/g,
      " "
    )
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /&#39;|&apos;/gi,
      "'"
    )
    .replace(
      /&#8216;|&#8217;/gi,
      "'"
    )
    .replace(
      /&#8220;|&#8221;/gi,
      '"'
    )
    .replace(
      /&lt;/gi,
      "<"
    )
    .replace(
      /&gt;/gi,
      ">"
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

function encontrar(texto, termos) {
  const base = normalizar(texto);

  return termos.filter(
    termo =>
      base.includes(
        normalizar(termo)
      )
  );
}

function numero(valor) {
  const n = Number(valor);

  return Number.isFinite(n)
    ? n
    : 0;
}

function limitar(valor, minimo, maximo) {
  return Math.max(
    minimo,
    Math.min(
      maximo,
      valor
    )
  );
}

// ==========================================
// SINAIS COMERCIAIS
// ==========================================

const SINAIS = {

  problema: [
    "problem",
    "problems",
    "pain point",
    "pain points",
    "frustrating",
    "frustrated",
    "struggle",
    "struggling",
    "difficult",
    "difficulty",
    "hard to",
    "annoying",
    "waste time",
    "wastes time",
    "tedious",
    "manual",
    "repetitive",
    "broken",
    "doesn't work",
    "does not work",
    "need help",
    "can't",
    "cannot",
    "issue",
    "issues",
    "bottleneck",
    "inefficient",
    "slow",
    "expensive problem",

    "problema",
    "problemas",
    "dificil",
    "difícil",
    "dificuldade",
    "frustrante",
    "frustracao",
    "frustração",
    "perco tempo",
    "perdendo tempo",
    "trabalho manual",
    "repetitivo",
    "nao funciona",
    "não funciona",
    "preciso de ajuda",
    "gargalo",
    "ineficiente",
    "demorado"
  ],

  demanda: [
    "looking for",
    "looking for a tool",
    "looking for software",
    "looking for a solution",
    "need a tool",
    "need software",
    "need a solution",
    "need an app",
    "need a service",
    "recommend a tool",
    "recommend software",
    "what tool",
    "what software",
    "how do i automate",
    "how can i automate",
    "is there a tool",
    "is there software",
    "any tool",
    "any software",
    "alternative to",
    "looking for someone",
    "where can i find",
    "can someone recommend",

    "procuro",
    "procurando",
    "preciso de uma ferramenta",
    "preciso de software",
    "preciso de uma solução",
    "preciso de um aplicativo",
    "preciso de um serviço",
    "alguem conhece uma ferramenta",
    "alguém conhece uma ferramenta",
    "tem alguma ferramenta",
    "existe alguma ferramenta",
    "como automatizar",
    "quero automatizar",
    "procuro alguem",
    "procuro alguém",
    "alguem recomenda",
    "alguém recomenda",
    "alternativa para"
  ],

  dinheiro: [
    "pay",
    "paying",
    "paid",
    "willing to pay",
    "would pay",
    "worth paying",
    "cost",
    "costs",
    "expensive",
    "pricing",
    "price",
    "subscription",
    "revenue",
    "sales",
    "customers",
    "clients",
    "bill",
    "billing",
    "invoice",
    "invoices",
    "leads",
    "lead generation",
    "conversion",
    "budget",
    "charge",
    "charges",
    "profit",
    "profitable",
    "monetize",
    "monetization",

    "pagar",
    "pagando",
    "pagaria",
    "disposto a pagar",
    "vale pagar",
    "custa",
    "caro",
    "preco",
    "preço",
    "assinatura",
    "receita",
    "vendas",
    "clientes",
    "cobranca",
    "cobrança",
    "fatura",
    "faturamento",
    "leads",
    "conversao",
    "conversão",
    "orcamento",
    "orçamento",
    "cobrar",
    "lucro",
    "lucrativo",
    "monetizar",
    "monetizacao",
    "monetização"
  ],

  automacao: [
    "automation",
    "automate",
    "automated",
    "workflow",
    "workflows",
    "bot",
    "ai agent",
    "agent",
    "integration",
    "integrate",
    "api",
    "no-code",
    "low-code",
    "zapier",
    "make.com",
    "n8n",
    "crm automation",
    "automated workflow",

    "automacao",
    "automação",
    "automatizar",
    "automatizado",
    "fluxo",
    "robô",
    "robo",
    "agente",
    "integracao",
    "integração",
    "api",
    "fluxo automatico",
    "fluxo automático"
  ],

  negocio: [
    "small business",
    "small businesses",
    "business owner",
    "business owners",
    "entrepreneur",
    "entrepreneurs",
    "agency",
    "agencies",
    "freelancer",
    "freelancers",
    "shop owner",
    "store owner",
    "local business",
    "startup",
    "company",
    "companies",
    "solopreneur",
    "creator business",
    "ecommerce",

    "pequena empresa",
    "pequenas empresas",
    "empresario",
    "empresários",
    "empreendedor",
    "empreendedores",
    "agencia",
    "agência",
    "freelancer",
    "loja",
    "comercio",
    "comércio",
    "empresa",
    "empresas",
    "negocio",
    "negócio",
    "negocios",
    "negócios",
    "ecommerce"
  ],

  solucao: [
    "tool",
    "software",
    "platform",
    "service",
    "app",
    "saas",
    "solution",
    "product",
    "template",
    "plugin",
    "extension",
    "dashboard",
    "crm",
    "integration",
    "website",
    "software tool",

    "ferramenta",
    "software",
    "plataforma",
    "servico",
    "serviço",
    "aplicativo",
    "solucao",
    "solução",
    "produto",
    "modelo",
    "plugin",
    "extensao",
    "extensão",
    "painel",
    "site",
    "sistema"
  ],

  crescimento: [
    "growing",
    "growth",
    "more customers",
    "more leads",
    "increase sales",
    "increase revenue",
    "scale",
    "scaling",
    "grow business",
    "get customers",
    "get more clients",

    "crescimento",
    "crescendo",
    "mais clientes",
    "mais leads",
    "aumentar vendas",
    "aumentar receita",
    "escalar",
    "escala",
    "crescer negocio",
    "crescer negócio",
    "conseguir clientes",
    "mais clientes"
  ]
};

// ==========================================
// EXCLUSÕES
// ==========================================

const EXCLUSOES = [
  "shooting",
  "murder",
  "killed",
  "death",
  "terrorism",
  "terrorist",
  "war",
  "violence",
  "tiroteio",
  "assassinato",
  "morte",
  "terrorismo",
  "guerra",
  "violencia",
  "violência",

  "lawsuit",
  "lawsuits",
  "court",
  "judge",
  "litigation",
  "sued",
  "suing",
  "legal dispute",
  "processo judicial",
  "tribunal",
  "juiz",
  "litigio",
  "litígio",

  "stock price",
  "shares fell",
  "shares rise",
  "earnings report",
  "quarterly earnings",

  "movie review",
  "film review",
  "celebrity gossip",
  "sports score",
  "football score",
  "basketball score"
];

// ==========================================
// FONTES
// ==========================================

const FONTES = [

  {
    nome: "Reddit Small Business",
    categoria: "NEGOCIO",
    url:
      "https://www.reddit.com/r/smallbusiness/.rss"
  },

  {
    nome: "Reddit Entrepreneur",
    categoria: "NEGOCIO",
    url:
      "https://www.reddit.com/r/Entrepreneur/.rss"
  },

  {
    nome: "Reddit SaaS",
    categoria: "SOFTWARE",
    url:
      "https://www.reddit.com/r/SaaS/.rss"
  },

  {
    nome: "Reddit Automation",
    categoria: "AUTOMACAO",
    url:
      "https://www.reddit.com/r/automation/.rss"
  },

  {
    nome: "Hacker News",
    categoria: "TECNOLOGIA",
    url:
      "https://hnrss.org/newest"
  },

  {
    nome: "Google News — Looking for Tool",
    categoria: "DEMANDA",
    url:
      "https://news.google.com/rss/search?q=%22looking+for%22+%22tool%22+software&hl=en-US&gl=US&ceid=US:en"
  },

  {
    nome: "Google News — Automation",
    categoria: "AUTOMACAO",
    url:
      "https://news.google.com/rss/search?q=%22how+to+automate%22+business&hl=en-US&gl=US&ceid=US:en"
  },

  {
    nome: "Google News — Small Business",
    categoria: "NEGOCIO",
    url:
      "https://news.google.com/rss/search?q=%22small+business%22+%22need%22+software&hl=en-US&gl=US&ceid=US:en"
  },

  {
    nome: "Google News — SaaS Problems",
    categoria: "SOFTWARE",
    url:
      "https://news.google.com/rss/search?q=software+problem+%22looking+for%22+solution&hl=en-US&gl=US&ceid=US:en"
  },

  {
    nome: "Google News — Freelancers",
    categoria: "SERVICO",
    url:
      "https://news.google.com/rss/search?q=freelancer+%22looking+for%22+tool+OR+service&hl=en-US&gl=US&ceid=US:en"
  }
];

// ==========================================
// HTTP / HTTPS
// ==========================================
//
// Primeiro usamos o HTTPS nativo do Node.
//
// Se o Node apresentar erro de certificado,
// fazemos fallback para o curl do sistema.
//
// IMPORTANTE:
// NÃO usamos rejectUnauthorized:false.
// A validação SSL continua ativa.
//
// ==========================================

function baixarComCurl(url) {

  return new Promise(
    (resolve, reject) => {

      const comando =
        process.platform === "win32"
          ? "curl.exe"
          : "curl";

      const argumentos = [
        "-L",
        "--silent",
        "--show-error",
        "--fail",
        "--max-time",
        String(
          Math.ceil(
            CONFIG.TIMEOUT_MS / 1000
          )
        ),
        "-A",
        "Mozilla/5.0 AUTÔMATO-Radar/3.1",
        "-H",
        "Accept: application/rss+xml, application/xml, text/xml, */*",
        url
      ];

      execFile(
        comando,
        argumentos,
        {
          windowsHide: true,
          maxBuffer: 10 * 1024 * 1024,
          timeout:
            CONFIG.TIMEOUT_MS + 2000
        },
        (erro, stdout, stderr) => {

          if (erro) {

            const detalhe =
              String(
                stderr ||
                erro.message ||
                ""
              ).trim();

            reject(
              new Error(
                detalhe ||
                "Falha no curl."
              )
            );

            return;
          }

          if (
            !stdout ||
            !String(stdout).trim()
          ) {

            reject(
              new Error(
                "curl retornou conteúdo vazio."
              )
            );

            return;
          }

          resolve(
            String(stdout)
          );
        }
      );
    }
  );
}

async function baixarComFallback(url) {

  try {

    return await baixarComCurl(url);

  } catch (erroCurl) {

    throw new Error(
      `HTTPS Node e curl falharam. Node: ${erroCurl.nodeErro || "erro de certificado"}. Curl: ${erroCurl.message}`
    );
  }
}

function baixarNode(url, tentativas = 0) {

  return new Promise(
    (resolve, reject) => {

      const cliente =
        url.startsWith("https")
          ? https
          : http;

      const req =
        cliente.get(
          url,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 AUTÔMATO-Radar/3.1",
              "Accept":
                "application/rss+xml, application/xml, text/xml, */*"
            }
          },
          res => {

            let dados = "";

            res.setEncoding("utf8");

            res.on(
              "data",
              bloco => {
                dados += bloco;
              }
            );

            res.on(
              "end",
              () => {

                if (
                  res.statusCode >= 300 &&
                  res.statusCode < 400 &&
                  res.headers.location
                ) {

                  if (tentativas >= 3) {

                    reject(
                      new Error(
                        "Muitas redireções."
                      )
                    );

                    return;
                  }

                  let destino =
                    res.headers.location;

                  try {

                    destino =
                      new URL(
                        destino,
                        url
                      ).toString();

                  } catch (_) {}

                  baixarNode(
                    destino,
                    tentativas + 1
                  )
                    .then(resolve)
                    .catch(reject);

                  return;
                }

                if (
                  res.statusCode >= 400
                ) {

                  reject(
                    new Error(
                      `HTTP ${res.statusCode}`
                    )
                  );

                  return;
                }

                resolve(dados);
              }
            );
          }
        );

      req.setTimeout(
        CONFIG.TIMEOUT_MS,
        () => {

          req.destroy();

          reject(
            new Error(
              "Timeout"
            )
          );
        }
      );

      req.on(
        "error",
        reject
      );
    }
  );
}

async function baixar(url, tentativas = 0) {

  try {

    return await baixarNode(
      url,
      tentativas
    );

  } catch (erro) {

    const mensagem =
      String(
        erro?.message ||
        erro ||
        ""
      );

    const certificado =
      mensagem.includes(
        "certificate is not yet valid"
      ) ||
      mensagem.includes(
        "CERT_NOT_YET_VALID"
      ) ||
      mensagem.includes(
        "certificate has expired"
      ) ||
      mensagem.includes(
        "CERT_HAS_EXPIRED"
      ) ||
      mensagem.includes(
        "unable to verify the first certificate"
      ) ||
      mensagem.includes(
        "UNABLE_TO_VERIFY_LEAF_SIGNATURE"
      );

    if (
      url.startsWith("https") &&
      certificado
    ) {

      console.log(
        "[HTTPS] Node recusou o certificado. Tentando transporte alternativo seguro via curl..."
      );

      try {

        return await baixarComCurl(
          url
        );

      } catch (erroCurl) {

        erroCurl.nodeErro =
          mensagem;

        throw erroCurl;
      }
    }

    throw erro;
  }
}

// ==========================================
// XML
// ==========================================

function extrairXML(
  texto,
  tag
) {

  const regex =
    new RegExp(
      `<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`,
      "i"
    );

  const resultado =
    texto.match(regex);

  return resultado
    ? resultado[1]
    : "";
}

function extrairItens(xml) {

  const itens = [];

  const blocos =
    xml.match(
      /<item[\s\S]*?<\/item>/gi
    ) || [];

  for (
    const bloco of blocos
  ) {

    const titulo =
      limpar(
        extrairXML(
          bloco,
          "title"
        )
      );

    const link =
      limpar(
        extrairXML(
          bloco,
          "link"
        )
      );

    const descricao =
      limpar(
        extrairXML(
          bloco,
          "description"
        )
      );

    const data =
      limpar(
        extrairXML(
          bloco,
          "pubDate"
        )
      );

    if (
      titulo &&
      link
    ) {

      itens.push({
        titulo,
        link,
        descricao,
        data
      });
    }
  }

  return itens;
}

// ==========================================
// APRENDIZADO
// ==========================================

function bonusAprendizado(
  grupo,
  memoria
) {

  const termos =
    grupo || [];

  let bonus = 0;

  for (
    const termo of termos
  ) {

    const boas =
      numero(
        memoria.palavrasBoas?.[
          termo
        ]
      );

    const ruins =
      numero(
        memoria.palavrasRuins?.[
          termo
        ]
      );

    bonus +=
      Math.min(
        10,
        boas * 2
      );

    bonus -=
      Math.min(
        10,
        ruins * 2
      );
  }

  return limitar(
    bonus,
    -15,
    20
  );
}

function bonusFonte(
  fonte,
  memoria
) {

  const boas =
    numero(
      memoria.fontesBoas?.[
        fonte
      ]
    );

  const ruins =
    numero(
      memoria.fontesRuins?.[
        fonte
      ]
    );

  return limitar(
    boas * 3 -
    ruins * 3,
    -10,
    10
  );
}

// ==========================================
// CLASSIFICAÇÃO
// ==========================================

function analisar(
  item,
  memoria
) {

  const texto =
    [
      item.titulo,
      item.descricao
    ].join(" ");

  const base =
    normalizar(texto);

  const exclusoes =
    encontrar(
      base,
      EXCLUSOES
    );

  if (
    exclusoes.length
  ) {
    return null;
  }

  const grupos = {};

  for (
    const [nome, termos]
    of Object.entries(SINAIS)
  ) {

    grupos[nome] =
      encontrar(
        base,
        termos
      );
  }

  const problema =
    grupos.problema.length > 0;

  const demanda =
    grupos.demanda.length > 0;

  const dinheiro =
    grupos.dinheiro.length > 0;

  const automacao =
    grupos.automacao.length > 0;

  const negocio =
    grupos.negocio.length > 0;

  const solucao =
    grupos.solucao.length > 0;

  const crescimento =
    grupos.crescimento.length > 0;

  // ========================================
  // PONTUAÇÃO BASE
  // ========================================

  let pontos = 0;

  if (problema)
    pontos += 25;

  if (demanda)
    pontos += 30;

  if (dinheiro)
    pontos += 30;

  if (automacao)
    pontos += 15;

  if (negocio)
    pontos += 12;

  if (solucao)
    pontos += 5;

  if (crescimento)
    pontos += 8;

  // ========================================
  // COMBINAÇÕES COMERCIAIS
  // ========================================

  if (
    problema &&
    demanda
  ) {
    pontos += 15;
  }

  if (
    demanda &&
    dinheiro
  ) {
    pontos += 15;
  }

  if (
    problema &&
    dinheiro
  ) {
    pontos += 15;
  }

  if (
    problema &&
    demanda &&
    dinheiro
  ) {
    pontos += 20;
  }

  if (
    demanda &&
    automacao
  ) {
    pontos += 10;
  }

  if (
    negocio &&
    automacao
  ) {
    pontos += 8;
  }

  if (
    negocio &&
    dinheiro
  ) {
    pontos += 8;
  }

  // ========================================
  // APRENDIZADO
  // ========================================

  pontos +=
    bonusAprendizado(
      grupos.problema,
      memoria
    );

  pontos +=
    bonusAprendizado(
      grupos.demanda,
      memoria
    );

  pontos +=
    bonusAprendizado(
      grupos.dinheiro,
      memoria
    );

  pontos +=
    bonusAprendizado(
      grupos.automacao,
      memoria
    );

  pontos +=
    bonusFonte(
      item.fonte,
      memoria
    );

  pontos =
    limitar(
      pontos,
      0,
      100
    );

  // ========================================
  // SINAL COMERCIAL
  // ========================================

  const comercial =
    (
      problema &&
      demanda
    ) ||
    (
      demanda &&
      dinheiro
    ) ||
    (
      problema &&
      dinheiro
    ) ||
    (
      demanda &&
      automacao
    ) ||
    (
      negocio &&
      problema
    );

  if (!comercial) {
    return null;
  }

  // ========================================
  // CLASSIFICAÇÃO
  // ========================================

  let classificacao =
    "OBSERVAR";

  if (
    pontos >= 70
  ) {

    classificacao =
      "OPORTUNIDADE";

  } else if (
    pontos >= 50
  ) {

    classificacao =
      "INVESTIGAR";
  }

  // ========================================
  // NÃO DEIXAR O RADAR MORRER
  // ========================================

  const memoriaVazia =
    memoria.ciclos <= 2;

  const minimo =
    memoriaVazia
      ? CONFIG.MIN_PONTUACAO_ADAPTATIVA
      : CONFIG.MIN_PONTUACAO;

  if (
    pontos < minimo
  ) {
    return null;
  }

  // ========================================
  // HIPÓTESE
  // ========================================

  const hipotese =
    criarHipotese(
      item,
      grupos
    );

  return {

    id:
      criarId(item),

    titulo:
      item.titulo,

    descricao:
      item.descricao,

    link:
      item.link,

    fonte:
      item.fonte,

    data:
      item.data || null,

    potencial:
      pontos,

    pontuacao:
      pontos,

    classificacao,

    sinais: {
      problema,
      demanda,
      dinheiro,
      automacao,
      negocio,
      solucao,
      crescimento
    },

    termosEncontrados:
      grupos,

    problemaDetectado:
      problema,

    demandaDetectada:
      demanda,

    dinheiroDetectado:
      dinheiro,

    automacaoDetectada:
      automacao,

    negocioDetectado:
      negocio,

    solucaoDetectada:
      solucao,

    crescimentoDetectado:
      crescimento,

    evidenciaForte:
      pontos >= 50,

    hipotese,

    modeloPossivel:
      sugerirModelo(
        grupos
      ),

    fonteResolvida:
      true,

    status:
      "NOVA",

    criadaEm:
      new Date().toISOString()
  };
}

// ==========================================
// HIPÓTESE
// ==========================================

function criarHipotese(
  item,
  grupos
) {

  if (
    grupos.problema.length &&
    grupos.demanda.length &&
    grupos.dinheiro.length
  ) {

    return (
      "Existe problema, procura por solução e sinal financeiro. " +
      "Investigar uma solução simples que possa ser vendida rapidamente."
    );
  }

  if (
    grupos.problema.length &&
    grupos.demanda.length &&
    grupos.automacao.length
  ) {

    return (
      "Existe problema com procura por solução e possibilidade de automação. " +
      "Testar serviço automatizado ou ferramenta simples."
    );
  }

  if (
    grupos.demanda.length &&
    grupos.dinheiro.length
  ) {

    return (
      "Existe intenção de compra ou contratação. " +
      "Investigar uma oferta simples diretamente ligada à demanda."
    );
  }

  if (
    grupos.problema.length &&
    grupos.dinheiro.length
  ) {

    return (
      "Existe dor associada a custo ou dinheiro. " +
      "Investigar uma solução que reduza custo ou gere receita."
    );
  }

  if (
    grupos.negocio.length &&
    grupos.automacao.length
  ) {

    return (
      "Pequenos negócios aparecem junto de automação. " +
      "Investigar serviço B2B simples e repetível."
    );
  }

  return (
    "Investigar problema e validar se existe disposição real para pagar."
  );
}

// ==========================================
// MODELO DE MONETIZAÇÃO
// ==========================================

function sugerirModelo(
  grupos
) {

  if (
    grupos.demanda.length &&
    grupos.dinheiro.length &&
    grupos.automacao.length
  ) {
    return [
      "servico_automatizado",
      "micro_saas",
      "automacao_b2b"
    ];
  }

  if (
    grupos.problema.length &&
    grupos.demanda.length
  ) {
    return [
      "servico",
      "produto_digital",
      "micro_saas"
    ];
  }

  if (
    grupos.negocio.length &&
    grupos.automacao.length
  ) {
    return [
      "automacao_b2b",
      "servico_mensal"
    ];
  }

  if (
    grupos.dinheiro.length
  ) {
    return [
      "servico",
      "produto_digital"
    ];
  }

  return [
    "validacao_manual"
  ];
}

// ==========================================
// ID
// ==========================================

function criarId(item) {

  const texto =
    normalizar(
      `${item.titulo}-${item.link}`
    )
      .replace(
        /[^a-z0-9]+/g,
        "-"
      )
      .slice(
        0,
        60
      );

  return (
    "OP-" +
    Date.now() +
    "-" +
    texto
  );
}

// ==========================================
// DEDUPLICAÇÃO
// ==========================================

function chave(item) {

  return normalizar(
    item.titulo
  )
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .trim();
}

function deduplicar(itens) {

  const mapa =
    new Map();

  for (
    const item of itens
  ) {

    const k =
      chave(item);

    if (!k)
      continue;

    const atual =
      mapa.get(k);

    if (
      !atual ||
      item.pontuacao >
        atual.pontuacao
    ) {

      mapa.set(
        k,
        item
      );
    }
  }

  return [
    ...mapa.values()
  ];
}

// ==========================================
// APRENDIZADO
// ==========================================

function registrarAprendizado(
  resultado
) {

  const memoria =
    carregarMemoria();

  const decisao =
    normalizar(
      resultado?.decisao ||
      resultado?.status ||
      ""
    );

  const sucesso =
    [
      "continuar",
      "sucesso",
      "validado",
      "vendeu",
      "venda",
      "aprovado"
    ].includes(
      decisao
    );

  const fracasso =
    [
      "descartar",
      "falhou",
      "fracasso",
      "rejeitado",
      "sem demanda"
    ].includes(
      decisao
    );

  if (
    !sucesso &&
    !fracasso
  ) {

    return memoria;
  }

  const oportunidade =
    resultado?.oportunidade ||
    resultado?.experimento?.oportunidade ||
    resultado?.resultado?.oportunidade ||
    {};

  const termos =
    Object.values(
      oportunidade.termosEncontrados || {}
    ).flat();

  const fonte =
    oportunidade.fonte ||
    "desconhecida";

  const classificacao =
    oportunidade.classificacao ||
    "OBSERVAR";

  // ========================================
  // PALAVRAS
  // ========================================

  for (
    const termo of termos
  ) {

    if (sucesso) {

      memoria.palavrasBoas[termo] =
        (
          memoria.palavrasBoas[termo] ||
          0
        ) + 1;

    } else {

      memoria.palavrasRuins[termo] =
        (
          memoria.palavrasRuins[termo] ||
          0
        ) + 1;
    }
  }

  // ========================================
  // FONTE
  // ========================================

  if (sucesso) {

    memoria.fontesBoas[fonte] =
      (
        memoria.fontesBoas[fonte] ||
        0
      ) + 1;

  } else {

    memoria.fontesRuins[fonte] =
      (
        memoria.fontesRuins[fonte] ||
        0
      ) + 1;
  }

  // ========================================
  // CATEGORIA
  // ========================================

  if (sucesso) {

    memoria.categoriasBoas[classificacao] =
      (
        memoria.categoriasBoas[classificacao] ||
        0
      ) + 1;

  } else {

    memoria.categoriasRuins[classificacao] =
      (
        memoria.categoriasRuins[classificacao] ||
        0
      ) + 1;
  }

  if (sucesso)
    memoria.sucessos++;

  if (fracasso)
    memoria.fracassos++;

  memoria.experimentos++;

  memoria.historico.push({
    data:
      new Date().toISOString(),

    decisao,

    sucesso,

    fracasso,

    fonte,

    classificacao,

    titulo:
      oportunidade.titulo ||
      null
  });

  if (
    memoria.historico.length > 200
  ) {

    memoria.historico =
      memoria.historico.slice(
        -200
      );
  }

  salvarMemoria(
    memoria
  );

  return memoria;
}

// ==========================================
// MEMÓRIA DE ITENS VISTOS
// ==========================================

function registrarVisto(
  memoria,
  item
) {

  const k =
    chave(item);

  if (!k)
    return;

  memoria.vistos[k] =
    {
      ultimo:
        new Date().toISOString(),

      pontuacao:
        item.pontuacao,

      fonte:
        item.fonte
    };

  const chaves =
    Object.keys(
      memoria.vistos
    );

  if (
    chaves.length > 2000
  ) {

    const antigas =
      chaves
        .sort(
          (a, b) =>
            new Date(
              memoria.vistos[a].ultimo
            ) -
            new Date(
              memoria.vistos[b].ultimo
            )
        )
        .slice(
          0,
          chaves.length - 2000
        );

    for (
      const antiga of antigas
    ) {

      delete memoria.vistos[
        antiga
      ];
    }
  }
}

// ==========================================
// RADAR
// ==========================================

async function radar() {

  const memoria =
    carregarMemoria();

  memoria.ciclos++;

  console.log("");
  console.log(
    "=========================================="
  );

  console.log(
    ` AUTÔMATO RADAR v${VERSAO}`
  );

  console.log(
    ` CICLO ${memoria.ciclos}`
  );

  console.log(
    "=========================================="
  );

  console.log(
    "\nProcurando oportunidades monetizáveis..."
  );

  const coletados = [];

  // ========================================
  // COLETA
  // ========================================

  for (
    const fonte of FONTES
  ) {

    try {

      console.log(
        `\n[FONTE] ${fonte.nome}`
      );

      const xml =
        await baixar(
          fonte.url
        );

      const itens =
        extrairItens(xml);

      console.log(
        `[FONTE] ${itens.length} itens`
      );

      for (
        const item of itens.slice(
          0,
          CONFIG.MAX_RESULTADOS_POR_FONTE
        )
      ) {

        item.fonte =
          fonte.nome;

        item.categoriaFonte =
          fonte.categoria;

        coletados.push(
          item
        );
      }

    } catch (erro) {

      console.log(
        `[FONTE] erro: ${erro.message}`
      );
    }
  }

  console.log(
    `\n[COLETA] ${coletados.length} itens`
  );

  // ========================================
  // ANÁLISE
  // ========================================

  let oportunidades =
    coletados
      .map(
        item =>
          analisar(
            item,
            memoria
          )
      )
      .filter(Boolean);

  // ========================================
  // REMOVER REPETIDOS
  // ========================================

  oportunidades =
    deduplicar(
      oportunidades
    );

  // ========================================
  // PRIORIDADE
  // ========================================

  oportunidades.sort(
    (a, b) => {

      let scoreA =
        a.pontuacao;

      let scoreB =
        b.pontuacao;

      // Intenção comercial recebe prioridade.
      if (
        a.demandaDetectada
      )
        scoreA += 8;

      if (
        b.demandaDetectada
      )
        scoreB += 8;

      if (
        a.dinheiroDetectado
      )
        scoreA += 8;

      if (
        b.dinheiroDetectado
      )
        scoreB += 8;

      if (
        a.automacaoDetectada
      )
        scoreA += 5;

      if (
        b.automacaoDetectada
      )
        scoreB += 5;

      return (
        scoreB -
        scoreA
      );
    }
  );

  // ========================================
  // RESULTADO
  // ========================================

  const resultadoFinal =
    oportunidades
      .slice(
        0,
        CONFIG.MAX_OPORTUNIDADES
      );

  // ========================================
  // MEMÓRIA
  // ========================================

  for (
    const oportunidade
    of resultadoFinal
  ) {

    registrarVisto(
      memoria,
      oportunidade
    );
  }

  memoria.oportunidadesDetectadas +=
    resultadoFinal.length;

  memoria.ultimosResultados =
    resultadoFinal.map(
      oportunidade => ({
        titulo:
          oportunidade.titulo,

        pontuacao:
          oportunidade.pontuacao,

        classificacao:
          oportunidade.classificacao,

        fonte:
          oportunidade.fonte,

        data:
          new Date().toISOString()
      })
    );

  memoria.historico.push({
    tipo:
      "RADAR",

    data:
      new Date().toISOString(),

    ciclo:
      memoria.ciclos,

    coletados:
      coletados.length,

    oportunidades:
      resultadoFinal.length
  });

  if (
    memoria.historico.length > 200
  ) {

    memoria.historico =
      memoria.historico.slice(
        -200
      );
  }

  salvarMemoria(
    memoria
  );

  // ========================================
  // SAÍDA
  // ========================================

  console.log(
    `\n[RESULTADO] ${resultadoFinal.length} oportunidades`
  );

  for (
    const oportunidade
    of resultadoFinal
  ) {

    console.log(
      "\n------------------------------------------"
    );

    console.log(
      `${oportunidade.pontuacao}/100`
    );

    console.log(
      oportunidade.classificacao
    );

    console.log(
      oportunidade.titulo
    );

    console.log(
      `Fonte: ${oportunidade.fonte}`
    );

    console.log(
      `Modelo: ${oportunidade.modeloPossivel.join(", ")}`
    );

    console.log(
      `Hipótese: ${oportunidade.hipotese}`
    );
  }

  if (
    resultadoFinal.length === 0
  ) {

    console.log("");
    console.log(
      "[APRENDIZADO] Nenhuma oportunidade passou pelo filtro."
    );

    console.log(
      "[ADAPTAÇÃO] O Radar continuará ampliando a descoberta nos próximos ciclos."
    );
  }

  return resultadoFinal;
}

// ==========================================
// EXPORTAÇÕES
// ==========================================

module.exports =
  radar;

module.exports.radar =
  radar;

module.exports.registrarAprendizado =
  registrarAprendizado;

module.exports.carregarMemoria =
  carregarMemoria;

module.exports.salvarMemoria =
  salvarMemoria;

module.exports.analisar =
  analisar;

// ==========================================
// TESTE DIRETO
// ==========================================

if (
  require.main === module
) {

  radar()
    .then(resultado => {

      console.log("");
      console.log(
        "=========================================="
      );

      console.log(
        "RESULTADO FINAL"
      );

      console.log(
        "=========================================="
      );

      console.log("");

      console.log(
        JSON.stringify(
          resultado,
          null,
          2
        )
      );

    })
    .catch(erro => {

      console.error("");
      console.error(
        "ERRO FATAL:"
      );

      console.error(
        erro.stack ||
        erro.message
      );

      process.exitCode = 1;
    });
}