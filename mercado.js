// AUTÔMATO — Pesquisa de Mercado v0.1
// Objetivo:
// Transformar uma oportunidade detectada pelo Radar em pesquisa de mercado:
// problema → público → demanda → concorrência → soluções → preços → lacunas → oportunidade.
//
// Modo: FREE_FIRST
// Sem dependências externas.
// Pesquisa usando mecanismos públicos via HTTP.
// Saída preparada para o próximo estágio: MONETIZADOR.
//
// Compatibilidade:
// - pesquisarMercado()
// - pesquisar()
// Ambas apontam para a mesma função.

const http = require("http");
const https = require("https");
const { URL } = require("url");

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120 Safari/537.36";

const TIMEOUT_MS = 12000;
const MAX_BYTES = 700000;

const STOPWORDS = new Set([
  "about", "after", "again", "against", "all", "also", "and", "are", "around",
  "because", "been", "being", "between", "but", "can", "could", "from",
  "have", "into", "more", "most", "much", "new", "not", "now", "only",
  "other", "over", "same", "some", "such", "than", "that", "their",
  "there", "these", "they", "this", "through", "under", "very", "what",
  "when", "where", "which", "while", "with", "would",

  "como", "para", "sobre", "entre", "mais", "menos", "muito", "muita",
  "muitos", "muitas", "novo", "nova", "novos", "novas", "uma", "umas",
  "um", "uns", "dos", "das", "que", "por", "com", "sem", "de", "do",
  "da", "e", "ou", "em", "no", "na", "nos", "nas", "ao", "aos", "se",
  "isso", "essa", "esse", "estas", "estes", "também", "ser", "são",
  "foi", "era", "está", "estão",

  "ai", "artificial", "intelligence", "technology", "technologies",
  "company", "companies", "startup", "startups", "market", "business",
  "news", "today", "report", "reports", "latest", "future", "world",
  "global", "industry", "platform", "platforms"
]);

const SIGNALS = {
  problema: [
    "problem", "problems", "pain", "pain point", "challenge", "challenges",
    "difficulty", "difficult", "issue", "issues", "struggle", "struggling",
    "expensive", "costly", "slow", "hard", "lack", "shortage",
    "problema", "problemas", "dor", "desafio", "dificuldade", "difícil",
    "caro", "cara", "custoso", "lento", "falta", "escassez"
  ],

  publico: [
    "customers", "customer", "users", "user", "buyers", "buyer",
    "developers", "developer", "businesses", "business owners",
    "teams", "companies", "creators", "creator", "marketers", "marketing",
    "consumers", "professionals", "workers", "founders", "students",
    "clientes", "usuários", "compradores", "empresas", "equipes",
    "criadores", "profissionais", "empreendedores", "estudantes"
  ],

  demanda: [
    "demand", "demanding", "need", "needs", "wanted", "want",
    "growing demand", "increasing demand", "popular", "adoption",
    "search", "interest", "customers", "buyers", "sales",
    "demanda", "necessidade", "necessidades", "procuram", "procura",
    "crescendo", "crescimento", "clientes", "vendas", "interesse"
  ],

  dinheiro: [
    "revenue", "revenues", "sales", "selling", "pricing", "price",
    "paid", "pay", "payment", "subscription", "subscriptions",
    "billion", "million", "funding", "profit", "income", "cost",
    "receita", "vendas", "preço", "preços", "pago", "pagamento",
    "assinatura", "milhões", "bilhões", "lucro", "renda", "custo"
  ],

  concorrencia: [
    "competitor", "competitors", "alternative", "alternatives",
    "competitor to", "vs", "versus", "compare", "comparison",
    "best tools", "best software", "market leader",
    "concorrente", "concorrentes", "alternativa", "alternativas",
    "comparação", "melhores ferramentas", "melhor software"
  ],

  solucao: [
    "solution", "solutions", "tool", "tools", "software", "service",
    "product", "products", "app", "apps", "platform", "automation",
    "solution", "solve", "solving", "how to",
    "solução", "soluções", "ferramenta", "ferramentas", "software",
    "serviço", "produto", "aplicativo", "automação", "resolver"
  ],

  crescimento: [
    "growth", "growing", "surge", "boom", "increase", "increasing",
    "rapidly", "tripled", "doubled", "expanding", "expansion",
    "crescimento", "crescendo", "aumento", "aumentando", "expansão"
  ]
};

function limparHtml(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function decodificarHtml(texto) {
  return String(texto || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) =>
      String.fromCharCode(Number(n))
    );
}

function extrairPalavras(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9áéíóúãõçàâêôü-]/gi, " ")
    .split(/\s+/)
    .map(p => p.trim())
    .filter(p => p.length >= 4)
    .filter(p => !STOPWORDS.has(p));
}

function palavrasImportantes(texto, limite = 10) {
  const palavras = extrairPalavras(texto);
  const frequencia = {};

  for (const palavra of palavras) {
    frequencia[palavra] =
      (frequencia[palavra] || 0) + 1;
  }

  return Object.entries(frequencia)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limite)
    .map(([palavra]) => palavra);
}

function contarSinais(texto) {
  const normalizado =
    String(texto || "").toLowerCase();

  const resultado = {};

  for (const [grupo, termos] of Object.entries(SIGNALS)) {
    let total = 0;

    for (const termo of termos) {
      if (
        normalizado.includes(
          termo.toLowerCase()
        )
      ) {
        total++;
      }
    }

    resultado[grupo] = total;
  }

  return resultado;
}

function scoreRelevancia(texto, termos) {
  const normalizado =
    String(texto || "").toLowerCase();

  let pontos = 0;

  for (const termo of termos) {
    if (
      normalizado.includes(
        termo.toLowerCase()
      )
    ) {
      pontos++;
    }
  }

  return pontos;
}

function dominioDaUrl(url) {
  try {
    return new URL(url)
      .hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return "";
  }
}

function getUrl(url, redirects = 0) {
  return new Promise(resolve => {
    if (redirects > 5) {
      resolve({
        ok: false,
        status: 0,
        url,
        body: "",
        error: "Muitos redirecionamentos"
      });

      return;
    }

    let parsed;

    try {
      parsed = new URL(url);
    } catch {
      resolve({
        ok: false,
        status: 0,
        url,
        body: "",
        error: "URL inválida"
      });

      return;
    }

    const cliente =
      parsed.protocol === "https:"
        ? https
        : http;

    const req = cliente.get(
      parsed,
      {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
      },
      res => {
        const status =
          res.statusCode || 0;

        if (
          status >= 300 &&
          status < 400 &&
          res.headers.location
        ) {
          const destino =
            new URL(
              res.headers.location,
              parsed
            ).toString();

          res.resume();

          getUrl(
            destino,
            redirects + 1
          ).then(resolve);

          return;
        }

        let total = 0;
        const partes = [];

        res.on("data", chunk => {
          total += chunk.length;

          if (total <= MAX_BYTES) {
            partes.push(chunk);
          }
        });

        res.on("end", () => {
          resolve({
            ok:
              status >= 200 &&
              status < 400,
            status,
            url: parsed.toString(),
            body:
              Buffer.concat(
                partes
              ).toString("utf8"),
            error: null
          });
        });
      }
    );

    req.setTimeout(
      TIMEOUT_MS,
      () => {
        req.destroy();

        resolve({
          ok: false,
          status: 0,
          url,
          body: "",
          error: "Timeout"
        });
      }
    );

    req.on("error", err => {
      resolve({
        ok: false,
        status: 0,
        url,
        body: "",
        error: err.message
      });
    });
  });
}

function extrairResultadosBing(html) {
  const resultados = [];
  const texto = String(html || "");

  const regex =
    /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?(?:<description>([\s\S]*?)<\/description>)?[\s\S]*?<\/item>/gi;

  let match;

  while ((match = regex.exec(texto))) {
    const titulo =
      limparHtml(
        decodificarHtml(match[1])
      );

    const url =
      decodificarHtml(
        match[2]
      ).trim();

    const descricao =
      limparHtml(
        decodificarHtml(
          match[3] || ""
        )
      );

    if (titulo && url) {
      resultados.push({
        titulo,
        url,
        descricao
      });
    }
  }

  return resultados;
}

function extrairResultadosDuckDuckGo(html) {
  const resultados = [];
  const texto = String(html || "");

  const regex =
    /result__a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:result__snippet[^>]*>([\s\S]*?)<\/a>|result__snippet[^>]*>([\s\S]*?)<\/div>)/gi;

  let match;

  while ((match = regex.exec(texto))) {
    const url =
      decodificarHtml(
        match[1]
      );

    const titulo =
      limparHtml(
        decodificarHtml(
          match[2]
        )
      );

    const descricao =
      limparHtml(
        decodificarHtml(
          match[3] ||
          match[4] ||
          ""
        )
      );

    if (titulo && url) {
      resultados.push({
        titulo,
        url,
        descricao
      });
    }
  }

  return resultados;
}

async function pesquisarBing(query) {
  const url =
    "https://www.bing.com/search?format=rss&q=" +
    encodeURIComponent(query);

  const resposta =
    await getUrl(url);

  if (!resposta.ok) {
    return {
      mecanismo: "bing",
      query,
      resultados: [],
      erro:
        resposta.error ||
        `HTTP ${resposta.status}`
    };
  }

  return {
    mecanismo: "bing",
    query,
    resultados:
      extrairResultadosBing(
        resposta.body
      ),
    erro: null
  };
}

async function pesquisarDuckDuckGo(query) {
  const url =
    "https://html.duckduckgo.com/html/?q=" +
    encodeURIComponent(query);

  const resposta =
    await getUrl(url);

  if (!resposta.ok) {
    return {
      mecanismo: "duckduckgo",
      query,
      resultados: [],
      erro:
        resposta.error ||
        `HTTP ${resposta.status}`
    };
  }

  return {
    mecanismo: "duckduckgo",
    query,
    resultados:
      extrairResultadosDuckDuckGo(
        resposta.body
      ),
    erro: null
  };
}

function construirConsultas(oportunidade) {
  const titulo =
    oportunidade?.titulo || "";

  const textoBase =
    `${titulo} ${oportunidade?.hipotese || ""}`;

  const termos =
    palavrasImportantes(
      textoBase,
      8
    );

  const entidade =
    termos
      .slice(0, 4)
      .join(" ");

  const consultas = [
    `"${titulo}"`,
    `${entidade} problem customers`,
    `${entidade} demand customers`,
    `${entidade} alternatives competitors`,
    `${entidade} pricing cost`,
    `${entidade} software tools solutions`,
    `${entidade} "how to"`,
    `${entidade} market customers`
  ];

  return consultas.filter(Boolean);
}

function classificarFonte(
  item,
  termosOportunidade
) {
  const texto =
    `${item.titulo} ${item.descricao}`;

  const sinais =
    contarSinais(texto);

  const relevancia =
    scoreRelevancia(
      texto,
      termosOportunidade
    );

  let score =
    relevancia * 12;

  if (sinais.problema > 0)
    score += 8;

  if (sinais.publico > 0)
    score += 8;

  if (sinais.demanda > 0)
    score += 10;

  if (sinais.dinheiro > 0)
    score += 10;

  if (sinais.concorrencia > 0)
    score += 8;

  if (sinais.solucao > 0)
    score += 8;

  return {
    ...item,
    dominio:
      dominioDaUrl(item.url),
    relevancia,
    sinais,
    score:
      Math.min(100, score)
  };
}

function deduplicar(resultados) {
  const mapa = new Map();

  for (const item of resultados) {
    const chave =
      item.url ||
      `${item.dominio}:${item.titulo.toLowerCase()}`;

    if (!mapa.has(chave)) {
      mapa.set(chave, item);
    }
  }

  return [...mapa.values()];
}

function agruparEvidencias(resultados) {
  const grupos = {
    problema: [],
    publico: [],
    demanda: [],
    concorrencia: [],
    dinheiro: [],
    solucao: [],
    crescimento: []
  };

  for (const item of resultados) {
    for (const grupo of Object.keys(grupos)) {
      if (
        (item.sinais[grupo] || 0) > 0
      ) {
        grupos[grupo].push(item);
      }
    }
  }

  return grupos;
}

function criarLacunas(evidencias) {
  const lacunas = [];

  const temProblema =
    evidencias.problema.length > 0;

  const temPublico =
    evidencias.publico.length > 0;

  const temDemanda =
    evidencias.demanda.length > 0;

  const temConcorrencia =
    evidencias.concorrencia.length > 0;

  const temDinheiro =
    evidencias.dinheiro.length > 0;

  const temSolucao =
    evidencias.solucao.length > 0;

  if (
    temProblema &&
    temDemanda &&
    !temSolucao
  ) {
    lacunas.push(
      "Existe evidência de problema e demanda, mas poucas soluções identificadas."
    );
  }

  if (
    temDemanda &&
    temDinheiro &&
    !temConcorrencia
  ) {
    lacunas.push(
      "Há sinais comerciais, mas a pesquisa encontrou pouca concorrência diretamente relacionada."
    );
  }

  if (
    temProblema &&
    temPublico &&
    temConcorrencia
  ) {
    lacunas.push(
      "Existe mercado identificado; investigar diferenciação por preço, simplicidade, velocidade ou nicho."
    );
  }

  if (
    temSolucao &&
    temConcorrencia &&
    !temDinheiro
  ) {
    lacunas.push(
      "Há soluções existentes, mas ainda falta evidência suficiente de disposição para pagar."
    );
  }

  if (
    temDemanda &&
    !temPublico
  ) {
    lacunas.push(
      "Há sinais de demanda, mas o público comprador ainda não está claramente identificado."
    );
  }

  if (!lacunas.length) {
    lacunas.push(
      "Ainda não existe evidência suficiente para definir uma lacuna comercial concreta."
    );
  }

  return lacunas;
}

function calcularMercado(
  resultados,
  evidencias,
  fontesIndependentes
) {
  let score = 0;

  if (evidencias.problema.length)
    score += 20;

  if (evidencias.publico.length)
    score += 15;

  if (evidencias.demanda.length)
    score += 20;

  if (evidencias.concorrencia.length)
    score += 10;

  if (evidencias.dinheiro.length)
    score += 20;

  if (evidencias.solucao.length)
    score += 10;

  if (evidencias.crescimento.length)
    score += 5;

  if (fontesIndependentes >= 2)
    score += 5;

  if (fontesIndependentes >= 4)
    score += 5;

  return Math.min(100, score);
}

function decidir(
  score,
  fontesIndependentes,
  evidencias
) {
  const demanda =
    evidencias.demanda.length > 0;

  const dinheiro =
    evidencias.dinheiro.length > 0;

  const problema =
    evidencias.problema.length > 0;

  const publico =
    evidencias.publico.length > 0;

  if (
    score >= 70 &&
    fontesIndependentes >= 3 &&
    demanda &&
    dinheiro
  ) {
    return "VALIDAR_IDEA";
  }

  if (
    score >= 45 &&
    (demanda ||
      dinheiro ||
      problema)
  ) {
    return "INVESTIGAR_LACUNA";
  }

  if (
    fontesIndependentes === 0
  ) {
    return "REPETIR";
  }

  if (
    !publico &&
    !demanda &&
    !dinheiro
  ) {
    return "DESCARTAR";
  }

  return "INVESTIGAR_LACUNA";
}

async function pesquisarMercado(
  oportunidade
) {
  console.log(
    "\n========================================"
  );

  console.log(
    "AUTÔMATO — PESQUISA DE MERCADO v0.1"
  );

  console.log(
    "========================================"
  );

  console.log("\nOportunidade:");

  console.log(
    oportunidade?.titulo ||
    "Sem título"
  );

  const consultas =
    construirConsultas(
      oportunidade
    );

  console.log(
    `\nConsultas planejadas: ${consultas.length}`
  );

  let resultadosBrutos = [];

  for (const query of consultas) {
    console.log(
      `\n🔎 ${query}`
    );

    const bing =
      await pesquisarBing(
        query
      );

    if (bing.resultados.length) {
      console.log(
        `   Bing: ${bing.resultados.length} resultados`
      );

      resultadosBrutos.push(
        ...bing.resultados
      );
    } else {
      console.log(
        "   Bing: sem resultados"
      );
    }

    if (!bing.resultados.length) {
      const duck =
        await pesquisarDuckDuckGo(
          query
        );

      if (duck.resultados.length) {
        console.log(
          `   DuckDuckGo: ${duck.resultados.length} resultados`
        );

        resultadosBrutos.push(
          ...duck.resultados
        );
      } else {
        console.log(
          "   DuckDuckGo: sem resultados"
        );
      }
    }
  }

  resultadosBrutos =
    deduplicar(
      resultadosBrutos
    );

  const termosOportunidade =
    palavrasImportantes(
      `${oportunidade?.titulo || ""} ${oportunidade?.hipotese || ""}`,
      12
    );

  let resultados =
    resultadosBrutos
      .map(item =>
        classificarFonte(
          item,
          termosOportunidade
        )
      )
      .filter(
        item =>
          item.relevancia >= 1
      )
      .sort(
        (a, b) =>
          b.score - a.score
      );

  resultados =
    deduplicar(
      resultados
    );

  const evidencias =
    agruparEvidencias(
      resultados
    );

  const fontesIndependentes =
    new Set(
      resultados
        .map(r => r.dominio)
        .filter(Boolean)
    ).size;

  const score =
    calcularMercado(
      resultados,
      evidencias,
      fontesIndependentes
    );

  const decisao =
    decidir(
      score,
      fontesIndependentes,
      evidencias
    );

  const confianca =
    fontesIndependentes >= 4
      ? "ALTA"
      : fontesIndependentes >= 2
        ? "MÉDIA"
        : "BAIXA";

  const lacunas =
    criarLacunas(
      evidencias
    );

  const mercado = {
    tipo: "PESQUISA_MERCADO",
    versao: "0.1",
    modo: "FREE_FIRST",

    oportunidade: {
      titulo:
        oportunidade?.titulo || "",
      url:
        oportunidade?.url || "",
      hipotese:
        oportunidade?.hipotese || ""
    },

    consultas,

    estatisticas: {
      resultadosBrutos:
        resultadosBrutos.length,
      resultadosRelevantes:
        resultados.length,
      fontesIndependentes
    },

    evidencias: {
      problema:
        evidencias.problema.slice(0, 5),
      publico:
        evidencias.publico.slice(0, 5),
      demanda:
        evidencias.demanda.slice(0, 5),
      concorrencia:
        evidencias.concorrencia.slice(0, 5),
      dinheiro:
        evidencias.dinheiro.slice(0, 5),
      solucao:
        evidencias.solucao.slice(0, 5),
      crescimento:
        evidencias.crescimento.slice(0, 5)
    },

    concorrentes:
      evidencias.concorrencia
        .slice(0, 10)
        .map(item => ({
          nome: item.titulo,
          dominio: item.dominio,
          url: item.url,
          score: item.score
        })),

    modelosDeCobranca:
      evidencias.dinheiro
        .slice(0, 10)
        .map(item => ({
          titulo: item.titulo,
          dominio: item.dominio,
          url: item.url
        })),

    lacunas,

    oportunidadeDeProduto: {
      existeHipotese:
        score >= 45,

      descricao:
        score >= 45
          ? "Existe evidência suficiente para formular uma hipótese de produto e submetê-la a validação."
          : "Ainda não existe evidência suficiente para formular uma hipótese comercial forte."
    },

    potencialDeTeste: {
      score,

      nivel:
        score >= 70
          ? "ALTO"
          : score >= 45
            ? "MÉDIO"
            : "BAIXO"
    },

    confianca,
    decisao,

    fontes:
      resultados
        .slice(0, 20)
        .map(item => ({
          titulo: item.titulo,
          url: item.url,
          dominio: item.dominio,
          relevancia: item.relevancia,
          score: item.score,
          sinais: item.sinais
        })),

    proximoEstagio:
      decisao === "VALIDAR_IDEA"
        ? "MONETIZADOR"
        : decisao === "INVESTIGAR_LACUNA"
          ? "MONETIZADOR_PRELIMINAR"
          : decisao === "REPETIR"
            ? "PESQUISA_MERCADO"
            : "RADAR"
  };

  console.log(
    "\n========================================"
  );

  console.log(
    "RESULTADO DA PESQUISA"
  );

  console.log(
    "========================================"
  );

  console.log(
    `Resultados relevantes: ${resultados.length}`
  );

  console.log(
    `Fontes independentes: ${fontesIndependentes}`
  );

  console.log(
    `Força de mercado: ${score}/100`
  );

  console.log(
    `Confiança: ${confianca}`
  );

  console.log(
    `Decisão: ${decisao}`
  );

  console.log("\nLacunas:");

  for (const lacuna of lacunas) {
    console.log(
      `- ${lacuna}`
    );
  }

  console.log(
    "\nPróximo estágio:"
  );

  console.log(
    mercado.proximoEstagio
  );

  return mercado;
}

// Interface principal usada pelo AUTÔMATO.
// Mantém pesquisarMercado() como função original
// e fornece pesquisar() como nome padronizado.
async function pesquisar(oportunidade) {
  return await pesquisarMercado(
    oportunidade
  );
}

async function main() {
  const oportunidade = {
    titulo:
      process.argv.slice(2).join(" ") ||
      "Snorkel AI triples valuation to $3.5B as demand for AI training data booms",

    url:
      "https://techcrunch.com/2026/09/22/snorkel-ai-triples-valuation-to-3-5b-as-demand-for-ai-training-data-booms/",

    hipotese:
      "Investigar se existe uma oportunidade de solução digital em torno da demanda e atividade econômica detectadas."
  };

  try {
    const resultado =
      await pesquisarMercado(
        oportunidade
      );

    console.log(
      "\nJSON_FINAL:"
    );

    console.log(
      JSON.stringify(
        resultado,
        null,
        2
      )
    );
  } catch (erro) {
    console.error(
      "\nERRO NO MERCADO:",
      erro.message
    );

    process.exitCode = 1;
  }
}

if (
  require.main === module
) {
  main();
}

module.exports = {
  pesquisarMercado,
  pesquisar
};