/**
 * ============================================================
 * AUTÔMATO — APRENDIZADO
 * Versão: 0.6.3
 * ============================================================
 *
 * Responsabilidade:
 * - Registrar histórico
 * - Aprender com resultados
 * - Detectar padrões
 * - Adaptar decisões
 * - Preservar ideias que já funcionaram
 * - Nunca perder fontes históricas de resultado
 * - Trabalhar com evidências consolidadas pelo AUTÔMATO
 * - Expor memória e estatísticas para o PAINEL
 * ============================================================
 */

const fs = require("fs");
const path = require("path");

const ARQUIVO_MEMORIA = path.join(__dirname, "memoria.json");


// ============================================================
// MEMÓRIA
// ============================================================

function criarMemoriaInicial() {
    return {
        versao: "0.6.3",
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),

        ciclos: 0,

        oportunidades: {},

        historico: [],

        sucessos: [],

        fracassos: [],

        descartadas: [],

        padroes: [],

        mutacoes: [],

        exploracoes: [],

        estatisticas: {
            totalOportunidades: 0,
            totalSucessos: 0,
            totalFracassos: 0,
            totalDescartadas: 0,
            totalInvestigacoes: 0,
            totalExperimentos: 0,
            totalMutacoes: 0,
            totalEscaladas: 0,
            totalMortas: 0
        }
    };
}


function carregarMemoria() {
    try {
        if (!fs.existsSync(ARQUIVO_MEMORIA)) {
            const memoria = criarMemoriaInicial();
            salvarMemoria(memoria);
            return memoria;
        }

        const conteudo = fs.readFileSync(
            ARQUIVO_MEMORIA,
            "utf8"
        );

        if (!conteudo.trim()) {
            const memoria = criarMemoriaInicial();
            salvarMemoria(memoria);
            return memoria;
        }

        const memoria = JSON.parse(conteudo);

        return {
            ...criarMemoriaInicial(),
            ...memoria,

            estatisticas: {
                ...criarMemoriaInicial().estatisticas,
                ...(memoria.estatisticas || {})
            }
        };

    } catch (erro) {
        console.error(
            "Erro ao carregar memória:",
            erro.message
        );

        const memoria = criarMemoriaInicial();

        salvarMemoria(memoria);

        return memoria;
    }
}


function salvarMemoria(memoria) {
    memoria.atualizadoEm =
        new Date().toISOString();

    fs.writeFileSync(
        ARQUIVO_MEMORIA,
        JSON.stringify(memoria, null, 2),
        "utf8"
    );
}


// ============================================================
// IDENTIDADE ESTÁVEL DA OPORTUNIDADE
// ============================================================

function gerarIdentidade(oportunidade = {}) {

    if (oportunidade.id) {
        return String(oportunidade.id);
    }

    const titulo = String(
        oportunidade.titulo ||
        oportunidade.nome ||
        oportunidade.descricao ||
        "oportunidade-sem-nome"
    )
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");

    return titulo;
}


// ============================================================
// NORMALIZAÇÃO
// ============================================================

function numero(valor, padrao = 0) {

    const n = Number(valor);

    if (!Number.isFinite(n)) {
        return padrao;
    }

    return n;
}


function limitar(
    valor,
    minimo = 0,
    maximo = 100
) {

    return Math.max(
        minimo,
        Math.min(
            maximo,
            numero(valor)
        )
    );
}


// ============================================================
// EXTRAÇÃO DE EVIDÊNCIAS
// ============================================================

function extrairEvidencias(
    oportunidade = {},
    resultado = {}
) {

    const r = resultado || {};

    const radar =
        r.radar ||
        r.oportunidadeRadar ||
        oportunidade?.radar ||
        {};

    const mercado =
        r.mercado ||
        r.pesquisaMercado ||
        r.market ||
        oportunidade?.mercado ||
        {};

    const investigador =
        r.investigacao ||
        r.investigador ||
        r.investigadorResultado ||
        {};

    const estrategia =
        r.estrategia ||
        r.estrategista ||
        r.analiseEstrategica ||
        oportunidade?.analise ||
        {};

    const executor =
        r.executor ||
        r.validacao ||
        r.resultado ||
        r;

    const radarForca = limitar(
        radar.forca ??
        radar.pontuacao ??
        radar.score ??
        radar.relevancia ??
        0
    );

    const mercadoForca = limitar(
        mercado.forca ??
        mercado.pontuacao ??
        mercado.score ??
        mercado.potencialDeTeste?.score ??
        0
    );

    const investigadorForca = limitar(
        investigador.forca ??
        investigador.pontuacao ??
        investigador.score ??
        0
    );

    const estrategiaForca = limitar(
        estrategia.forca ??
        estrategia.pontuacao ??
        estrategia.score ??
        0
    );

    let executorForca = limitar(
        executor.forca ??
        executor.pontuacao ??
        executor.score ??
        0
    );

    const executorSinais = numero(
        executor.totalSinais ??
        executor.sinais ??
        executor.quantidadeSinais ??
        0
    );

    const classificacaoExecutor = String(
        executor.classificacao ||
        executor.nivel ||
        ""
    ).toUpperCase();

    if (
        executorForca === 0 &&
        executorSinais > 0
    ) {
        executorForca = Math.min(
            100,
            executorSinais * 4
        );
    }

    if (
        classificacaoExecutor === "MUITOS_SINAIS" &&
        executorForca < 80
    ) {
        executorForca = 80;
    }

    if (
        classificacaoExecutor === "ALGUNS_SINAIS" &&
        executorForca < 50
    ) {
        executorForca = 50;
    }

    return {
        radar: {
            forca: radarForca,
            decisao: radar.decisao || null
        },

        mercado: {
            forca: mercadoForca,
            decisao: mercado.decisao || null
        },

        investigador: {
            forca: investigadorForca,

            totalSinais: numero(
                investigador.totalSinais ??
                investigador.sinais ??
                0
            ),

            decisao:
                investigador.decisao ||
                null
        },

        estrategia: {
            forca: estrategiaForca,
            decisao:
                estrategia.decisao ||
                null
        },

        executor: {
            forca: executorForca,

            totalSinais:
                executorSinais,

            classificacao:
                executor.classificacao ||
                null,

            decisao:
                executor.decisao ||
                null
        }
    };
}


// ============================================================
// PONTUAÇÃO COMPOSTA
// ============================================================

function calcularComposto(evidencias) {

    const radar =
        limitar(
            evidencias.radar?.forca
        );

    const mercado =
        limitar(
            evidencias.mercado?.forca
        );

    const investigador =
        limitar(
            evidencias.investigador?.forca
        );

    const estrategia =
        limitar(
            evidencias.estrategia?.forca
        );

    const executor =
        limitar(
            evidencias.executor?.forca
        );

    const composto =
        radar * 0.15 +
        mercado * 0.25 +
        investigador * 0.15 +
        estrategia * 0.15 +
        executor * 0.30;

    return Math.round(composto);
}


// ============================================================
// CONFLITOS
// ============================================================

function detectarConflitos(evidencias) {

    const conflitos = [];

    const radar =
        evidencias.radar?.forca || 0;

    const mercado =
        evidencias.mercado?.forca || 0;

    const investigador =
        evidencias.investigador?.forca || 0;

    const estrategia =
        evidencias.estrategia?.forca || 0;

    const executor =
        evidencias.executor?.forca || 0;

    if (
        mercado >= 70 &&
        investigador < 30
    ) {
        conflitos.push(
            "MERCADO_FORTE_INVESTIGACAO_FRACA"
        );
    }

    if (
        estrategia >= 70 &&
        executor < 30
    ) {
        conflitos.push(
            "ESTRATEGIA_FORTE_EXECUCAO_FRACA"
        );
    }

    if (
        radar >= 70 &&
        mercado < 30
    ) {
        conflitos.push(
            "RADAR_FORTE_MERCADO_FRACO"
        );
    }

    if (
        executor >= 70 &&
        mercado < 40
    ) {
        conflitos.push(
            "EXECUCAO_FORTE_MERCADO_FRACO"
        );
    }

    if (
        radar < 30 &&
        mercado < 30 &&
        investigador < 30 &&
        estrategia < 30 &&
        executor < 30
    ) {
        conflitos.push(
            "EVIDENCIA_GLOBAL_FRACA"
        );
    }

    return conflitos;
}


// ============================================================
// DECISÃO DE APRENDIZADO
// ============================================================

function decidirProximoPasso(
    oportunidade,
    resultado,
    contextoEvidencias = null
) {

    const fonteEvidencias =
        contextoEvidencias ||
        resultado ||
        {};

    const evidencias =
        extrairEvidencias(
            oportunidade,
            fonteEvidencias
        );

    const composto =
        calcularComposto(
            evidencias
        );

    const conflitos =
        detectarConflitos(
            evidencias
        );

    let acao = "OBSERVAR";

    let proximoEstado =
        "AGUARDAR";

    const investigador =
        evidencias.investigador.forca;

    const mercado =
        evidencias.mercado.forca;

    const estrategia =
        evidencias.estrategia.forca;

    const executor =
        evidencias.executor.forca;

    if (
        conflitos.includes(
            "EVIDENCIA_GLOBAL_FRACA"
        )
    ) {

        acao = "INVESTIGAR";

        proximoEstado =
            "COLETAR_MAIS_EVIDENCIAS";
    }

    else if (
        mercado >= 70 &&
        investigador < 40
    ) {

        acao = "INVESTIGAR";

        proximoEstado =
            "VALIDAR_EVIDENCIA";
    }

    else if (
        estrategia >= 70 &&
        executor < 40
    ) {

        acao = "EXPERIMENTAR";

        proximoEstado =
            "TESTAR_EXECUCAO";
    }

    else if (
        executor >= 70 &&
        mercado >= 60
    ) {

        acao = "ESCALAR";

        proximoEstado =
            "REPLICAR_RESULTADO";
    }

    else if (
        composto >= 70
    ) {

        acao = "EXPERIMENTAR";

        proximoEstado =
            "TESTAR";
    }

    else if (
        composto >= 45
    ) {

        acao = "INVESTIGAR";

        proximoEstado =
            "COLETAR_MAIS_EVIDENCIAS";
    }

    else if (
        composto < 25
    ) {

        acao = "DESCARTAR";

        proximoEstado =
            "ARQUIVAR";
    }

    return {
        acao,

        proximoEstado,

        composto,

        conflitos,

        evidencias,

        justificativa:
            gerarJustificativa(
                acao,
                proximoEstado,
                evidencias,
                composto,
                conflitos
            )
    };
}


// ============================================================
// JUSTIFICATIVA
// ============================================================

function gerarJustificativa(
    acao,
    proximoEstado,
    evidencias,
    composto,
    conflitos
) {

    const partes = [];

    partes.push(
        `Composto ${composto}/100.`
    );

    partes.push(
        `Radar ${evidencias.radar.forca}/100.`
    );

    partes.push(
        `Mercado ${evidencias.mercado.forca}/100.`
    );

    partes.push(
        `Investigador ${evidencias.investigador.forca}/100.`
    );

    partes.push(
        `Estratégia ${evidencias.estrategia.forca}/100.`
    );

    partes.push(
        `Executor ${evidencias.executor.forca}/100.`
    );

    if (
        evidencias.executor.totalSinais > 0
    ) {

        partes.push(
            `${evidencias.executor.totalSinais} sinais detectados pelo executor.`
        );
    }

    if (
        conflitos.length > 0
    ) {

        partes.push(
            `Conflitos: ${conflitos.join(", ")}.`
        );
    }

    partes.push(
        `Ação: ${acao}.`
    );

    partes.push(
        `Próximo estado: ${proximoEstado}.`
    );

    return partes.join(" ");
}


// ============================================================
// PLANEJAMENTO DO PRÓXIMO MOVIMENTO
// ============================================================

function planejarProximoMovimento(
    oportunidade,
    resultado,
    contextoEvidencias = null
) {

    return decidirProximoPasso(
        oportunidade,
        resultado,
        contextoEvidencias
    );
}


// ============================================================
// ATUALIZAÇÃO DAS ESTATÍSTICAS DERIVADAS
// ============================================================

function atualizarEstatisticas(memoria) {

    const historico =
        Array.isArray(memoria.historico)
            ? memoria.historico
            : [];

    const estatisticas =
        memoria.estatisticas ||
        {};

    /*
     * Cada ciclo atual do AUTÔMATO passa por investigação
     * e por um experimento de execução.
     */
    estatisticas.totalInvestigacoes =
        historico.length;

    estatisticas.totalExperimentos =
        historico.length;

    estatisticas.totalEscaladas =
        historico.filter(
            registro =>
                String(
                    registro?.planejamento?.acao ||
                    registro?.decisao ||
                    ""
                ).toUpperCase() === "ESCALAR"
        ).length;

    estatisticas.totalMortas =
        historico.filter(
            registro =>
                String(
                    registro?.planejamento?.acao ||
                    registro?.decisao ||
                    ""
                ).toUpperCase() === "DESCARTAR"
        ).length;

    estatisticas.totalMutacoes =
        Array.isArray(memoria.mutacoes)
            ? memoria.mutacoes.length
            : 0;

    estatisticas.totalSucessos =
        Array.isArray(memoria.sucessos)
            ? memoria.sucessos.length
            : 0;

    estatisticas.totalFracassos =
        Array.isArray(memoria.fracassos)
            ? memoria.fracassos.length
            : 0;

    estatisticas.totalDescartadas =
        Array.isArray(memoria.descartadas)
            ? memoria.descartadas.length
            : 0;

    estatisticas.totalOportunidades =
        Object.keys(
            memoria.oportunidades || {}
        ).length;

    memoria.estatisticas =
        estatisticas;

    return estatisticas;
}


// ============================================================
// REGISTRO DO CICLO
// ============================================================

function registrarCiclo(
    oportunidade,
    resultado,
    decisao = null,
    contextoEvidencias = null
) {

    const memoria =
        carregarMemoria();

    const identidade =
        gerarIdentidade(
            oportunidade
        );

    const planejamento =
        planejarProximoMovimento(
            oportunidade,
            resultado,
            contextoEvidencias
        );

    const registro = {

        ciclo:
            memoria.ciclos + 1,

        timestamp:
            new Date().toISOString(),

        oportunidade: {

            id:
                identidade,

            titulo:
                oportunidade?.titulo ||
                oportunidade?.nome ||
                identidade
        },

        resultado:
            resultado || {},

        planejamento,

        decisao:
            decisao ||
            planejamento.acao
    };

    memoria.ciclos += 1;

    memoria.historico.push(
        registro
    );

    if (
        memoria.historico.length > 1000
    ) {

        memoria.historico =
            memoria.historico.slice(-1000);
    }

    memoria.oportunidades[identidade] = {

        ...(memoria.oportunidades[identidade] || {}),

        id:
            identidade,

        titulo:
            oportunidade?.titulo ||
            oportunidade?.nome ||
            identidade,

        ultimaAtualizacao:
            new Date().toISOString(),

        ultimoPlanejamento:
            planejamento,

        ultimoResultado:
            resultado || {}
    };

    atualizarEstatisticas(
        memoria
    );

    salvarMemoria(
        memoria
    );

    return registro;
}


// ============================================================
// REGISTRAR SUCESSO
// ============================================================

function registrarSucesso(
    oportunidade,
    resultado = {}
) {

    const memoria =
        carregarMemoria();

    const identidade =
        gerarIdentidade(
            oportunidade
        );

    const registro = {

        id:
            identidade,

        titulo:
            oportunidade?.titulo ||
            oportunidade?.nome ||
            identidade,

        timestamp:
            new Date().toISOString(),

        resultado
    };

    memoria.sucessos.push(
        registro
    );

    memoria.estatisticas.totalSucessos =
        memoria.sucessos.length;

    if (
        !memoria.oportunidades[identidade]
    ) {

        memoria.oportunidades[identidade] = {

            id:
                identidade,

            titulo:
                oportunidade?.titulo ||
                oportunidade?.nome ||
                identidade
        };
    }

    memoria.oportunidades[identidade]
        .historicoSucesso =
            memoria.oportunidades[identidade]
                .historicoSucesso ||
            [];

    memoria.oportunidades[identidade]
        .historicoSucesso
        .push(registro);

    atualizarEstatisticas(
        memoria
    );

    salvarMemoria(
        memoria
    );

    return registro;
}


// ============================================================
// REGISTRAR FRACASSO
// ============================================================

function registrarFracasso(
    oportunidade,
    resultado = {}
) {

    const memoria =
        carregarMemoria();

    const identidade =
        gerarIdentidade(
            oportunidade
        );

    const registro = {

        id:
            identidade,

        titulo:
            oportunidade?.titulo ||
            oportunidade?.nome ||
            identidade,

        timestamp:
            new Date().toISOString(),

        resultado
    };

    memoria.fracassos.push(
        registro
    );

    memoria.estatisticas.totalFracassos =
        memoria.fracassos.length;

    atualizarEstatisticas(
        memoria
    );

    salvarMemoria(
        memoria
    );

    return registro;
}


// ============================================================
// REGISTRAR DESCARTE
// ============================================================

function registrarDescarte(
    oportunidade,
    motivo = null
) {

    const memoria =
        carregarMemoria();

    const identidade =
        gerarIdentidade(
            oportunidade
        );

    const registro = {

        id:
            identidade,

        titulo:
            oportunidade?.titulo ||
            oportunidade?.nome ||
            identidade,

        timestamp:
            new Date().toISOString(),

        motivo
    };

    memoria.descartadas.push(
        registro
    );

    memoria.estatisticas.totalDescartadas =
        memoria.descartadas.length;

    atualizarEstatisticas(
        memoria
    );

    salvarMemoria(
        memoria
    );

    return registro;
}


// ============================================================
// REGISTRAR MUTAÇÃO
// ============================================================

function registrarMutacao(
    oportunidade,
    mutacao
) {

    const memoria =
        carregarMemoria();

    const identidade =
        gerarIdentidade(
            oportunidade
        );

    const registro = {

        id:
            identidade,

        timestamp:
            new Date().toISOString(),

        mutacao
    };

    memoria.mutacoes.push(
        registro
    );

    memoria.estatisticas.totalMutacoes =
        memoria.mutacoes.length;

    atualizarEstatisticas(
        memoria
    );

    salvarMemoria(
        memoria
    );

    return registro;
}


// ============================================================
// REGISTRAR EXPLORAÇÃO
// ============================================================

function registrarExploracao(
    oportunidade,
    exploracao
) {

    const memoria =
        carregarMemoria();

    const identidade =
        gerarIdentidade(
            oportunidade
        );

    const registro = {

        id:
            identidade,

        timestamp:
            new Date().toISOString(),

        exploracao
    };

    memoria.exploracoes.push(
        registro
    );

    salvarMemoria(
        memoria
    );

    return registro;
}


// ============================================================
// BUSCAR HISTÓRICO
// ============================================================

function obterHistorico(
    id = null
) {

    const memoria =
        carregarMemoria();

    if (!id) {
        return memoria.historico;
    }

    return memoria.historico.filter(
        item =>
            item?.oportunidade?.id ===
            String(id)
    );
}


// ============================================================
// BUSCAR MEMÓRIA DE UMA OPORTUNIDADE
// ============================================================

function obterOportunidade(id) {

    const memoria =
        carregarMemoria();

    return (
        memoria.oportunidades[
            String(id)
        ] ||
        null
    );
}


// ============================================================
// OBTER MEMÓRIA COMPLETA
// ============================================================

function obterMemoria() {

    const memoria =
        carregarMemoria();

    atualizarEstatisticas(
        memoria
    );

    return memoria;
}


// ============================================================
// OBTER ESTATÍSTICAS
// ============================================================

function obterEstatisticas() {

    const memoria =
        carregarMemoria();

    atualizarEstatisticas(
        memoria
    );

    return {
        ...memoria.estatisticas,

        ciclos:
            memoria.ciclos,

        totalCiclos:
            memoria.ciclos,

        historico:
            memoria.historico.length,

        oportunidades:
            Object.keys(
                memoria.oportunidades || {}
            ).length
    };
}


// ============================================================
// ANALISAR PADRÕES
// ============================================================

function analisarPadroes() {

    const memoria =
        carregarMemoria();

    const resultados =
        memoria.historico || [];

    if (
        resultados.length === 0
    ) {
        return [];
    }

    const mapa = {};

    for (
        const registro of resultados
    ) {

        const acao =
            registro?.planejamento?.acao ||
            registro?.decisao ||
            "DESCONHECIDA";

        if (!mapa[acao]) {

            mapa[acao] = {

                acao,

                quantidade: 0,

                compostoMedio: 0
            };
        }

        mapa[acao].quantidade += 1;

        mapa[acao].compostoMedio +=
            numero(
                registro?.planejamento?.composto,
                0
            );
    }

    const padroes =
        Object.values(
            mapa
        ).map(item => ({

            ...item,

            compostoMedio:
                item.quantidade > 0
                    ? Math.round(
                        item.compostoMedio /
                        item.quantidade
                    )
                    : 0
        }));

    memoria.padroes =
        padroes;

    salvarMemoria(
        memoria
    );

    return padroes;
}


// ============================================================
// RESUMO DA MEMÓRIA
// ============================================================

function obterResumo() {

    const memoria =
        carregarMemoria();

    atualizarEstatisticas(
        memoria
    );

    return {

        versao:
            memoria.versao,

        ciclos:
            memoria.ciclos,

        oportunidades:
            Object.keys(
                memoria.oportunidades
            ).length,

        sucessos:
            memoria.estatisticas
                .totalSucessos,

        fracassos:
            memoria.estatisticas
                .totalFracassos,

        descartadas:
            memoria.estatisticas
                .totalDescartadas,

        investigacoes:
            memoria.estatisticas
                .totalInvestigacoes,

        experimentos:
            memoria.estatisticas
                .totalExperimentos,

        mutacoes:
            memoria.estatisticas
                .totalMutacoes,

        escaladas:
            memoria.estatisticas
                .totalEscaladas,

        mortas:
            memoria.estatisticas
                .totalMortas,

        padroes:
            memoria.padroes.length
    };
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    carregarMemoria,
    salvarMemoria,

    obterMemoria,
    obterEstatisticas,

    gerarIdentidade,

    extrairEvidencias,

    calcularComposto,

    detectarConflitos,

    decidirProximoPasso,

    planejarProximoMovimento,

    registrarCiclo,

    registrarSucesso,

    registrarFracasso,

    registrarDescarte,

    registrarMutacao,

    registrarExploracao,

    obterHistorico,

    obterOportunidade,

    analisarPadroes,

    obterResumo
};