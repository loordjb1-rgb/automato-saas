const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

const ROOT = process.env.AUTOMATO_ROOT || process.cwd();
const PORT = Number(process.env.PORT || 3737);

const EXTENSOES_PERMITIDAS = new Set([
  ".js",
  ".json",
  ".ps1",
  ".md",
  ".txt",
  ".env",
  ".html"
]);

let cicloRodando = false;
let modoContinuo = false;
let intervaloContinuo = null;
let proximoCicloEm = null;
let ultimoResultado = null;
let ultimoErro = null;

let continuoIntervaloMinutos = 15;
let continuoIniciadoEm = null;
let totalCiclosContinuos = 0;
let ultimoCicloContinuoEm = null;

// =========================================================
// CAMADA COMERCIAL
// =========================================================

const DIRETORIO_DADOS = path.join(ROOT, "dados");
const ARQUIVO_COMERCIAL = path.join(DIRETORIO_DADOS, "comercial.json");

function garantirDiretorioDados() {
  if (!fs.existsSync(DIRETORIO_DADOS)) {
    fs.mkdirSync(DIRETORIO_DADOS, { recursive: true });
  }
}

function memoriaComercialPadrao() {
  return {
    versao: "1.0",
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),

    ofertas: [],
    leads: [],
    vendas: [],
    receitas: [],

    fila: [],

    estatisticas: {
      ofertasCriadas: 0,
      ofertasAtivas: 0,
      leads: 0,
      vendas: 0,
      receitaTotal: 0,
      ticketMedio: 0,
      taxaConversao: 0
    }
  };
}

function carregarComercial() {
  try {
    garantirDiretorioDados();

    if (!fs.existsSync(ARQUIVO_COMERCIAL)) {
      const inicial = memoriaComercialPadrao();

      fs.writeFileSync(
        ARQUIVO_COMERCIAL,
        JSON.stringify(inicial, null, 2),
        "utf8"
      );

      return inicial;
    }

    const conteudo = fs.readFileSync(
      ARQUIVO_COMERCIAL,
      "utf8"
    );

    if (!conteudo.trim()) {
      return memoriaComercialPadrao();
    }

    const dados = JSON.parse(conteudo);
    const padrao = memoriaComercialPadrao();

    return {
      ...padrao,
      ...dados,
      ofertas: Array.isArray(dados.ofertas) ? dados.ofertas : [],
      leads: Array.isArray(dados.leads) ? dados.leads : [],
      vendas: Array.isArray(dados.vendas) ? dados.vendas : [],
      receitas: Array.isArray(dados.receitas) ? dados.receitas : [],
      fila: Array.isArray(dados.fila) ? dados.fila : [],
      estatisticas: {
        ...padrao.estatisticas,
        ...(dados.estatisticas || {})
      }
    };
  } catch (erro) {
    return {
      ...memoriaComercialPadrao(),
      erro: erro.message
    };
  }
}

function salvarComercial(dados) {
  garantirDiretorioDados();

  const atualizado = {
    ...dados,
    atualizadoEm: new Date().toISOString()
  };

  fs.writeFileSync(
    ARQUIVO_COMERCIAL,
    JSON.stringify(atualizado, null, 2),
    "utf8"
  );

  return atualizado;
}

function gerarId(prefixo) {
  return `${prefixo}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function numeroSeguro(valor, padrao = 0) {
  const numero = Number(valor);

  return Number.isFinite(numero) ? numero : padrao;
}

function textoSeguro(valor, padrao = "") {
  if (valor === null || valor === undefined) {
    return padrao;
  }

  return String(valor).trim();
}

function extrairOportunidadeResultado(resultado) {
  if (!resultado) {
    return null;
  }

  const candidatos = [
    resultado.oportunidade,
    resultado.opportunity,
    resultado.selecao?.oportunidade,
    resultado.resultado?.oportunidade,
    resultado.dados?.oportunidade
  ];

  for (const candidato of candidatos) {
    if (candidato && typeof candidato === "object") {
      return candidato;
    }
  }

  return null;
}

function extrairPlanoResultado(resultado) {
  if (!resultado) {
    return null;
  }

  return (
    resultado.plano ||
    resultado.decisao ||
    resultado.resultado?.plano ||
    null
  );
}

function recalcularEstatisticasComerciais(dados) {
  const ofertas = Array.isArray(dados.ofertas)
    ? dados.ofertas
    : [];

  const leads = Array.isArray(dados.leads)
    ? dados.leads
    : [];

  const vendas = Array.isArray(dados.vendas)
    ? dados.vendas
    : [];

  const receitas = Array.isArray(dados.receitas)
    ? dados.receitas
    : [];

  const receitaTotal = receitas.reduce(
    (total, item) =>
      total + numeroSeguro(item.valor),
    0
  );

  const ticketMedio =
    vendas.length > 0
      ? receitaTotal / vendas.length
      : 0;

  const taxaConversao =
    leads.length > 0
      ? (vendas.length / leads.length) * 100
      : 0;

  dados.estatisticas = {
    ofertasCriadas: ofertas.length,

    ofertasAtivas: ofertas.filter(
      item => item.status === "ATIVA"
    ).length,

    leads: leads.length,

    vendas: vendas.length,

    receitaTotal: Number(
      receitaTotal.toFixed(2)
    ),

    ticketMedio: Number(
      ticketMedio.toFixed(2)
    ),

    taxaConversao: Number(
      taxaConversao.toFixed(2)
    )
  };

  return dados;
}

function registrarOportunidadeNaFila(
  oportunidade,
  plano = null
) {
  if (
    !oportunidade ||
    typeof oportunidade !== "object"
  ) {
    return null;
  }

  const dados = carregarComercial();

  const idOportunidade = textoSeguro(
    oportunidade.id,
    gerarId("OP")
  );

  const existente = dados.fila.find(
    item =>
      item.oportunidadeId === idOportunidade
  );

  if (existente) {
    existente.atualizadoEm =
      new Date().toISOString();

    if (plano) {
      existente.plano = plano;
    }

    salvarComercial(
      recalcularEstatisticasComerciais(dados)
    );

    return existente;
  }

  const item = {
    id: gerarId("FILA"),

    oportunidadeId: idOportunidade,

    titulo: textoSeguro(
      oportunidade.titulo,
      "Oportunidade sem título"
    ),

    fonte: textoSeguro(
      oportunidade.fonte ||
      oportunidade.source
    ),

    pontuacao: numeroSeguro(
      oportunidade.pontuacao ||
      oportunidade.score
    ),

    modelo: textoSeguro(
      oportunidade.modelo
    ),

    hipotese: textoSeguro(
      oportunidade.hipotese
    ),

    plano: plano || null,

    status: "AGUARDANDO_EXPERIMENTO",

    criadaEm: new Date().toISOString(),

    atualizadoEm: new Date().toISOString()
  };

  dados.fila.push(item);

  salvarComercial(
    recalcularEstatisticasComerciais(dados)
  );

  return item;
}

function criarOfertaComercial(
  dadosEntrada = {}
) {
  const dados = carregarComercial();

  const oportunidade =
    dadosEntrada.oportunidade ||
    extrairOportunidadeResultado(ultimoResultado);

  if (
    !oportunidade ||
    typeof oportunidade !== "object"
  ) {
    throw new Error(
      "Nenhuma oportunidade disponível para criar a oferta."
    );
  }

  const tituloOportunidade = textoSeguro(
    oportunidade.titulo,
    "Oportunidade"
  );

  const oferta = {
    id: gerarId("OFERTA"),

    oportunidadeId: textoSeguro(
      oportunidade.id,
      gerarId("OP")
    ),

    titulo: textoSeguro(
      dadosEntrada.titulo,
      `Oferta — ${tituloOportunidade}`
    ),

    promessa: textoSeguro(
      dadosEntrada.promessa,
      oportunidade.hipotese ||
        `Solução para o problema identificado em: ${tituloOportunidade}`
    ),

    descricao: textoSeguro(
      dadosEntrada.descricao,
      ""
    ),

    publico: textoSeguro(
      dadosEntrada.publico,
      oportunidade.publico ||
        oportunidade.modelo ||
        "Público identificado pelo AUTÔMATO"
    ),

    modelo: textoSeguro(
      dadosEntrada.modelo,
      oportunidade.modelo || "DIGITAL"
    ),

    preco: numeroSeguro(
      dadosEntrada.preco,
      0
    ),

    moeda: textoSeguro(
      dadosEntrada.moeda,
      "BRL"
    ),

    checkoutUrl: textoSeguro(
      dadosEntrada.checkoutUrl,
      ""
    ),

    canal: textoSeguro(
      dadosEntrada.canal,
      "PENDENTE"
    ),

    status: "RASCUNHO",

    criadoEm: new Date().toISOString(),

    atualizadoEm: new Date().toISOString(),

    origem: {
      titulo: tituloOportunidade,

      fonte: textoSeguro(
        oportunidade.fonte ||
        oportunidade.source
      ),

      pontuacao: numeroSeguro(
        oportunidade.pontuacao ||
        oportunidade.score
      ),

      hipotese: textoSeguro(
        oportunidade.hipotese
      )
    }
  };

  dados.ofertas.push(oferta);

  const fila = registrarOportunidadeNaFila(
    oportunidade,
    extrairPlanoResultado(ultimoResultado)
  );

  if (fila) {
    fila.ofertaId = oferta.id;
    fila.status = "OFERTA_CRIADA";
    fila.atualizadoEm =
      new Date().toISOString();
  }

  salvarComercial(
    recalcularEstatisticasComerciais(dados)
  );

  return oferta;
}

function registrarLead(dadosEntrada = {}) {
  const dados = carregarComercial();

  const lead = {
    id: textoSeguro(
      dadosEntrada.id,
      gerarId("LEAD")
    ),

    ofertaId: textoSeguro(
      dadosEntrada.ofertaId
    ),

    nome: textoSeguro(
      dadosEntrada.nome,
      "Lead"
    ),

    contato: textoSeguro(
      dadosEntrada.contato
    ),

    origem: textoSeguro(
      dadosEntrada.origem,
      "AUTOMATO"
    ),

    observacao: textoSeguro(
      dadosEntrada.observacao
    ),

    criadoEm: new Date().toISOString()
  };

  dados.leads.push(lead);

  salvarComercial(
    recalcularEstatisticasComerciais(dados)
  );

  return lead;
}

function registrarVenda(dadosEntrada = {}) {
  const dados = carregarComercial();

  const valor = numeroSeguro(
    dadosEntrada.valor,
    0
  );

  if (valor < 0) {
    throw new Error(
      "Valor da venda não pode ser negativo."
    );
  }

  const venda = {
    id: textoSeguro(
      dadosEntrada.id,
      gerarId("VENDA")
    ),

    ofertaId: textoSeguro(
      dadosEntrada.ofertaId
    ),

    leadId: textoSeguro(
      dadosEntrada.leadId
    ),

    valor,

    moeda: textoSeguro(
      dadosEntrada.moeda,
      "BRL"
    ),

    origem: textoSeguro(
      dadosEntrada.origem,
      "AUTOMATO"
    ),

    observacao: textoSeguro(
      dadosEntrada.observacao
    ),

    criadoEm: new Date().toISOString()
  };

  dados.vendas.push(venda);

  dados.receitas.push({
    id: gerarId("REC"),

    vendaId: venda.id,

    ofertaId: venda.ofertaId,

    valor: venda.valor,

    moeda: venda.moeda,

    criadoEm: venda.criadoEm
  });

  const oferta = dados.ofertas.find(
    item => item.id === venda.ofertaId
  );

  if (oferta) {
    oferta.vendas =
      numeroSeguro(oferta.vendas) + 1;

    oferta.receita =
      numeroSeguro(oferta.receita) + valor;

    oferta.status = "VENDA_REGISTRADA";

    oferta.atualizadoEm =
      new Date().toISOString();
  }

  salvarComercial(
    recalcularEstatisticasComerciais(dados)
  );

  return venda;
}

function obterResumoComercial() {
  const dados = carregarComercial();

  recalcularEstatisticasComerciais(dados);

  const ofertas = Array.isArray(dados.ofertas)
    ? dados.ofertas
    : [];

  const fila = Array.isArray(dados.fila)
    ? dados.fila
    : [];

  return {
    ok: true,

    arquivo: ARQUIVO_COMERCIAL,

    estatisticas: dados.estatisticas,

    ofertasRecentes:
      ofertas.slice(-10).reverse(),

    fila:
      fila.slice(-20).reverse(),

    atualizadoEm:
      dados.atualizadoEm
  };
}

function obterDadosComerciais() {
  const dados = carregarComercial();

  recalcularEstatisticasComerciais(dados);

  return dados;
}

function sincronizarUltimoResultadoComercial() {
  if (!ultimoResultado) {
    return {
      ok: false,
      mensagem:
        "Ainda não existe resultado de ciclo."
    };
  }

  const resultadoReal =
    ultimoResultado.resultado ||
    ultimoResultado;

  const oportunidade =
    extrairOportunidadeResultado(
      resultadoReal
    );

  if (!oportunidade) {
    return {
      ok: false,
      mensagem:
        "O último ciclo não expôs uma oportunidade em formato reconhecível."
    };
  }

  const fila =
    registrarOportunidadeNaFila(
      oportunidade,
      extrairPlanoResultado(
        resultadoReal
      )
    );

  return {
    ok: true,
    oportunidade,
    fila
  };
}

// =========================================================
// SEGURANÇA / ARQUIVOS
// =========================================================

function caminhoSeguro(relativo) {
  if (
    !relativo ||
    typeof relativo !== "string"
  ) {
    throw new Error(
      "Caminho inválido."
    );
  }

  const absoluto = path.resolve(
    ROOT,
    relativo
  );

  const raiz = path.resolve(ROOT);

  if (
    absoluto !== raiz &&
    !absoluto.startsWith(
      raiz + path.sep
    )
  ) {
    throw new Error(
      "Acesso fora da pasta do AUTÔMATO não permitido."
    );
  }

  return absoluto;
}

function validarExtensao(arquivo) {
  const ext =
    path.extname(arquivo).toLowerCase();

  if (
    !EXTENSOES_PERMITIDAS.has(ext)
  ) {
    throw new Error(
      `Extensão não permitida: ${
        ext || "(sem extensão)"
      }`
    );
  }
}

function listarArquivos(
  diretorio,
  base = ""
) {
  const resultado = [];

  if (!fs.existsSync(diretorio)) {
    return resultado;
  }

  for (
    const item of fs.readdirSync(
      diretorio,
      { withFileTypes: true }
    )
  ) {
    if (
      item.name === "node_modules" ||
      item.name === ".git" ||
      item.name === ".cache"
    ) {
      continue;
    }

    const caminho =
      path.join(
        diretorio,
        item.name
      );

    const relativo =
      path.join(
        base,
        item.name
      );

    if (item.isDirectory()) {
      resultado.push(
        ...listarArquivos(
          caminho,
          relativo
        )
      );
    } else {
      try {
        validarExtensao(
          item.name
        );

        resultado.push({
          nome: item.name,

          caminho:
            relativo.replace(
              /\\/g,
              "/"
            ),

          tamanho:
            fs.statSync(
              caminho
            ).size
        });
      } catch (_) {
        // Ignora arquivos não permitidos.
      }
    }
  }

  return resultado;
}

function lerJsonBody(req) {
  return new Promise(
    (
      resolve,
      reject
    ) => {
      let body = "";

      req.on(
        "data",
        chunk => {
          body += chunk.toString();

          if (
            body.length >
            5 * 1024 * 1024
          ) {
            reject(
              new Error(
                "Corpo da requisição muito grande."
              )
            );

            req.destroy();
          }
        }
      );

      req.on(
        "end",
        () => {
          if (!body.trim()) {
            resolve({});
            return;
          }

          try {
            resolve(
              JSON.parse(body)
            );
          } catch (_) {
            reject(
              new Error(
                "JSON inválido."
              )
            );
          }
        }
      );

      req.on(
        "error",
        reject
      );
    }
  );
}

function responder(
  res,
  status,
  dados,
  tipo =
    "application/json; charset=utf-8"
) {
  res.writeHead(
    status,
    {
      "Content-Type": tipo,

      "Cache-Control":
        "no-store, no-cache, must-revalidate",

      "Pragma": "no-cache",

      "Access-Control-Allow-Origin": "*",

      "Access-Control-Allow-Methods":
        "GET,POST,PUT,OPTIONS",

      "Access-Control-Allow-Headers":
        "Content-Type"
    }
  );

  if (
    tipo.includes(
      "application/json"
    )
  ) {
    res.end(
      JSON.stringify(
        dados,
        null,
        2
      )
    );
  } else {
    res.end(dados);
  }
}

function limparCacheAutomato() {
  const arquivos = [
    "radar.js",
    "investigador.js",
    "mercado.js",
    "estrategista.js",
    "executor.js",
    "metricas.js",
    "aprendizado.js",
    "automato.js"
  ];

  for (
    const arquivo of arquivos
  ) {
    try {
      const absoluto =
        path.join(
          ROOT,
          arquivo
        );

      delete require.cache[
        require.resolve(
          absoluto
        )
      ];
    } catch (_) {
      // Arquivo ainda não carregado.
    }
  }
}

function carregarAprendizado() {
  limparCacheAutomato();

  const arquivo =
    path.join(
      ROOT,
      "aprendizado.js"
    );

  if (
    !fs.existsSync(
      arquivo
    )
  ) {
    throw new Error(
      "aprendizado.js não encontrado."
    );
  }

  return require(
    arquivo
  );
}

function obterMemoria() {
  try {
    const aprendizado =
      carregarAprendizado();

    const memoria =
      typeof aprendizado.obterMemoria ===
      "function"
        ? aprendizado.obterMemoria()
        : {};

    const estatisticas =
      typeof aprendizado.obterEstatisticas ===
      "function"
        ? aprendizado.obterEstatisticas()
        : memoria.estatisticas ||
          {};

    const historico =
      typeof aprendizado.obterHistorico ===
      "function"
        ? aprendizado.obterHistorico()
        : Array.isArray(memoria.historico)
          ? memoria.historico
          : [];

    return {
      memoria,
      estatisticas,
      historico
    };
  } catch (erro) {
    return {
      memoria: null,
      estatisticas: {},
      historico: [],
      erro: erro.message
    };
  }
}

// =========================================================
// NORMALIZAÇÃO DAS ESTATÍSTICAS
// =========================================================

function extrairPrimeiroNumero(
  objeto,
  chaves,
  padrao = 0
) {
  if (
    !objeto ||
    typeof objeto !== "object"
  ) {
    return padrao;
  }

  for (
    const chave of chaves
  ) {
    if (
      objeto[chave] !== undefined &&
      objeto[chave] !== null
    ) {
      const numero =
        Number(
          objeto[chave]
        );

      if (
        Number.isFinite(
          numero
        )
      ) {
        return numero;
      }
    }
  }

  return padrao;
}

function contarHistorico(
  historico,
  palavras
) {
  if (
    !Array.isArray(
      historico
    )
  ) {
    return 0;
  }

  return historico.filter(
    item => {
      const texto =
        JSON.stringify(
          item
        ).toUpperCase();

      return palavras.some(
        palavra =>
          texto.includes(
            palavra
          )
      );
    }
  ).length;
}

function normalizarEstatisticas(
  bruto
) {
  const origem =
    bruto &&
    typeof bruto === "object"
      ? bruto
      : {};

  const estatisticasAninhadas =
    origem.estatisticas &&
    typeof origem.estatisticas === "object"
      ? origem.estatisticas
      : {};

  const historico =
    Array.isArray(origem.historico)
      ? origem.historico
      : [];

  const memoria =
    origem.memoria &&
    typeof origem.memoria === "object"
      ? origem.memoria
      : {};

  // -------------------------------------------------------
  // CICLOS
  // -------------------------------------------------------

  const ciclos = Math.max(
    extrairPrimeiroNumero(
      origem,
      [
        "ciclos",
        "totalCiclos",
        "ciclosExecutados",
        "total"
      ],
      0
    ),

    extrairPrimeiroNumero(
      estatisticasAninhadas,
      [
        "ciclos",
        "totalCiclos",
        "ciclosExecutados",
        "total"
      ],
      0
    ),

    extrairPrimeiroNumero(
      memoria,
      [
        "ciclos",
        "totalCiclos",
        "ciclosExecutados",
        "total"
      ],
      0
    ),

    historico.length
  );

  // -------------------------------------------------------
  // CONCLUÍDOS
  //
  // CORREÇÃO:
  // O aprendizado.registrarCiclo() registra o histórico
  // quando o ciclo chegou ao final do fluxo de aprendizado.
  // Portanto, histórico.length / memoria.ciclos representa
  // ciclos efetivamente registrados, mesmo quando o registro
  // não possui a palavra "CONCLUÍDO" ou "SUCESSO".
  // -------------------------------------------------------

  const concluidosExplicitos = Math.max(
    extrairPrimeiroNumero(
      origem,
      [
        "concluidos",
        "ciclosConcluidos",
        "sucessos",
        "completed"
      ],
      0
    ),

    extrairPrimeiroNumero(
      estatisticasAninhadas,
      [
        "concluidos",
        "ciclosConcluidos",
        "sucessos",
        "completed"
      ],
      0
    ),

    extrairPrimeiroNumero(
      memoria,
      [
        "concluidos",
        "ciclosConcluidos",
        "completed"
      ],
      0
    ),

    contarHistorico(
      historico,
      [
        "CONCLUIDO",
        "CONCLUÍDO",
        "SUCESSO"
      ]
    )
  );

  const concluidos = Math.max(
    concluidosExplicitos,
    historico.length,
    extrairPrimeiroNumero(
      memoria,
      [
        "ciclos",
        "totalCiclos"
      ],
      0
    )
  );

  // -------------------------------------------------------
  // DESCARTADOS
  // -------------------------------------------------------

  const descartados = Math.max(
    extrairPrimeiroNumero(
      origem,
      [
        "descartados",
        "descarte",
        "descartes",
        "discarded"
      ],
      0
    ),

    extrairPrimeiroNumero(
      estatisticasAninhadas,
      [
        "descartados",
        "descarte",
        "descartes",
        "discarded"
      ],
      0
    ),

    extrairPrimeiroNumero(
      memoria,
      [
        "descartados",
        "descarte",
        "descartes"
      ],
      0
    ),

    contarHistorico(
      historico,
      [
        "DESCARTAR",
        "DESCARTADO"
      ]
    )
  );

  // -------------------------------------------------------
  // REPETIDOS
  // -------------------------------------------------------

  const repetidos = Math.max(
    extrairPrimeiroNumero(
      origem,
      [
        "repetidos",
        "repeticoes",
        "repetições",
        "repetitions"
      ],
      0
    ),

    extrairPrimeiroNumero(
      estatisticasAninhadas,
      [
        "repetidos",
        "repeticoes",
        "repetições",
        "repetitions"
      ],
      0
    ),

    extrairPrimeiroNumero(
      memoria,
      [
        "repetidos",
        "repeticoes",
        "repetições"
      ],
      0
    ),

    contarHistorico(
      historico,
      [
        "REPETIR",
        "REPETIDO"
      ]
    )
  );

  // -------------------------------------------------------
  // INVESTIGAÇÕES
  // -------------------------------------------------------

  const investigacoes = Math.max(
    extrairPrimeiroNumero(
      origem,
      [
        "investigacoes",
        "investigações",
        "investigacoesRealizadas",
        "totalInvestigacoes",
        "totalInvestigações"
      ],
      0
    ),

    extrairPrimeiroNumero(
      estatisticasAninhadas,
      [
        "investigacoes",
        "investigações",
        "investigacoesRealizadas",
        "totalInvestigacoes",
        "totalInvestigações"
      ],
      0
    ),

    extrairPrimeiroNumero(
      memoria,
      [
        "investigacoes",
        "investigações",
        "investigacoesRealizadas",
        "totalInvestigacoes",
        "totalInvestigações"
      ],
      0
    ),

    contarHistorico(
      historico,
      [
        "INVESTIGAR"
      ]
    )
  );

  return {
    ciclos,
    concluidos,
    descartados,
    repetidos,
    investigacoes
  };
}

// =========================================================
// EXECUÇÃO DO CICLO
// =========================================================

async function executarCiclo() {
  if (cicloRodando) {
    return {
      ok: false,
      ocupado: true,
      mensagem:
        "Um ciclo já está em execução."
    };
  }

  cicloRodando = true;
  ultimoErro = null;

  try {
    limparCacheAutomato();

    const automatoPath =
      path.join(
        ROOT,
        "automato.js"
      );

    if (
      !fs.existsSync(
        automatoPath
      )
    ) {
      throw new Error(
        "automato.js não encontrado."
      );
    }

    const automato =
      require(
        automatoPath
      );

    if (
      !automato ||
      typeof automato.executarCiclo !==
        "function"
    ) {
      throw new Error(
        "automato.js não exporta a função executarCiclo()."
      );
    }

    const resultado =
      await automato.executarCiclo();

    ultimoResultado =
      resultado;

    try {
      sincronizarUltimoResultadoComercial();
    } catch (_) {
      // Não derruba o ciclo principal.
    }

    if (
      modoContinuo
    ) {
      totalCiclosContinuos++;

      ultimoCicloContinuoEm =
        new Date().toISOString();
    }

    return {
      ok: true,
      resultado
    };
  } catch (erro) {
    ultimoErro = {
      mensagem:
        erro.message,

      stack:
        erro.stack,

      timestamp:
        new Date().toISOString()
    };

    return {
      ok: false,
      erro:
        erro.message
    };
  } finally {
    cicloRodando = false;
  }
}

// =========================================================
// EXECUÇÃO DE MÓDULOS
// =========================================================

async function executarModulo(nome) {
  const permitido = [
    "radar.js",
    "investigador.js",
    "mercado.js",
    "estrategista.js",
    "executor.js",
    "metricas.js",
    "aprendizado.js",
    "automato.js"
  ];

  if (
    !permitido.includes(
      nome
    )
  ) {
    return {
      ok: false,
      erro:
        "Módulo não permitido.",
      nome
    };
  }

  try {
    const arquivo =
      caminhoSeguro(nome);

    validarExtensao(
      arquivo
    );

    if (
      !fs.existsSync(
        arquivo
      )
    ) {
      throw new Error(
        `Arquivo não encontrado: ${nome}`
      );
    }

    return await new Promise(
      resolve => {
        execFile(
          process.execPath,
          [arquivo],
          {
            cwd: ROOT,
            timeout:
              10 * 60 * 1000,
            maxBuffer:
              20 * 1024 * 1024,
            windowsHide:
              true
          },
          (
            erro,
            stdout,
            stderr
          ) => {
            resolve({
              ok: !erro,

              nome,

              codigo:
                erro
                  ? erro.code
                  : 0,

              stdout:
                stdout || "",

              stderr:
                stderr || "",

              erro:
                erro
                  ? erro.message
                  : null
            });
          }
        );
      }
    );
  } catch (erro) {
    return {
      ok: false,
      nome,
      erro:
        erro.message
    };
  }
}

// =========================================================
// TESTE DO RADAR
// =========================================================

async function testarRadar() {
  try {
    limparCacheAutomato();

    const arquivo =
      path.join(
        ROOT,
        "radar.js"
      );

    if (
      !fs.existsSync(
        arquivo
      )
    ) {
      throw new Error(
        "radar.js não encontrado."
      );
    }

    const moduloRadar =
      require(
        arquivo
      );

    const executarRadar =
      typeof moduloRadar ===
      "function"
        ? moduloRadar
        : moduloRadar &&
          typeof moduloRadar.radar ===
            "function"
          ? moduloRadar.radar
          : null;

    if (
      !executarRadar
    ) {
      throw new Error(
        "radar.js não exporta uma função radar() executável."
      );
    }

    const resultado =
      await executarRadar();

    return {
      ok: true,
      tipo:
        "teste-radar",
      resultado
    };
  } catch (erro) {
    return {
      ok: false,
      tipo:
        "teste-radar",
      erro:
        erro.message,
      stack:
        erro.stack
    };
  }
}

// =========================================================
// MODO CONTÍNUO / AUTÔNOMO
// =========================================================

function normalizarIntervaloMinutos(
  valor
) {
  const numero =
    Number(valor);

  if (
    !Number.isFinite(
      numero
    )
  ) {
    return 15;
  }

  return Math.max(
    1,
    Math.min(
      numero,
      24 * 60
    )
  );
}

function agendarProximoCiclo() {
  if (
    !modoContinuo
  ) {
    proximoCicloEm =
      null;

    return;
  }

  const intervaloMs =
    continuoIntervaloMinutos *
    60 *
    1000;

  proximoCicloEm =
    Date.now() +
    intervaloMs;

  if (
    intervaloContinuo
  ) {
    clearTimeout(
      intervaloContinuo
    );
  }

  intervaloContinuo =
    setTimeout(
      async () => {
        intervaloContinuo =
          null;

        if (
          !modoContinuo
        ) {
          return;
        }

        if (
          !cicloRodando
        ) {
          await executarCiclo();
        }

        agendarProximoCiclo();
      },
      intervaloMs
    );
}

function iniciarContinuo(
  opcoes = {}
) {
  if (
    modoContinuo
  ) {
    return {
      ok: true,
      ativo: true,
      mensagem:
        "Modo contínuo já está ativo.",
      intervaloMinutos:
        continuoIntervaloMinutos,
      proximoCicloEm,
      totalCiclos:
        totalCiclosContinuos
    };
  }

  continuoIntervaloMinutos =
    normalizarIntervaloMinutos(
      opcoes.minutos ??
        opcoes.intervaloMinutos ??
        15
    );

  modoContinuo =
    true;

  continuoIniciadoEm =
    new Date().toISOString();

  totalCiclosContinuos =
    0;

  ultimoCicloContinuoEm =
    null;

  executarCiclo()
    .catch(
      erro => {
        ultimoErro = {
          mensagem:
            erro?.message ||
            String(erro),

          stack:
            erro?.stack,

          timestamp:
            new Date().toISOString()
        };
      }
    )
    .finally(
      () => {
        if (
          modoContinuo
        ) {
          agendarProximoCiclo();
        }
      }
    );

  return {
    ok: true,
    ativo: true,
    mensagem:
      "Modo contínuo iniciado. O primeiro ciclo começou imediatamente.",
    intervaloMinutos:
      continuoIntervaloMinutos,
    proximoCicloEm,
    iniciadoEm:
      continuoIniciadoEm
  };
}

function pararContinuo() {
  modoContinuo =
    false;

  if (
    intervaloContinuo
  ) {
    clearTimeout(
      intervaloContinuo
    );

    intervaloContinuo =
      null;
  }

  proximoCicloEm =
    null;

  return {
    ok: true,
    ativo: false,
    mensagem:
      "Modo contínuo parado.",
    totalCiclos:
      totalCiclosContinuos,
    ultimoCicloEm:
      ultimoCicloContinuoEm
  };
}

// =========================================================
// STATUS
// =========================================================

function status() {
  const aprendizado =
    obterMemoria();

  const comercial =
    obterResumoComercial();

  const estatisticas =
    normalizarEstatisticas(
      aprendizado
    );

  return {
    ok: true,

    painel:
      "AUTÔMATO",

    porta:
      PORT,

    root:
      ROOT,

    cicloRodando,

    modoContinuo,

    estado:
      cicloRodando
        ? "EXECUTANDO"
        : "PARADO",

    status:
      cicloRodando
        ? "EXECUTANDO"
        : "PARADO",

    modo:
      modoContinuo
        ? "AUTOMÁTICO"
        : "MANUAL",

    automatico:
      modoContinuo,

    cicloId:
      ultimoResultado?.cicloId ||
      ultimoResultado?.resultado?.cicloId ||
      null,

    proximoCicloEm,

    tempoAteProximoCiclo:
      proximoCicloEm
        ? Math.max(
            0,
            proximoCicloEm -
              Date.now()
          )
        : null,

    continuo: {
      ativo:
        modoContinuo,

      intervaloMinutos:
        continuoIntervaloMinutos,

      iniciadoEm:
        continuoIniciadoEm,

      proximoCicloEm,

      totalCiclos:
        totalCiclosContinuos,

      ultimoCicloEm:
        ultimoCicloContinuoEm
    },

    ultimoResultado,

    ultimoErro,

    memoriaExiste:
      !aprendizado.erro &&
      aprendizado.memoria !==
        null,

    estatisticas,

    comercial:
      comercial.estatisticas,

    timestamp:
      new Date().toISOString()
  };
}

// =========================================================
// PUBLIC
// =========================================================

function garantirPublic() {
  const publicDir =
    path.join(
      ROOT,
      "public"
    );

  if (
    !fs.existsSync(
      publicDir
    )
  ) {
    fs.mkdirSync(
      publicDir,
      {
        recursive:
          true
      }
    );
  }

  const index =
    path.join(
      publicDir,
      "index.html"
    );

  if (
    !fs.existsSync(
      index
    )
  ) {
    fs.writeFileSync(
      index,
      "<!doctype html><html><body><h1>AUTÔMATO</h1></body></html>",
      "utf8"
    );
  }
}

// =========================================================
// ARQUIVOS
// =========================================================

function obterCaminhoArquivo(
  dados,
  url
) {
  const candidatos = [
    dados?.path,
    dados?.name,
    dados?.nome,
    dados?.arquivo,

    url?.searchParams?.get(
      "path"
    ),

    url?.searchParams?.get(
      "name"
    ),

    url?.searchParams?.get(
      "nome"
    ),

    url?.searchParams?.get(
      "arquivo"
    )
  ];

  return candidatos.find(
    valor =>
      typeof valor ===
        "string" &&
      valor.trim()
  );
}

function obterConteudoArquivo(
  dados
) {
  if (
    typeof dados.content ===
    "string"
  ) {
    return dados.content;
  }

  if (
    typeof dados.conteudo ===
    "string"
  ) {
    return dados.conteudo;
  }

  if (
    typeof dados.data ===
    "string"
  ) {
    return dados.data;
  }

  if (
    typeof dados.codigo ===
    "string"
  ) {
    return dados.codigo;
  }

  return null;
}

// =========================================================
// SERVIDOR
// =========================================================

const server =
  http.createServer(
    async (
      req,
      res
    ) => {
      try {
        const url =
          new URL(
            req.url,
            `http://${
              req.headers.host ||
              "127.0.0.1"
            }`
          );

        if (
          req.method ===
          "OPTIONS"
        ) {
          res.writeHead(
            204,
            {
              "Access-Control-Allow-Origin":
                "*",

              "Access-Control-Allow-Methods":
                "GET,POST,PUT,OPTIONS",

              "Access-Control-Allow-Headers":
                "Content-Type"
            }
          );

          res.end();

          return;
        }

        if (
          req.method ===
            "GET" &&
          url.pathname === "/"
        ) {
          garantirPublic();

          const arquivo =
            path.join(
              ROOT,
              "public",
              "index.html"
            );

          const html =
            fs.readFileSync(
              arquivo,
              "utf8"
            );

          responder(
            res,
            200,
            html,
            "text/html; charset=utf-8"
          );

          return;
        }

        if (
          req.method ===
            "GET" &&
          url.pathname ===
            "/api/status"
        ) {
          responder(
            res,
            200,
            status()
          );

          return;
        }

        if (
          req.method ===
            "GET" &&
          url.pathname ===
            "/api/memoria"
        ) {
          responder(
            res,
            200,
            obterMemoria()
          );

          return;
        }

        if (
          req.method ===
            "GET" &&
          url.pathname ===
            "/api/historico"
        ) {
          const dados =
            obterMemoria();

          const limite =
            Math.max(
              1,
              Math.min(
                100,
                Number(
                  url.searchParams.get(
                    "limite"
                  )
                ) || 30
              )
            );

          const historico =
            Array.isArray(
              dados.historico
            )
              ? dados.historico
                  .slice(-limite)
                  .reverse()
              : [];

          responder(
            res,
            200,
            {
              ok: true,
              historico
            }
          );

          return;
        }

        if (
          req.method ===
            "GET" &&
          url.pathname ===
            "/api/estatisticas"
        ) {
          const dados =
            obterMemoria();

          responder(
            res,
            200,
            {
              ok: true,

              estatisticas:
                normalizarEstatisticas(
                  dados
                )
            }
          );

          return;
        }

        if (
          req.method ===
            "GET" &&
          url.pathname ===
            "/api/comercial"
        ) {
          responder(
            res,
            200,
            obterDadosComerciais()
          );

          return;
        }

        if (
          req.method ===
            "GET" &&
          url.pathname ===
            "/api/comercial/status"
        ) {
          responder(
            res,
            200,
            obterResumoComercial()
          );

          return;
        }

        if (
          req.method ===
            "GET" &&
          url.pathname ===
            "/api/comercial/fila"
        ) {
          const dados =
            carregarComercial();

          responder(
            res,
            200,
            {
              ok: true,

              fila:
                dados.fila
                  .slice()
                  .reverse()
            }
          );

          return;
        }

        if (
          req.method ===
            "POST" &&
          url.pathname ===
            "/api/comercial/oferta"
        ) {
          const dados =
            await lerJsonBody(
              req
            );

          const oferta =
            criarOfertaComercial(
              dados
            );

          responder(
            res,
            201,
            {
              ok: true,
              oferta
            }
          );

          return;
        }

        if (
          req.method ===
            "POST" &&
          url.pathname ===
            "/api/comercial/sincronizar"
        ) {
          const resultado =
            sincronizarUltimoResultadoComercial();

          responder(
            res,
            resultado.ok
              ? 200
              : 400,
            resultado
          );

          return;
        }

        if (
          req.method ===
            "POST" &&
          url.pathname ===
            "/api/comercial/lead"
        ) {
          const dados =
            await lerJsonBody(
              req
            );

          const lead =
            registrarLead(
              dados
            );

          responder(
            res,
            201,
            {
              ok: true,
              lead
            }
          );

          return;
        }

        if (
          req.method ===
            "POST" &&
          url.pathname ===
            "/api/comercial/venda"
        ) {
          const dados =
            await lerJsonBody(
              req
            );

          const venda =
            registrarVenda(
              dados
            );

          responder(
            res,
            201,
            {
              ok: true,

              venda,

              estatisticas:
                carregarComercial()
                  .estatisticas
            }
          );

          return;
        }

        if (
          req.method ===
            "GET" &&
          (
            url.pathname ===
              "/api/files" ||
            url.pathname ===
              "/api/arquivos"
          )
        ) {
          responder(
            res,
            200,
            {
              ok: true,

              arquivos:
                listarArquivos(
                  ROOT
                )
            }
          );

          return;
        }

        if (
          req.method ===
            "GET" &&
          (
            url.pathname ===
              "/api/file" ||
            url.pathname ===
              "/api/arquivo"
          )
        ) {
          const relativo =
            obterCaminhoArquivo(
              {},
              url
            );

          if (!relativo) {
            responder(
              res,
              400,
              {
                ok: false,

                erro:
                  "Arquivo não informado."
              }
            );

            return;
          }

          const arquivo =
            caminhoSeguro(
              relativo
            );

          validarExtensao(
            arquivo
          );

          if (
            !fs.existsSync(
              arquivo
            )
          ) {
            responder(
              res,
              404,
              {
                ok: false,

                erro:
                  "Arquivo não encontrado.",

                caminho:
                  relativo
              }
            );

            return;
          }

          responder(
            res,
            200,
            {
              ok: true,

              caminho:
                relativo,

              conteudo:
                fs.readFileSync(
                  arquivo,
                  "utf8"
                )
            }
          );

          return;
        }

        if (
          (
            req.method ===
              "POST" ||
            req.method ===
              "PUT"
          ) &&
          (
            url.pathname ===
              "/api/file" ||
            url.pathname ===
              "/api/arquivo"
          )
        ) {
          const dados =
            await lerJsonBody(
              req
            );

          const relativo =
            obterCaminhoArquivo(
              dados,
              url
            );

          const conteudo =
            obterConteudoArquivo(
              dados
            );

          if (
            !relativo ||
            conteudo === null
          ) {
            responder(
              res,
              400,
              {
                ok: false,

                erro:
                  "Informe o arquivo e o conteúdo."
              }
            );

            return;
          }

          const arquivo =
            caminhoSeguro(
              relativo
            );

          validarExtensao(
            arquivo
          );

          fs.mkdirSync(
            path.dirname(
              arquivo
            ),
            {
              recursive:
                true
            }
          );

          fs.writeFileSync(
            arquivo,
            conteudo,
            "utf8"
          );

          limparCacheAutomato();

          responder(
            res,
            200,
            {
              ok: true,

              mensagem:
                "Arquivo salvo.",

              caminho:
                relativo
            }
          );

          return;
        }

        if (
          req.method ===
            "POST" &&
          url.pathname ===
            "/api/ciclo"
        ) {
          const resultado =
            await executarCiclo();

          responder(
            res,
            resultado.ok
              ? 200
              : 500,
            resultado
          );

          return;
        }

        if (
          req.method ===
            "POST" &&
          (
            url.pathname ===
              "/api/continuo/iniciar" ||
            url.pathname ===
              "/api/automatico/iniciar"
          )
        ) {
          const dados =
            await lerJsonBody(
              req
            );

          const resultado =
            iniciarContinuo(
              dados
            );

          responder(
            res,
            200,
            resultado
          );

          return;
        }

        if (
          req.method ===
            "POST" &&
          (
            url.pathname ===
              "/api/continuo/parar" ||
            url.pathname ===
              "/api/automatico/parar"
          )
        ) {
          const resultado =
            pararContinuo();

          responder(
            res,
            200,
            resultado
          );

          return;
        }

        if (
          req.method ===
            "POST" &&
          (
            url.pathname ===
              "/api/radar" ||
            url.pathname ===
              "/api/radar/teste"
          )
        ) {
          const resultado =
            await testarRadar();

          responder(
            res,
            resultado.ok
              ? 200
              : 500,
            resultado
          );

          return;
        }

        if (
          req.method ===
            "POST" &&
          (
            url.pathname ===
              "/api/module" ||
            url.pathname ===
              "/api/modulo"
          )
        ) {
          const dados =
            await lerJsonBody(
              req
            );

          const nome =
            dados.name ||
            dados.nome;

          const resultado =
            await executarModulo(
              nome
            );

          responder(
            res,
            resultado.ok
              ? 200
              : 400,
            resultado
          );

          return;
        }

        if (
          req.method ===
            "POST" &&
          url.pathname ===
            "/api/run"
        ) {
          const dados =
            await lerJsonBody(
              req
            );

          const nome =
            dados.name ||
            dados.nome;

          const resultado =
            await executarModulo(
              nome
            );

          responder(
            res,
            resultado.ok
              ? 200
              : 400,
            resultado
          );

          return;
        }

        responder(
          res,
          404,
          {
            ok: false,

            erro:
              "Rota não encontrada.",

            rota:
              url.pathname
          }
        );
      } catch (erro) {
        console.error(
          "ERRO PAINEL:",
          erro
        );

        responder(
          res,
          500,
          {
            ok: false,

            erro:
              erro.message,

            stack:
              erro.stack
          }
        );
      }
    }
  );

// =========================================================
// INICIALIZAÇÃO
// =========================================================

garantirPublic();
garantirDiretorioDados();

server.listen(
  PORT,
  "127.0.0.1",
  () => {
    console.log("");

    console.log(
      "========================================"
    );

    console.log(
      "        AUTÔMATO — PAINEL"
    );

    console.log(
      "========================================"
    );

    console.log(
      `Pasta: ${ROOT}`
    );

    console.log(
      `Painel: http://127.0.0.1:${PORT}`
    );

    console.log(
      `Comercial: ${ARQUIVO_COMERCIAL}`
    );

    console.log(
      "========================================"
    );

    console.log("");
  }
);

// =========================================================
// ENCERRAMENTO
// =========================================================

process.on(
  "SIGINT",
  () => {
    pararContinuo();

    server.close(
      () =>
        process.exit(0)
    );
  }
);

process.on(
  "SIGTERM",
  () => {
    pararContinuo();

    server.close(
      () =>
        process.exit(0)
    );
  }
);