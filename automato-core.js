// AUTÔMATO — Núcleo de Orquestração
// Versão: 2.0.0 — MONETIZAÇÃO AUTÔNOMA
const radar = require("./radar");
const investigador = require("./investigador");
const mercado = require("./mercado");
const estrategista = require("./estrategista");
const executor = require("./executor");
const metricas = require("./metricas");
const aprendizado = require("./aprendizado");

const VERSAO = "2.0.0";

function numeroSeguro(...valores) {
  for (const valor of valores) {
    if (valor !== undefined && valor !== null && valor !== "" && !Array.isArray(valor)) {
      const numero = Number(valor);
      if (Number.isFinite(numero)) {
        return numero;
      }
    }
  }
  return 0;
}

function primeiroValor(...valores) {
  for (const valor of valores) {
    if (valor !== undefined && valor !== null && valor !== "") {
      return valor;
    }
  }
  return undefined;
}

function textoSeguro(valor, fallback = "") {
  if (valor === undefined || valor === null) {
    return fallback;
  }
  return String(valor).trim() || fallback;
}

function normalizarTexto(valor) {
  return textoSeguro(valor)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function contarFontes(valor) {
  if (Array.isArray(valor)) {
    return valor.length;
  }
  if (valor && typeof valor === "object") {
    if (Array.isArray(valor.fontes)) return valor.fontes.length;
    if (Array.isArray(valor.resultados)) return valor.resultados.length;
    if (Array.isArray(valor.fontesIndependentes)) return valor.fontesIndependentes.length;
  }
  return numeroSeguro(valor);
}

function extrairPontuacao(...objetos) {
  for (const objeto of objetos) {
    if (objeto === undefined || objeto === null || typeof objeto !== "object") continue;
    const valor = numeroSeguro(
      objeto.forca, objeto.pontuacao, objeto.score, 
      objeto.pontuacaoFinal, objeto.scoreFinal, objeto.forcaFinal,
      objeto.forcaOportunidade, objeto.pontuacaoOportunidade, objeto.scoreOportunidade
    );
    if (valor !== 0) return valor;
  }
  return 0;
}

function extrairPontuacaoRadar(resultado, oportunidade = {}) {
  const r = resultado || {};
  const valorResultado = numeroSeguro(r.forcaRadar, r.pontuacaoRadar, r.scoreRadar, r.pontuacao, r.score, r.forca);
  if (valorResultado !== 0) return valorResultado;
  return numeroSeguro(oportunidade.forcaRadar, oportunidade.pontuacaoRadar, oportunidade.scoreRadar, oportunidade.pontuacao, oportunidade.score);
}

function extrairPontuacaoMercado(resultado) {
  const r = resultado || {};
  const potencial = r.potencialDeTeste && typeof r.potencialDeTeste === "object" ? r.potencialDeTeste : {};
  return numeroSeguro(potencial.score, potencial.pontuacao, potencial.forca, r.pontuacaoMercado, r.scoreMercado, r.forcaMercado, r.pontuacao, r.score, r.forca);
}

function extrairPontuacaoInvestigador(resultado) {
  const r = resultado || {};
  return numeroSeguro(r.pontuacaoInvestigador, r.scoreInvestigador, r.forcaInvestigador, r.pontuacao, r.score, r.forca);
}

function extrairPontuacaoEstrategia(resultado) {
  const r = resultado || {};
  return numeroSeguro(r.pontuacaoEstrategica, r.pontuacaoEstrategia, r.scoreEstrategia, r.forcaEstrategia, r.pontuacao, r.score, r.forca);
}

function extrairExperimentoExecutor(retorno) {
  if (retorno && typeof retorno.experimento === "object") return retorno.experimento;
  if (retorno && retorno.resultado && typeof retorno.resultado.experimento === "object") return retorno.resultado.experimento;
  return retorno || {};
}

function extrairResultadoExecutor(retorno) {
  if (retorno && typeof retorno.resultado === "object") return retorno.resultado;
  return retorno || {};
}

async function executarRadar() {
  if (typeof radar === "function") return await radar();
  if (radar && typeof radar.executar === "function") return await radar.executar();
  if (radar && typeof radar.radar === "function") return await radar.radar();
  throw new Error("RADAR_INCOMPATIVEL: o módulo radar não possui função executável.");
}

function normalizarResultadoRadar(resultado) {
  if (Array.isArray(resultado)) {
    return { oportunidades: resultado, resultados: resultado, itens: resultado, totalColetado: resultado.length, bruto: resultado };
  }
  const r = resultado || {};
  let oportunidades = r.oportunidades || r.resultados || r.itens;
  if (!Array.isArray(oportunidades)) {
    if (Array.isArray(r.resultado)) oportunidades = r.resultado;
    else if (r.resultado && typeof r.resultado === "object") oportunidades = r.resultado.oportunidades || r.resultado.resultados || r.resultado.itens || [];
  }
  if (!Array.isArray(oportunidades)) oportunidades = [];
  return {
    ...r,
    oportunidades,
    resultados: Array.isArray(r.resultados) ? r.resultados : oportunidades,
    itens: Array.isArray(r.itens) ? r.itens : oportunidades,
    totalColetado: numeroSeguro(r.totalColetado, r.total, r.quantidade, r.itensColetados, r.resultado?.totalColetado, oportunidades.length),
    bruto: resultado
  };
}

function normalizarEvidenciaRadar(resultado, oportunidade = {}) {
  const r = resultado || {};
  const forca = extrairPontuacaoRadar(r, oportunidade);
  const totalSinais = numeroSeguro(r.totalSinais, r.sinaisTotais, r.quantidadeSinais, r.totalDeSinais, oportunidade.totalSinais, oportunidade.sinaisTotais, oportunidade.quantidadeSinais, oportunidade.totalDeSinais);
  return {
    forca, pontuacao: forca, totalSinais,
    classificacao: primeiroValor(r.classificacao, r.nivel, r.classificacaoRadar, oportunidade.classificacaoRadar, oportunidade.classificacao, ""),
    status: primeiroValor(r.status, r.estado, oportunidade.status, ""),
    origem: "RADAR"
  };
}

function normalizarEvidenciaMercado(resultado) {
  const r = resultado || {};
  const potencial = r.potencialDeTeste && typeof r.potencialDeTeste === "object" ? r.potencialDeTeste : {};
  const forca = extrairPontuacaoMercado(r);
  const fontesIndependentes = contarFontes(primeiroValor(r.fontesIndependentes, r.numeroFontesIndependentes, r.quantidadeFontesIndependentes, r.numeroFontes, r.totalFontes, r.fontes, potencial.fontesIndependentes, potencial.numeroFontes, potencial.fontes));
  const totalSinais = numeroSeguro(r.totalSinais, r.sinaisTotais, r.quantidadeSinais, r.totalDeSinais, potencial.totalSinais);
  return {
    forca, pontuacao: forca, totalSinais, fontesIndependentes,
    classificacao: primeiroValor(r.classificacao, r.nivel, r.classificacaoMercado, potencial.classificacao, ""),
    status: primeiroValor(r.status, r.estado, ""),
    decisao: primeiroValor(r.decisao, r.proximaAcao, ""),
    confianca: numeroSeguro(r.confianca, r.confiancaMercado, potencial.confianca),
    origem: "MERCADO"
  };
}

function normalizarEvidenciaInvestigador(resultado) {
  const r = resultado || {};
  const forca = extrairPontuacaoInvestigador(r);
  return {
    forca, pontuacao: forca,
    totalSinais: numeroSeguro(r.totalSinais, r.sinaisTotais, r.quantidadeSinais, r.totalDeSinais, r.sinais?.total),
    classificacao: primeiroValor(r.classificacao, r.nivel, r.classificacaoInvestigador, ""),
    confianca: numeroSeguro(r.confianca, r.confiancaInvestigador),
    decisao: primeiroValor(r.decisao, r.proximaAcao, ""),
    status: primeiroValor(r.status, r.estado, ""),
    fontesIndependentes: contarFontes(primeiroValor(r.fontesIndependentes, r.numeroFontes, r.fontes, r.resultados)),
    origem: "INVESTIGADOR"
  };
}

function normalizarEvidenciaEstrategia(resultado) {
  const r = resultado || {};
  const forca = extrairPontuacaoEstrategia(r);
  return {
    forca, pontuacao: forca,
    totalSinais: numeroSeguro(r.totalSinais, r.sinaisTotais, r.quantidadeSinais, r.totalDeSinais),
    classificacao: primeiroValor(r.classificacao, r.nivel, r.classificacaoEstrategia, ""),
    status: primeiroValor(r.status, r.estado, ""),
    origem: "ESTRATEGIA"
  };
}

function normalizarEvidenciaExecutor(retornoExecutor, resultadoMetricas) {
  const experimento = extrairExperimentoExecutor(retornoExecutor);
  const resultado = extrairResultadoExecutor(retornoExecutor);
  const metricasResultado = resultadoMetricas || {};
  const forca = numeroSeguro(
    experimento.forcaExecutor, experimento.pontuacaoExecutor, experimento.scoreExecutor,
    resultado.forcaExecutor, resultado.pontuacaoExecutor, resultado.scoreExecutor,
    metricasResultado.forcaExecutor, metricasResultado.pontuacaoExecutor, metricasResultado.scoreExecutor,
    experimento.forca, experimento.pontuacao, experimento.score,
    resultado.forca, resultado.pontuacao, metricasResultado.forca
  );
  const totalSinais = numeroSeguro(experimento.totalSinais, experimento.sinaisTotais, experimento.quantidadeSinais, experimento.totalDeSinais, resultado.totalSinais, metricasResultado.totalSinais);
  return {
    forca, pontuacao: forca, totalSinais,
    classificacao: experimento.classificacao || experimento.classificacaoExecutor || resultado.classificacao || metricasResultado.classificacao || "",
    status: experimento.status || resultado.status || metricasResultado.status || "",
    fonteAcessivel: experimento.fonteAcessivel !== undefined ? experimento.fonteAcessivel : (resultado.fonteAcessivel !== undefined ? resultado.fonteAcessivel : false),
    httpStatus: numeroSeguro(experimento.httpStatus, experimento.statusHttp, resultado.httpStatus, resultado.statusHttp, metricasResultado.httpStatus, metricasResultado.statusHttp),
    origem: "EXECUTOR"
  };
}

function construirContextoEvidencias(oportunidade, resultadoRadar, resultadoMercado, resultadoInvestigacao, resultadoEstrategia, evidenciaExecutor, resultadoMetricas) {
  return {
    radar: normalizarEvidenciaRadar(resultadoRadar, oportunidade),
    mercado: normalizarEvidenciaMercado(resultadoMercado),
    investigador: normalizarEvidenciaInvestigador(resultadoInvestigacao),
    estrategia: normalizarEvidenciaEstrategia(resultadoEstrategia),
    executor: evidenciaExecutor,
    resultado: resultadoMetricas || {}
  };
}

async function executarInvestigacao(oportunidade) {
  return await investigador.investigar(oportunidade);
}

function identificarPublico(oportunidade, mercadoResultado) {
  const texto = normalizarTexto([oportunidade?.titulo, oportunidade?.descricao, oportunidade?.hipotese, mercadoResultado?.oportunidade?.hipotese].join(" "));
  if (texto.includes("order fulfillment") || texto.includes("pedido") || texto.includes("logistica") || texto.includes("ecommerce")) return "Pequenas e médias empresas que processam pedidos.";
  if (texto.includes("freelancer")) return "Freelancers e profissionais independentes.";
  if (texto.includes("saas") || texto.includes("software")) return "Pequenas empresas e equipes de software.";
  return "Pessoas ou empresas que enfrentam o problema identificado.";
}

function criarPropostaValor(oportunidade, mercadoResultado) {
  const titulo = textoSeguro(oportunidade?.titulo, "problema identificado");
  const hipotese = textoSeguro(mercadoResultado?.oportunidade?.hipotese, oportunidade?.hipotese, "reduzir custo ou aumentar eficiência");
  return `Uma solução simples para ajudar o público a enfrentar "${titulo}", com foco em ${hipotese.replace(/\.$/, "")}.`;
}

function definirModeloMonetizacao(oportunidade, mercadoResultado) {
  const modelos = Array.isArray(mercadoResultado?.modelosDeCobranca) ? mercadoResultado.modelosDeCobranca : [];
  const titulo = normalizarTexto(oportunidade?.titulo);
  if (titulo.includes("software") || titulo.includes("automation")) return { tipo: "SERVICO_OU_IMPLEMENTACAO", descricao: "Teste inicial com serviço de implementação." };
  if (modelos.length > 0) return { tipo: "OFERTA_PAGA", descricao: "Testar oferta paga simples." };
  return { tipo: "PRE_VENDA_VALIDACAO", descricao: "Testar oferta antes de construir." };
}

function avaliarBarreiraComercial(decisao, plano, contextoEvidencias) {
  // Simplificado para permitir monetização rápida
  const radarForca = numeroSeguro(contextoEvidencias?.radar?.forca);
  const mercadoForca = numeroSeguro(contextoEvidencias?.mercado?.forca);
  
  // Se tiver pelo menos algum sinal de mercado ou radar, permite testar
  const permitido = (radarForca >= 30 || mercadoForca >= 30);
  
  return {
    permitido,
    motivo: permitido ? "SINAL_COMERCIAL_DETECTADO" : "SEM_SINAL",
    nivel: permitido ? "TESTE_PEQUENO" : "INVESTIGAR",
    conflitos: {},
    evidencias: { radar: radarForca, mercado: mercadoForca }
  };
}

function criarExperimentoComercial(oportunidade, resultadoMercado, plano, contextoEvidencias) {
  const publico = identificarPublico(oportunidade, resultadoMercado);
  const propostaValor = criarPropostaValor(oportunidade, resultadoMercado);
  const monetizacao = definirModeloMonetizacao(oportunidade, resultadoMercado);
  
  return {
    id: `COM-${Date.now()}`,
    oportunidadeId: textoSeguro(oportunidade?.id, `OP-${Date.now()}`),
    criadoEm: new Date().toISOString(),
    status: "HIPOTESE_PRONTA",
    tipo: "OFERTA_COMERCIAL_INICIAL",
    titulo: `Teste comercial — ${textoSeguro(oportunidade?.titulo, "Oportunidade")}`,
    problema: textoSeguro(oportunidade?.hipotese, "Problema identificado."),
    publico,
    propostaValor,
    modeloMonetizacao: monetizacao,
    precoHipotese: { definido: false, valor: null, moeda: "BRL" },
    canaisSugeridos: ["conteudo_organico", "pagina_de_oferta"],
    cta: "Quero saber mais",
    objetivo: "Buscar interesse comercial e receita real.",
    evidenciasBase: {
      radar: numeroSeguro(contextoEvidencias?.radar?.forca),
      mercado: numeroSeguro(contextoEvidencias?.mercado?.forca)
    },
    proximoEstado: "PUBLICAR_TESTE",
    vendaConfirmada: false,
    receitaConfirmada: false
  };
}

function criarPacotePublicacao(experimentoComercial, oportunidade, resultadoMercado) {
  if (!experimentoComercial) return null;
  const titulo = textoSeguro(experimentoComercial.titulo, "Teste comercial");
  const publico = textoSeguro(experimentoComercial.publico, "Público identificado");
  const proposta = textoSeguro(experimentoComercial.propostaValor, "Solução para o problema.");
  const cta = textoSeguro(experimentoComercial.cta, "Quero saber mais");
  
  return {
    id: `PUB-${Date.now()}`,
    experimentoId: experimentoComercial.id,
    criadoEm: new Date().toISOString(),
    status: "PRONTO_PARA_PUBLICAR",
    publicado: false,
    slug: normalizarTexto(titulo).replace(/[^a-z0-9]+/g, "-").slice(0, 80) || `teste-${Date.now()}`,
    titulo: `Teste: ${titulo.replace(/^Teste comercial\s*—\s*/i, "")}`,
    subtitulo: `Uma proposta inicial para ${publico.toLowerCase()}.`,
    publico,
    propostaValor: proposta,
    cta,
    corpoOferta: `${proposta}\n\nProblema observado: ${textoSeguro(experimentoComercial.problema)}\n\nEsta é uma oferta inicial em validação.\n\nCTA: ${cta}`,
    mensagemDivulgacao: `${titulo}\n\n${proposta}\n\nSe isso fizer sentido para você, ${cta.toLowerCase()}.`,
    canais: Array.isArray(experimentoComercial.canaisSugeridos) ? experimentoComercial.canaisSugeridos : [],
    objetivo: experimentoComercial.objetivo,
    observacao: "Pacote preparado pelo AUTÔMATO."
  };
}

async function executarCiclo() {
  const cicloId = `CICLO-${Date.now()}`;
  
  console.log("\n========================================");
  console.log(`AUTÔMATO ${VERSAO} — ${cicloId}`);
  console.log("========================================\n");
  
  try {
    // 1. RADAR
    console.log("[1/7] Executando radar...");
    const radarBruto = await executarRadar();
    const radarResultado = normalizarResultadoRadar(radarBruto);
    const oportunidades = radarResultado.oportunidades;
    
    if (!Array.isArray(oportunidades) || oportunidades.length === 0) {
      console.log("Nenhuma oportunidade encontrada.");
      return { sucesso: false, cicloId, versao: VERSAO, erro: "NENHUMA_OPORTUNIDADE", radar: radarResultado };
    }
    
    console.log(`Radar: ${oportunidades.length} oportunidades.`);
    
    // 2. SELEÇÃO
    console.log("\n[2/7] Selecionando oportunidade...");
    let oportunidade = oportunidades[0];
    
    if (aprendizado && typeof aprendizado.selecionarOportunidade === "function") {
      const selecionada = await aprendizado.selecionarOportunidade(oportunidades);
      if (selecionada) oportunidade = selecionada;
    }
    
    console.log(`Título: ${oportunidade.titulo || "Sem título"}`);
    
    // 3. INVESTIGAÇÃO
    console.log("\n[3/7] Investigando oportunidade...");
    const resultadoInvestigacao = await executarInvestigacao(oportunidade);
    const evidenciaInvestigador = normalizarEvidenciaInvestigador(resultadoInvestigacao);
    console.log(`Investigador: ${evidenciaInvestigador.forca}/100`);
    
    // 4. MERCADO
    console.log("\n[4/7] Pesquisando mercado...");
    const resultadoMercado = await mercado.pesquisar(oportunidade);
    const evidenciaMercado = normalizarEvidenciaMercado(resultadoMercado);
    console.log(`Mercado: ${evidenciaMercado.forca}/100`);
    
    // 5. ESTRATÉGIA
    console.log("\n[5/7] Formulando estratégia...");
    const resultadoEstrategia = await estrategista.analisar(oportunidade);
    const evidenciaEstrategia = normalizarEvidenciaEstrategia(resultadoEstrategia);
    console.log(`Estratégia: ${evidenciaEstrategia.forca}/100`);
    
    // 6. EXECUÇÃO / EXPERIMENTO
    console.log("\n[6/7] Executando experimento...");
    const experimento = await executor.criarExperimento(oportunidade);
    const retornoExecutor = await executor.executar(experimento);
    const resultadoExecutor = extrairResultadoExecutor(retornoExecutor);
    
    let resultadoMetricas = {};
    if (metricas && typeof metricas.avaliar === "function") {
      resultadoMetricas = await metricas.avaliar(oportunidade, resultadoExecutor);
    }
    
    const evidenciaExecutor = normalizarEvidenciaExecutor(retornoExecutor, resultadoMetricas);
    console.log(`Executor: ${evidenciaExecutor.forca}/100`);
    
    // 7. APRENDIZADO E CONTEXTO
    console.log("\n[7/7] Consolidando aprendizado...");
    const contextoEvidencias = construirContextoEvidencias(
      oportunidade, radarResultado, resultadoMercado, resultadoInvestigacao, resultadoEstrategia, evidenciaExecutor, resultadoMetricas
    );
    
    let plano = {};
    if (aprendizado && typeof aprendizado.planejarProximoMovimento === "function") {
      plano = await aprendizado.planejarProximoMovimento(oportunidade, resultadoMetricas, contextoEvidencias);
    }
    
    const decisao = plano.acao || plano.decisao || plano.proximoPasso || "INVESTIGAR";
    console.log(`Decisão: ${decisao}`);
    
    // 8. MONETIZAÇÃO IMEDIATA (NOVO FLUXO)
    console.log("\n[8/9] Preparando monetização...");
    
    // Cria o pacote de monetização (Ebook/Template) usando o executor
    let pacoteMonetizacao = null;
    if (executor && typeof executor.criarPacoteMonetizacaoCompleto === "function") {
        pacoteMonetizacao = executor.criarPacoteMonetizacaoCompleto(oportunidade);
        console.log("✅ Pacote de Monetização Criado:");
        console.log(`   Tipo: ${pacoteMonetizacao.produto.tipo}`);
        console.log(`   Título: ${pacoteMonetizacao.produto.titulo}`);
        console.log(`   Preço Sugerido: R$ ${pacoteMonetizacao.produto.precoSugerido}`);
    } else {
        // Fallback para o método antigo se o novo não existir
        const barreiraComercial = avaliarBarreiraComercial(decisao, plano, contextoEvidencias);
        if (barreiraComercial.permitido) {
            const experimentoComercial = criarExperimentoComercial(oportunidade, resultadoMercado, plano, contextoEvidencias);
            pacoteMonetizacao = criarPacotePublicacao(experimentoComercial, oportunidade, resultadoMercado);
            console.log("✅ Experimento Comercial Criado (Legacy)");
        }
    }

    // Registro no Aprendizado
    if (aprendizado && typeof aprendizado.registrarCiclo === "function") {
      try {
        await aprendizado.registrarCiclo(oportunidade, resultadoMetricas, decisao, contextoEvidencias);
      } catch (erroRegistro) {
        console.log(`Aviso ao registrar aprendizado: ${erroRegistro.message}`);
      }
    }
    
    console.log("\n========================================");
    console.log(" CICLO CONCLUÍDO");
    console.log("========================================\n");
    
    return {
      sucesso: true,
      cicloId,
      versao: VERSAO,
      oportunidade,
      evidencias: contextoEvidencias,
      resultadoMetricas,
      plano,
      decisao,
      monetizacao: pacoteMonetizacao ? {
          criada: true,
          pacote: pacoteMonetizacao,
          produto: pacoteMonetizacao.produto,
          conteudo: pacoteMonetizacao.conteudo,
          pagina: pacoteMonetizacao.pagina,
          posts: pacoteMonetizacao.posts
      } : { criada: false }
    };
    
  } catch (erro) {
    console.error("\nERRO NO CICLO:", erro);
    return { sucesso: false, cicloId, versao: VERSAO, erro: erro.message, stack: erro.stack };
  }
}

async function executarAutonomo(numeroCiclos = 1) {
  const resultados = [];
  for (let i = 0; i < numeroCiclos; i++) {
    const resultado = await executarCiclo();
    resultados.push(resultado);
    if (!resultado.sucesso) break;
  }
  return resultados;
}

module.exports = {
  VERSAO,
  executarCiclo,
  executarAutonomo,
  executarInvestigacao,
  normalizarEvidenciaRadar,
  normalizarEvidenciaMercado,
  normalizarEvidenciaInvestigador,
  normalizarEvidenciaEstrategia,
  normalizarEvidenciaExecutor,
  construirContextoEvidencias,
  criarExperimentoComercial,
  criarPacotePublicacao,
  avaliarBarreiraComercial
};