// ==========================================
// AUTÔMATO — MÉTRICAS v0.4
// MÉTRICAS DE VALIDAÇÃO DE EVIDÊNCIA
// ==========================================
//
// v0.4
// - Mantém toda a lógica da v0.3
// - Mantém compatibilidade com retorno bruto do Executor
// - Reforça normalização de diferentes formatos
// - Garante que metricas sempre exista
// - Evita erro relacionado a fonteAcessivel
// - Preserva criação, análise, exibição e cálculo de força
// ==========================================


// ==========================================
// UTILITÁRIOS
// ==========================================

function numero(valor, padrao = 0) {

    const n = Number(valor);

    return Number.isFinite(n)
        ? n
        : padrao;

}


function booleano(valor) {

    return valor === true;

}


function objeto(valor) {

    return (
        valor &&
        typeof valor === "object" &&
        !Array.isArray(valor)
    )
        ? valor
        : {};

}


// ==========================================
// NORMALIZAR EXECUTOR
// ==========================================
//
// Aceita:
//
// 1. Resultado já criado pelas métricas
//
// 2. Experimento com resultado
//
// 3. Retorno bruto do Executor
//
// 4. Estruturas equivalentes
//
// Sempre retorna um objeto com:
// {
//     experimentoId,
//     oportunidade,
//     status,
//     tipo,
//     metricas,
//     criadoEm
// }
// ==========================================

function normalizarEntrada(entrada) {

    entrada = objeto(entrada);


    // --------------------------------------
    // LOCALIZAR EXPERIMENTO
    // --------------------------------------

    const experimento = objeto(
        entrada.experimento ||
        (
            entrada.id &&
            entrada.titulo
                ? entrada
                : {}
        )
    );


    // --------------------------------------
    // LOCALIZAR RESULTADO DA EXECUÇÃO
    // --------------------------------------

    const resultadoExecutor = objeto(
        entrada.resultado ||
        entrada.execucao ||
        experimento.resultado ||
        entrada.executor ||
        {}
    );


    // --------------------------------------
    // CASO JÁ TENHA MÉTRICAS
    // --------------------------------------

    const metricasExistentes = objeto(
        entrada.metricas ||
        resultadoExecutor.metricas ||
        experimento.metricas ||
        {}
    );


    // --------------------------------------
    // SINAIS
    // --------------------------------------

    const sinais = objeto(
        entrada.sinais ||
        resultadoExecutor.sinais ||
        experimento.sinais ||
        metricasExistentes.sinais ||
        {}
    );


    // --------------------------------------
    // NORMALIZAR MÉTRICAS
    // --------------------------------------

    const dados = {

        fonteAcessivel:
            entrada.fonteAcessivel ??
            metricasExistentes.fonteAcessivel ??
            resultadoExecutor.fonteAcessivel ??
            experimento.fonteAcessivel ??
            false,

        statusHttp:
            entrada.statusHttp ??
            entrada.httpStatus ??
            metricasExistentes.statusHttp ??
            metricasExistentes.httpStatus ??
            resultadoExecutor.statusHttp ??
            resultadoExecutor.httpStatus ??
            experimento.statusHttp ??
            0,

        tempoResposta:
            entrada.tempoResposta ??
            metricasExistentes.tempoResposta ??
            resultadoExecutor.tempoResposta ??
            experimento.tempoResposta ??
            0,

        tamanhoConteudo:
            entrada.tamanhoConteudo ??
            metricasExistentes.tamanhoConteudo ??
            resultadoExecutor.tamanhoConteudo ??
            experimento.tamanhoConteudo ??
            0,

        totalSinais:
            entrada.totalSinais ??
            metricasExistentes.totalSinais ??
            resultadoExecutor.totalSinais ??
            experimento.totalSinais ??
            0,

        problema:
            entrada.problema ??
            metricasExistentes.problema ??
            sinais.problema ??
            0,

        demanda:
            entrada.demanda ??
            metricasExistentes.demanda ??
            sinais.demanda ??
            0,

        dinheiro:
            entrada.dinheiro ??
            metricasExistentes.dinheiro ??
            sinais.dinheiro ??
            0,

        crescimento:
            entrada.crescimento ??
            metricasExistentes.crescimento ??
            sinais.crescimento ??
            0,

        solucao:
            entrada.solucao ??
            metricasExistentes.solucao ??
            sinais.solucao ??
            0,

        automacao:
            entrada.automacao ??
            metricasExistentes.automacao ??
            sinais.automacao ??
            0

    };


    // --------------------------------------
    // SE JÁ EXISTE UMA ESTRUTURA DE
    // MÉTRICAS VÁLIDA, NORMALIZAR MESMO ASSIM
    // --------------------------------------

    return {

        experimentoId:
            entrada.experimentoId ??
            experimento.id ??
            resultadoExecutor.experimentoId ??
            "SEM_ID",

        oportunidade:
            entrada.oportunidade ??
            experimento.titulo ??
            experimento.oportunidade ??
            resultadoExecutor.oportunidade ??
            "SEM_OPORTUNIDADE",

        status:
            entrada.status ??
            experimento.status ??
            resultadoExecutor.status ??
            "EXECUTADO",

        tipo:
            entrada.tipo ||
            "VALIDACAO_EVIDENCIA",

        metricas: {

            fonteAcessivel:
                booleano(
                    dados.fonteAcessivel
                ),

            statusHttp:
                numero(
                    dados.statusHttp
                ),

            tempoResposta:
                numero(
                    dados.tempoResposta
                ),

            tamanhoConteudo:
                numero(
                    dados.tamanhoConteudo
                ),

            totalSinais:
                numero(
                    dados.totalSinais
                ),

            problema:
                numero(
                    dados.problema
                ),

            demanda:
                numero(
                    dados.demanda
                ),

            dinheiro:
                numero(
                    dados.dinheiro
                ),

            crescimento:
                numero(
                    dados.crescimento
                ),

            solucao:
                numero(
                    dados.solucao
                ),

            automacao:
                numero(
                    dados.automacao
                )

        },

        criadoEm:
            entrada.criadoEm ||
            new Date().toISOString()

    };

}


// ==========================================
// CRIAR RESULTADO DE COMPATIBILIDADE
// ==========================================
//
// Mantida para compatibilidade com versões
// anteriores do AUTÔMATO.
// ==========================================

function criarResultadoCompatibilidade(
    experimento = {},
    dados = {},
    execucaoOriginal = {}
) {

    experimento = objeto(experimento);
    dados = objeto(dados);
    execucaoOriginal = objeto(execucaoOriginal);


    const execucao =
        Object.keys(execucaoOriginal).length > 0
            ? execucaoOriginal
            : objeto(experimento.resultado);


    const sinais =
        objeto(
            execucao.sinais ||
            experimento.sinais
        );


    return normalizarEntrada({

        experimento,

        resultado: {

            ...execucao,

            ...dados,

            sinais

        }

    });

}


// ==========================================
// CRIAR RESULTADO
// ==========================================

function criarResultado(
    experimento,
    dados = {}
) {

    experimento = objeto(experimento);
    dados = objeto(dados);


    const execucao =
        objeto(
            experimento.resultado
        );


    const sinais =
        objeto(
            execucao.sinais
        );


    return normalizarEntrada({

        experimento,

        resultado: {

            ...execucao,

            ...dados,

            sinais

        }

    });

}


// ==========================================
// CALCULAR FORÇA DA EVIDÊNCIA
// ==========================================

function calcularForca(
    resultado
) {

    const normalizado =
        normalizarEntrada(
            resultado
        );


    const m =
        objeto(
            normalizado.metricas
        );


    let pontuacao = 0;


    // --------------------------------------
    // FONTE
    // --------------------------------------

    if (
        booleano(
            m.fonteAcessivel
        )
    ) {

        pontuacao += 15;

    }


    // --------------------------------------
    // HTTP
    // --------------------------------------

    if (
        m.statusHttp >= 200 &&
        m.statusHttp < 400
    ) {

        pontuacao += 10;

    }


    // --------------------------------------
    // CONTEÚDO
    // --------------------------------------

    if (
        m.tamanhoConteudo >= 10000
    ) {

        pontuacao += 10;

    } else if (
        m.tamanhoConteudo >= 3000
    ) {

        pontuacao += 5;

    }


    // --------------------------------------
    // PROBLEMA
    // --------------------------------------

    if (
        m.problema >= 1
    ) {

        pontuacao += 15;

    }


    // --------------------------------------
    // DEMANDA
    // --------------------------------------

    if (
        m.demanda >= 1
    ) {

        pontuacao += 15;

    }


    // --------------------------------------
    // DINHEIRO
    // --------------------------------------

    if (
        m.dinheiro >= 1
    ) {

        pontuacao += 15;

    }


    // --------------------------------------
    // SOLUÇÃO
    // --------------------------------------

    if (
        m.solucao >= 1
    ) {

        pontuacao += 5;

    }


    // --------------------------------------
    // AUTOMAÇÃO
    // --------------------------------------

    if (
        m.automacao >= 1
    ) {

        pontuacao += 5;

    }


    // --------------------------------------
    // CRESCIMENTO
    // --------------------------------------

    if (
        m.crescimento >= 1
    ) {

        pontuacao += 5;

    }


    return Math.min(
        pontuacao,
        100
    );

}


// ==========================================
// ANALISAR RESULTADO
// ==========================================

function analisarResultado(
    resultado
) {

    // --------------------------------------
    // NORMALIZAÇÃO CRÍTICA
    // --------------------------------------

    const normalizado =
        normalizarEntrada(
            resultado
        );


    // --------------------------------------
    // GARANTIA DE ESTRUTURA
    // --------------------------------------

    const m =
        objeto(
            normalizado.metricas
        );


    const forca =
        calcularForca(
            normalizado
        );


    let decisao =
        "DESCARTAR";

    let motivo =
        "";


    // ======================================
    // FONTE INDISPONÍVEL
    // ======================================

    if (
        !m.fonteAcessivel
    ) {

        decisao =
            "REPETIR";

        motivo =
            "A fonte não pôde ser validada.";

    }


    // ======================================
    // EVIDÊNCIA MUITO FRACA
    // ======================================

    else if (
        m.totalSinais < 5
    ) {

        decisao =
            "DESCARTAR";

        motivo =
            "A fonte foi acessada, mas apresentou pouca evidência.";

    }


    // ======================================
    // PROBLEMA + DEMANDA + DINHEIRO
    // ======================================

    else if (
        m.problema > 0 &&
        m.demanda > 0 &&
        m.dinheiro > 0
    ) {

        decisao =
            "CONTINUAR";

        motivo =
            "Foram encontrados sinais combinados de problema, demanda e dinheiro.";

    }


    // ======================================
    // DEMANDA + DINHEIRO
    // ======================================

    else if (
        m.demanda > 0 &&
        m.dinheiro > 0
    ) {

        decisao =
            "CONTINUAR";

        motivo =
            "Foram encontrados sinais de demanda e atividade econômica.";

    }


    // ======================================
    // PROBLEMA + DEMANDA
    // ======================================

    else if (
        m.problema > 0 &&
        m.demanda > 0
    ) {

        decisao =
            "INVESTIGAR";

        motivo =
            "Existe um problema associado a sinais de demanda, mas falta evidência financeira.";

    }


    // ======================================
    // DINHEIRO ISOLADO
    // ======================================

    else if (
        m.dinheiro > 0 &&
        m.demanda === 0 &&
        m.problema === 0
    ) {

        decisao =
            "INVESTIGAR";

        motivo =
            "Existe atividade econômica, mas ainda não há evidência suficiente de problema ou demanda.";

    }


    // ======================================
    // OUTROS
    // ======================================

    else {

        decisao =
            "INVESTIGAR";

        motivo =
            "Existem sinais públicos, mas ainda são insuficientes para validação comercial.";

    }


    return {

        ...normalizado,

        forcaEvidencia:
            forca,

        decisao,

        motivo

    };

}


// ==========================================
// EXIBIR
// ==========================================

function exibirResultado(
    resultado
) {

    const normalizado =
        normalizarEntrada(
            resultado
        );


    const final =
        normalizado.forcaEvidencia !== undefined
            ? normalizado
            : analisarResultado(
                normalizado
            );


    console.log(
        "\n================================"
    );

    console.log(
        " MÉTRICAS v0.4"
    );

    console.log(
        " VALIDAÇÃO DE EVIDÊNCIA"
    );

    console.log(
        "================================"
    );


    console.log(
        "\nExperimento:",
        final.experimentoId
    );


    console.log(
        "\nFonte acessível:",
        final.metricas.fonteAcessivel
            ? "SIM"
            : "NÃO"
    );


    console.log(
        "HTTP:",
        final.metricas.statusHttp
    );


    console.log(
        "Conteúdo:",
        final.metricas.tamanhoConteudo,
        "bytes"
    );


    console.log(
        "\nSinais:"
    );


    console.log(
        "Problema:",
        final.metricas.problema
    );


    console.log(
        "Demanda:",
        final.metricas.demanda
    );


    console.log(
        "Dinheiro:",
        final.metricas.dinheiro
    );


    console.log(
        "Crescimento:",
        final.metricas.crescimento
    );


    console.log(
        "Solução:",
        final.metricas.solucao
    );


    console.log(
        "Automação:",
        final.metricas.automacao
    );


    console.log(
        "\nTotal de sinais:",
        final.metricas.totalSinais
    );


    console.log(
        "\nFORÇA DA EVIDÊNCIA:",
        `${final.forcaEvidencia}/100`
    );


    console.log(
        "\nDECISÃO:",
        final.decisao
    );


    console.log(
        "MOTIVO:",
        final.motivo
    );

}


// ==========================================
// EXPORTAR
// ==========================================

module.exports = {

    criarResultado,

    criarResultadoCompatibilidade,

    analisarResultado,

    exibirResultado,

    calcularForca,

    normalizarEntrada

};