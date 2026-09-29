// ==========================================
// AUTÔMATO — EXECUTOR v0.5
// VALIDAÇÃO DE FONTE + REDIRECIONAMENTO
// + EXECUÇÃO ADAPTATIVA
// ==========================================

const https = require("https");
const http = require("http");

// ==========================================
// CRIAR EXPERIMENTO
// ==========================================

function criarExperimento(oportunidade) {

    return {

        id:
            `EXP-${Date.now()}`,

        oportunidadeId:
            oportunidade.id,

        titulo:
            oportunidade.titulo,

        hipotese:
            oportunidade.hipotese,

        fonte:
            oportunidade.link || "",

        objetivo:
            "Investigar sinais públicos relacionados à oportunidade.",

        modo:
            "FREE_FIRST",

        orcamento:
            0,

        tipo:
            "VALIDACAO_PUBLICA",

        status:
            "CRIADO",

        criadoEm:
            new Date().toISOString(),

        prioridade:
            0,

        geradoPor:
            "RADAR"

    };

}

// ==========================================
// ACESSAR URL E SEGUIR REDIRECIONAMENTOS
// ==========================================

function acessarFonte(url, tentativas = 0) {

    return new Promise((resolve) => {

        if (!url) {

            resolve({

                sucesso: false,

                statusCode: 0,

                tempoResposta: 0,

                tamanho: 0,

                conteudo: "",

                urlFinal: "",

                erro:
                    "A oportunidade não possui URL."

            });

            return;

        }

        if (tentativas > 5) {

            resolve({

                sucesso: false,

                statusCode: 0,

                tempoResposta: 0,

                tamanho: 0,

                conteudo: "",

                urlFinal: url,

                erro:
                    "Limite de redirecionamentos atingido."

            });

            return;

        }

        const inicio =
            Date.now();

        let cliente;

        if (
            url.startsWith("https://")
        ) {

            cliente = https;

        } else {

            cliente = http;

        }

        const requisicao =
            cliente.get(
                url,
                {
                    headers: {

                        "User-Agent":
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",

                        "Accept":
                            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

                        "Accept-Language":
                            "en-US,en;q=0.9"

                    }
                },
                (res) => {

                    // ==================================
                    // REDIRECIONAMENTO
                    // ==================================

                    if (
                        res.statusCode >= 300 &&
                        res.statusCode < 400 &&
                        res.headers.location
                    ) {

                        res.resume();

                        let novaUrl =
                            res.headers.location;

                        if (
                            novaUrl.startsWith("/")
                        ) {

                            try {

                                novaUrl =
                                    new URL(
                                        novaUrl,
                                        url
                                    ).href;

                            } catch (erro) {

                                resolve({

                                    sucesso: false,

                                    statusCode:
                                        res.statusCode,

                                    tempoResposta:
                                        Date.now() - inicio,

                                    tamanho: 0,

                                    conteudo: "",

                                    urlFinal: url,

                                    erro:
                                        "URL de redirecionamento inválida."

                                });

                                return;

                            }

                        }

                        console.log(
                            `Redirecionamento ${tentativas + 1}: ${novaUrl}`
                        );

                        acessarFonte(
                            novaUrl,
                            tentativas + 1
                        ).then(
                            (resultado) => {

                                resultado.tempoResposta =
                                    Date.now() - inicio;

                                resolve(resultado);

                            }
                        );

                        return;

                    }

                    // ==================================
                    // RECEBER CONTEÚDO
                    // ==================================

                    let dados = "";

                    res.on(
                        "data",
                        (chunk) => {

                            if (
                                dados.length < 1000000
                            ) {

                                dados +=
                                    chunk.toString();

                            }

                        }
                    );

                    res.on(
                        "end",
                        () => {

                            resolve({

                                sucesso:
                                    res.statusCode >= 200 &&
                                    res.statusCode < 400,

                                statusCode:
                                    res.statusCode,

                                tempoResposta:
                                    Date.now() - inicio,

                                tamanho:
                                    dados.length,

                                conteudo:
                                    dados,

                                urlFinal:
                                    url

                            });

                        }
                    );

                }
            );

        requisicao.on(
            "error",
            (erro) => {

                resolve({

                    sucesso: false,

                    statusCode: 0,

                    tempoResposta:
                        Date.now() - inicio,

                    tamanho: 0,

                    conteudo: "",

                    urlFinal:
                        url,

                    erro:
                        erro.message

                });

            }
        );

        requisicao.setTimeout(
            15000,
            () => {

                requisicao.destroy();

                resolve({

                    sucesso: false,

                    statusCode: 0,

                    tempoResposta:
                        Date.now() - inicio,

                    tamanho: 0,

                    conteudo: "",

                    urlFinal:
                        url,

                    erro:
                        "Tempo limite excedido."

                });

            }
        );

    });

}

// ==========================================
// LIMPAR HTML
// ==========================================

function limparHTML(html) {

    return html

        .replace(
            /<script[\s\S]*?<\/script>/gi,
            " "
        )

        .replace(
            /<style[\s\S]*?<\/style>/gi,
            " "
        )

        .replace(
            /<noscript[\s\S]*?<\/noscript>/gi,
            " "
        )

        .replace(
            /<[^>]+>/g,
            " "
        )

        .replace(
            /&nbsp;/gi,
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
            /&#39;/gi,
            "'"
        )

        .replace(
            /\s+/g,
            " "
        )

        .trim();

}

// ==========================================
// ANALISAR CONTEÚDO
// ==========================================

function analisarConteudo(
    conteudo,
    titulo
) {

    const texto =
        (
            titulo +
            " " +
            limparHTML(conteudo)
        )
        .toLowerCase();

    const sinais = {

        problema: 0,

        demanda: 0,

        dinheiro: 0,

        crescimento: 0,

        solucao: 0,

        automacao: 0

    };

    const grupos = {

        problema: [

            "problem",
            "pain point",
            "challenge",
            "difficulty",
            "need",
            "cost",
            "expensive",
            "inefficient"

        ],

        demanda: [

            "demand",
            "customers",
            "customer",
            "buyers",
            "users",
            "adoption",
            "demand for"

        ],

        dinheiro: [

            "revenue",
            "sales",
            "profit",
            "pricing",
            "paid",
            "market",
            "million",
            "billion",
            "funding"

        ],

        crescimento: [

            "growth",
            "growing",
            "surge",
            "rising",
            "increase",
            "increased",
            "expanding",
            "forecast"

        ],

        solucao: [

            "software",
            "platform",
            "app",
            "tool",
            "service",
            "solution",
            "technology"

        ],

        automacao: [

            "automation",
            "automated",
            "workflow",
            "ai",
            "artificial intelligence"

        ]

    };

    for (
        const grupo of Object.keys(grupos)
    ) {

        for (
            const palavra of grupos[grupo]
        ) {

            if (
                texto.includes(palavra)
            ) {

                sinais[grupo] += 1;

            }

        }

    }

    for (
        const grupo of Object.keys(sinais)
    ) {

        sinais[grupo] =
            Math.min(
                sinais[grupo],
                10
            );

    }

    const totalSinais =
        Object.values(
            sinais
        ).reduce(
            (total, valor) =>
                total + valor,
            0
        );

    let classificacao;

    if (
        totalSinais >= 25
    ) {

        classificacao =
            "MUITOS_SINAIS";

    } else if (
        totalSinais >= 12
    ) {

        classificacao =
            "ALGUNS_SINAIS";

    } else if (
        totalSinais >= 5
    ) {

        classificacao =
            "POUCOS_SINAIS";

    } else {

        classificacao =
            "SEM_EVIDENCIA";

    }

    return {

        sinais,

        totalSinais,

        classificacao

    };

}

// ==========================================
// MUTAR EXPERIMENTO
// ==========================================

function mutarExperimento(
    experimento,
    plano = {}
) {

    const original =
        experimento || {};

    const mutacao =
        plano.mutacao || {};

    const novoId =
        `EXP-MUT-${Date.now()}`;

    const novoExperimento = {

        ...original,

        id:
            novoId,

        experimentoPai:
            original.id || null,

        oportunidadeOriginalId:
            original.oportunidadeId || null,

        titulo:
            mutacao.titulo ||
            `${original.titulo || "Oportunidade"} — variação`,

        hipotese:
            mutacao.hipotese ||
            gerarHipoteseMutada(
                original.hipotese
            ),

        status:
            "CRIADO",

        criadoEm:
            new Date().toISOString(),

        atualizadoEm:
            new Date().toISOString(),

        tipo:
            "VALIDACAO_PUBLICA_MUTADA",

        geradoPor:
            "APRENDIZADO",

        mutacao: {

            aplicada:
                true,

            motivo:
                plano.motivo ||
                "Variação gerada pelo sistema.",

            estrategia:
                mutacao.estrategia ||
                "ALTERAR_HIPOTESE"

        },

        resultado:
            null

    };

    console.log(
        "\n[EXECUTOR] NOVA MUTACAO CRIADA"
    );

    console.log(
        "Experimento pai:",
        original.id
    );

    console.log(
        "Novo experimento:",
        novoExperimento.id
    );

    console.log(
        "Estratégia:",
        novoExperimento.mutacao.estrategia
    );

    return novoExperimento;

}

// ==========================================
// GERAR HIPÓTESE MUTADA
// ==========================================

function gerarHipoteseMutada(
    hipotese
) {

    if (!hipotese) {

        return (
            "Testar uma nova abordagem para validar a oportunidade."
        );

    }

    return (
        `${hipotese} `
        +
        "A próxima validação deve testar uma abordagem diferente baseada nos sinais observados."
    );

}

// ==========================================
// MATAR EXPERIMENTO
// ==========================================

function matarExperimento(
    experimento,
    plano = {}
) {

    if (!experimento) {

        return null;

    }

    experimento.status =
        "MORTO";

    experimento.finalizadoEm =
        new Date().toISOString();

    experimento.decisao =
        "MATAR";

    experimento.motivoEncerramento =
        plano.motivo ||
        "Experimento encerrado pelo sistema de aprendizado.";

    experimento.resultado =
        experimento.resultado || {};

    experimento.resultado.decisao =
        "MATAR";

    experimento.resultado.motivo =
        experimento.motivoEncerramento;

    console.log(
        "\n[EXECUTOR] EXPERIMENTO ENCERRADO"
    );

    console.log(
        "Experimento:",
        experimento.id
    );

    console.log(
        "Motivo:",
        experimento.motivoEncerramento
    );

    return experimento;

}

// ==========================================
// ESCALAR EXPERIMENTO
// ==========================================

function escalarExperimento(
    experimento,
    plano = {}
) {

    if (!experimento) {

        return null;

    }

    const prioridadeAtual =
        Number(
            experimento.prioridade || 0
        );

    experimento.prioridade =
        Math.min(
            prioridadeAtual + 25,
            100
        );

    experimento.status =
        "ESCALADO";

    experimento.decisao =
        "CONTINUAR";

    experimento.escaladoEm =
        new Date().toISOString();

    experimento.resultado =
        experimento.resultado || {};

    experimento.resultado.decisao =
        "ESCALAR";

    experimento.resultado.motivo =
        plano.motivo ||
        "Sinais positivos identificados pelo sistema.";

    console.log(
        "\n[EXECUTOR] EXPERIMENTO ESCALADO"
    );

    console.log(
        "Experimento:",
        experimento.id
    );

    console.log(
        "Prioridade:",
        experimento.prioridade
    );

    return experimento;

}

// ==========================================
// SOLICITAR MAIS EVIDÊNCIAS
// ==========================================

function coletarMaisEvidencias(
    experimento,
    plano = {}
) {

    if (!experimento) {

        return null;

    }

    experimento.status =
        "AGUARDANDO_EVIDENCIAS";

    experimento.decisao =
        "INVESTIGAR";

    experimento.cicloInvestigacao =
        Number(
            experimento.cicloInvestigacao || 0
        ) + 1;

    experimento.resultado =
        experimento.resultado || {};

    experimento.resultado.decisao =
        "COLETAR_MAIS_EVIDENCIAS";

    experimento.resultado.motivo =
        plano.motivo ||
        "Evidências insuficientes para uma decisão definitiva.";

    experimento.resultado.proximaAcao =
        "INVESTIGAR";

    console.log(
        "\n[EXECUTOR] MAIS EVIDENCIAS SOLICITADAS"
    );

    console.log(
        "Ciclo de investigação:",
        experimento.cicloInvestigacao
    );

    return experimento;

}

// ==========================================
// APLICAR DECISÃO DO CÉREBRO
// ==========================================

function aplicarDecisao(
    experimento,
    plano = {}
) {

    const acao =
        String(
            plano.acao ||
            plano.proximoEstado ||
            ""
        )
        .toUpperCase();

    switch (acao) {

        case "MATAR":

        case "MATAR_EXPERIMENTO":

            return {

                acao:
                    "MATAR",

                experimento:
                    matarExperimento(
                        experimento,
                        plano
                    ),

                novoExperimento:
                    null

            };

        case "MUTAR":

        case "MUTAR_EXPERIMENTO":

            return {

                acao:
                    "MUTAR",

                experimento:
                    experimento,

                novoExperimento:
                    mutarExperimento(
                        experimento,
                        plano
                    )

            };

        case "CONTINUAR":

        case "ESCALAR":

        case "ESCALAR_EXPERIMENTO":

            return {

                acao:
                    "ESCALAR",

                experimento:
                    escalarExperimento(
                        experimento,
                        plano
                    ),

                novoExperimento:
                    null

            };

        case "INVESTIGAR":

        case "COLETAR_MAIS_EVIDENCIAS":

            return {

                acao:
                    "INVESTIGAR",

                experimento:
                    coletarMaisEvidencias(
                        experimento,
                        plano
                    ),

                novoExperimento:
                    null

            };

        case "EXPLORAR":

            return {

                acao:
                    "EXPLORAR",

                experimento:
                    experimento,

                novoExperimento:
                    null,

                proximaAcao:
                    "RADAR"

            };

        default:

            return {

                acao:
                    "NENHUMA",

                experimento:
                    experimento,

                novoExperimento:
                    null

            };

    }

}

// ==========================================
// EXECUTAR EXPERIMENTO
// ==========================================

async function executar(
    experimento
) {

    console.log(
        "\n================================"
    );

    console.log(
        " EXECUTOR v0.5"
    );

    console.log(
        "================================"
    );

    console.log(
        "\nExperimento:",
        experimento.id
    );

    console.log(
        "\nOportunidade:",
        experimento.titulo
    );

    console.log(
        "\nFonte original:",
        experimento.fonte
    );

    console.log(
        "\nObjetivo:",
        experimento.objetivo
    );

    console.log(
        "\nModo:",
        experimento.modo
    );

    console.log(
        "\nOrçamento:",
        `R$ ${experimento.orcamento}`
    );

    // ======================================
    // EXPERIMENTO JÁ MORTO
    // ======================================

    if (
        experimento.status ===
        "MORTO"
    ) {

        console.log(
            "\nExperimento já encerrado. Execução ignorada."
        );

        return experimento;

    }

    // ======================================
    // ACESSAR FONTE
    // ======================================

    console.log(
        "\n[1] Acessando fonte..."
    );

    const fonte =
        await acessarFonte(
            experimento.fonte
        );

    // ======================================
    // FALHA
    // ======================================

    if (
        !fonte.sucesso
    ) {

        experimento.status =
            "FALHOU";

        experimento.resultado = {

            tipo:
                "ERRO",

            fonteAcessivel:
                false,

            statusHttp:
                fonte.statusCode,

            tempoResposta:
                fonte.tempoResposta,

            tamanhoConteudo:
                fonte.tamanho,

            urlFinal:
                fonte.urlFinal,

            erro:
                fonte.erro ||
                "Fonte indisponível."

        };

        console.log(
            "\n================================"
        );

        console.log(
            " RESULTADO"
        );

        console.log(
            "================================"
        );

        console.log(
            "\nStatus:",
            experimento.status
        );

        console.log(
            "HTTP:",
            fonte.statusCode
        );

        console.log(
            "Erro:",
            fonte.erro ||
            "Fonte indisponível."
        );

        return experimento;

    }

    // ======================================
    // FONTE ACESSÍVEL
    // ======================================

    console.log(
        "\n[2] Fonte acessível."
    );

    console.log(
        "URL final:",
        fonte.urlFinal
    );

    console.log(
        "Conteúdo recebido:",
        fonte.tamanho,
        "bytes"
    );

    // ======================================
    // ANALISAR
    // ======================================

    console.log(
        "\n[3] Analisando conteúdo público..."
    );

    const analise =
        analisarConteudo(
            fonte.conteudo,
            experimento.titulo
        );

    // ======================================
    // RESULTADO
    // ======================================

    experimento.status =
        "EXECUTADO";

    experimento.resultado = {

        tipo:
            "VALIDACAO_PUBLICA",

        fonteAcessivel:
            true,

        statusHttp:
            fonte.statusCode,

        tempoResposta:
            fonte.tempoResposta,

        tamanhoConteudo:
            fonte.tamanho,

        urlFinal:
            fonte.urlFinal,

        sinais:
            analise.sinais,

        totalSinais:
            analise.totalSinais,

        classificacao:
            analise.classificacao

    };

    // ======================================
    // EXIBIÇÃO
    // ======================================

    console.log(
        "\n================================"
    );

    console.log(
        " RESULTADO DO TESTE"
    );

    console.log(
        "================================"
    );

    console.log(
        "\nStatus:",
        experimento.status
    );

    console.log(
        "HTTP:",
        fonte.statusCode
    );

    console.log(
        "Tempo:",
        `${fonte.tempoResposta} ms`
    );

    console.log(
        "Conteúdo:",
        `${fonte.tamanho} bytes`
    );

    console.log(
        "\nURL final:"
    );

    console.log(
        fonte.urlFinal
    );

    console.log(
        "\nSinais encontrados:"
    );

    console.log(
        analise.sinais
    );

    console.log(
        "\nTotal de sinais:",
        analise.totalSinais
    );

    console.log(
        "Classificação:",
        analise.classificacao
    );

    if (
        analise.classificacao ===
        "MUITOS_SINAIS"
    ) {

        console.log(
            "\nMúltiplos sinais públicos encontrados."
        );

    } else if (
        analise.classificacao ===
        "ALGUNS_SINAIS"
    ) {

        console.log(
            "\nAlguns sinais públicos encontrados."
        );

    } else if (
        analise.classificacao ===
        "POUCOS_SINAIS"
    ) {

        console.log(
            "\nPoucos sinais públicos encontrados."
        );

    } else {

        console.log(
            "\nNenhuma evidência pública suficiente encontrada."
        );

    }

    return experimento;

}

// ==========================================
// EXPORTAÇÃO
// ==========================================

module.exports = {

    criarExperimento,

    executar,

    acessarFonte,

    analisarConteudo,

    limparHTML,

    aplicarDecisao,

    mutarExperimento,

    matarExperimento,

    escalarExperimento,

    coletarMaisEvidencias

};