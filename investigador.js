// ==========================================
// AUTÔMATO — INVESTIGADOR v0.5
// INVESTIGAÇÃO MULTIFONTE COM RELEVÂNCIA
// CONTEXTO + HIPÓTESE + SINAIS
// ==========================================

const https = require("https");
const http = require("http");

// ==========================================
// VERSÃO
// ==========================================

const VERSAO = "0.5";

// ==========================================
// FONTES
// ==========================================

const FONTES = [
    {
        nome: "TechCrunch",
        url: "https://techcrunch.com/feed/"
    },
    {
        nome: "Ars Technica",
        url: "https://feeds.arstechnica.com/arstechnica/index"
    },
    {
        nome: "The Verge",
        url: "https://www.theverge.com/rss/index.xml"
    },
    {
        nome: "Hacker News",
        url: "https://hnrss.org/frontpage"
    }
];

// ==========================================
// TERMOS GENÉRICOS
// ==========================================

const STOPWORDS = new Set([
    "about",
    "after",
    "again",
    "their",
    "there",
    "these",
    "those",
    "which",
    "while",
    "where",
    "when",
    "with",
    "from",
    "that",
    "this",
    "into",
    "over",
    "under",
    "more",
    "than",
    "have",
    "has",
    "will",
    "would",
    "could",
    "should",
    "your",
    "they",
    "them",
    "what",
    "were",
    "been",
    "being",
    "also",
    "such",
    "only",
    "using",
    "used",
    "use",
    "new",
    "news",
    "company",
    "companies",
    "startup",
    "startups",
    "technology",
    "tech",
    "software",
    "platform",
    "service",
    "market",
    "business",
    "artificial",
    "intelligence",
    "ai",
    "says",
    "said",
    "just",
    "first",
    "latest",
    "today",
    "future",
    "world",
    "people"
]);

// ==========================================
// GRUPOS DE SINAIS
// ==========================================

const GRUPOS = {

    DEMANDA: [
        "demand",
        "customer",
        "customers",
        "buyer",
        "buyers",
        "user",
        "users",
        "adoption",
        "need",
        "shortage"
    ],

    PROBLEMA: [
        "problem",
        "pain",
        "challenge",
        "difficulty",
        "cost",
        "expensive",
        "inefficient",
        "shortage",
        "lack"
    ],

    DINHEIRO: [
        "revenue",
        "sales",
        "profit",
        "pricing",
        "paid",
        "funding",
        "valuation",
        "million",
        "billion",
        "investment"
    ],

    SOLUCOES: [
        "solution",
        "product",
        "tool",
        "application",
        "app",
        "service",
        "platform"
    ],

    CONCORRENCIA: [
        "competitor",
        "competitors",
        "alternative",
        "rival",
        "competition"
    ],

    CRESCIMENTO: [
        "growth",
        "growing",
        "surge",
        "rising",
        "increase",
        "increased",
        "expanding",
        "forecast"
    ]

};

// ==========================================
// REQUISIÇÃO HTTP
// ==========================================

function requisitar(url) {

    return new Promise((resolve) => {

        const inicio = Date.now();

        const cliente =
            url.startsWith("https://")
                ? https
                : http;

        const req =
            cliente.get(
                url,
                {
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",

                        "Accept":
                            "application/rss+xml, application/xml, text/xml, text/html, */*",

                        "Accept-Language":
                            "en-US,en;q=0.9"
                    }
                },
                (res) => {

                    if (
                        res.statusCode >= 300 &&
                        res.statusCode < 400 &&
                        res.headers.location
                    ) {

                        res.resume();

                        try {

                            const novaUrl =
                                new URL(
                                    res.headers.location,
                                    url
                                ).href;

                            requisitar(
                                novaUrl
                            ).then(resolve);

                        } catch {

                            resolve({
                                sucesso: false,
                                statusCode: res.statusCode,
                                conteudo: "",
                                erro:
                                    "Redirecionamento inválido."
                            });

                        }

                        return;
                    }

                    let dados = "";

                    res.on(
                        "data",
                        chunk => {

                            if (
                                dados.length < 1500000
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

                                conteudo:
                                    dados,

                                tempo:
                                    Date.now() -
                                    inicio

                            });

                        }
                    );

                }
            );

        req.on(
            "error",
            erro => {

                resolve({

                    sucesso: false,

                    statusCode: 0,

                    conteudo: "",

                    erro:
                        erro.message

                });

            }
        );

        req.setTimeout(
            15000,
            () => {

                req.destroy();

                resolve({

                    sucesso: false,

                    statusCode: 0,

                    conteudo: "",

                    erro:
                        "Tempo limite excedido."

                });

            }
        );

    });

}

// ==========================================
// LIMPEZA
// ==========================================

function limparHTML(
    texto
) {

    return String(
        texto || ""
    )

        .replace(
            /<!\[CDATA\[([\s\S]*?)\]\]>/gi,
            "$1"
        )

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

// ==========================================
// EXTRAÇÃO XML
// ==========================================

function extrairCampo(
    bloco,
    campo
) {

    const regex =
        new RegExp(
            `<${campo}[^>]*>([\\s\\S]*?)<\\/${campo}>`,
            "i"
        );

    const resultado =
        bloco.match(
            regex
        );

    if (
        !resultado
    ) {

        return "";

    }

    return limparHTML(
        resultado[1]
    );

}

function extrairItens(
    xml
) {

    const itens = [];

    const blocos =
        String(xml || "").match(
            /<item[\s\S]*?<\/item>/gi
        ) || [];

    for (
        const bloco of blocos
    ) {

        const titulo =
            extrairCampo(
                bloco,
                "title"
            );

        const descricao =
            extrairCampo(
                bloco,
                "description"
            );

        const link =
            extrairCampo(
                bloco,
                "link"
            );

        const data =
            extrairCampo(
                bloco,
                "pubDate"
            );

        if (
            titulo
        ) {

            itens.push({

                titulo,
                descricao,
                link,
                data

            });

        }

    }

    return itens;

}

// ==========================================
// NORMALIZAÇÃO
// ==========================================

function normalizar(
    texto
) {

    return String(
        texto || ""
    )
        .toLowerCase()
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .replace(
            /[^a-z0-9\s]/g,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();

}

// ==========================================
// PALAVRAS IMPORTANTES
// ==========================================

function palavrasImportantes(
    texto
) {

    return [
        ...new Set(
            normalizar(
                texto
            )
                .split(" ")
                .filter(
                    palavra =>
                        palavra.length >= 5 &&
                        !STOPWORDS.has(
                            palavra
                        )
                )
        )
    ];

}

// ==========================================
// CONTEXTO DA OPORTUNIDADE
// ==========================================

function construirContextoInvestigacao(
    oportunidade
) {

    oportunidade =
        oportunidade || {};

    const partes = [];

    if (
        oportunidade.titulo
    ) {

        partes.push(
            oportunidade.titulo
        );

    }

    if (
        oportunidade.hipotese
    ) {

        partes.push(
            oportunidade.hipotese
        );

    }

    if (
        oportunidade.hypothesis
    ) {

        partes.push(
            oportunidade.hypothesis
        );

    }

    if (
        oportunidade.problema
    ) {

        partes.push(
            oportunidade.problema
        );

    }

    if (
        oportunidade.demanda
    ) {

        partes.push(
            oportunidade.demanda
        );

    }

    if (
        oportunidade.solucao
    ) {

        partes.push(
            oportunidade.solucao
        );

    }

    if (
        oportunidade.modelo
    ) {

        if (
            Array.isArray(
                oportunidade.modelo
            )
        ) {

            partes.push(
                oportunidade.modelo.join(" ")
            );

        } else {

            partes.push(
                oportunidade.modelo
            );

        }

    }

    const palavras =
        palavrasImportantes(
            partes.join(" ")
        );

    return {

        texto:
            partes.join(" "),

        palavras

    };

}

// ==========================================
// RELEVÂNCIA
// ==========================================

function calcularRelevancia(
    oportunidade,
    item
) {

    oportunidade =
        oportunidade || {};

    item =
        item || {};

    const contexto =
        construirContextoInvestigacao(
            oportunidade
        );

    const textoItem =
        normalizar(
            String(item.titulo || "") +
            " " +
            String(item.descricao || "")
        );

    if (
        contexto.palavras.length === 0
    ) {

        return {

            pontos: 0,

            termos: []

        };

    }

    const encontrados =
        [];

    for (
        const palavra of contexto.palavras
    ) {

        if (
            textoItem.includes(
                palavra
            )
        ) {

            encontrados.push(
                palavra
            );

        }

    }

    const termosUnicos =
        [
            ...new Set(
                encontrados
            )
        ];

    const total =
        termosUnicos.length;

    let pontos = 0;

    // ======================================
    // COINCIDÊNCIA DE CONTEXTO
    // ======================================

    if (
        total >= 1
    ) {

        pontos += 15;

    }

    if (
        total >= 2
    ) {

        pontos += 20;

    }

    if (
        total >= 3
    ) {

        pontos += 20;

    }

    if (
        total >= 4
    ) {

        pontos += 15;

    }

    // ======================================
    // TÍTULO
    // ======================================

    const palavrasTitulo =
        palavrasImportantes(
            oportunidade.titulo
        );

    const coincidenciasTitulo =
        palavrasTitulo.filter(
            palavra =>
                textoItem.includes(
                    palavra
                )
        );

    if (
        coincidenciasTitulo.length >= 1
    ) {

        pontos += 10;

    }

    if (
        coincidenciasTitulo.length >= 2
    ) {

        pontos += 10;

    }

    // ======================================
    // HIPÓTESE
    // ======================================

    const palavrasHipotese =
        palavrasImportantes(
            oportunidade.hipotese ||
            oportunidade.hypothesis ||
            ""
        );

    const coincidenciasHipotese =
        palavrasHipotese.filter(
            palavra =>
                textoItem.includes(
                    palavra
                )
        );

    if (
        coincidenciasHipotese.length >= 1
    ) {

        pontos += 5;

    }

    if (
        coincidenciasHipotese.length >= 2
    ) {

        pontos += 5;

    }

    return {

        pontos:
            Math.min(
                pontos,
                100
            ),

        termos:
            termosUnicos,

        coincidenciasTitulo:
            coincidenciasTitulo.length,

        coincidenciasHipotese:
            coincidenciasHipotese.length

    };

}

// ==========================================
// ANÁLISE DE SINAIS
// ==========================================

function contarGrupo(
    texto,
    termos
) {

    const normalizado =
        normalizar(
            texto
        );

    let total = 0;

    for (
        const termo of termos
    ) {

        if (
            normalizado.includes(
                normalizar(
                    termo
                )
            )
        ) {

            total++;

        }

    }

    return Math.min(
        total,
        10
    );

}

function analisarTexto(
    texto
) {

    return {

        demanda:
            contarGrupo(
                texto,
                GRUPOS.DEMANDA
            ),

        problema:
            contarGrupo(
                texto,
                GRUPOS.PROBLEMA
            ),

        dinheiro:
            contarGrupo(
                texto,
                GRUPOS.DINHEIRO
            ),

        solucoes:
            contarGrupo(
                texto,
                GRUPOS.SOLUCOES
            ),

        concorrencia:
            contarGrupo(
                texto,
                GRUPOS.CONCORRENCIA
            ),

        crescimento:
            contarGrupo(
                texto,
                GRUPOS.CRESCIMENTO
            )

    };

}

// ==========================================
// DOMÍNIO
// ==========================================

function dominio(
    url
) {

    try {

        return new URL(
            url
        ).hostname
            .replace(
                /^www\./,
                ""
            );

    } catch {

        return "";

    }

}

// ==========================================
// INVESTIGAÇÃO DE UMA FONTE
// ==========================================

async function investigarFonte(
    fonte,
    oportunidade
) {

    const resposta =
        await requisitar(
            fonte.url
        );

    if (
        !resposta.sucesso
    ) {

        return {

            fonte:
                fonte.nome,

            itens: [],

            erro:
                resposta.erro ||
                "Fonte indisponível."

        };

    }

    const itens =
        extrairItens(
            resposta.conteudo
        );

    const candidatos = [];

    for (
        const item of itens
    ) {

        const relevancia =
            calcularRelevancia(
                oportunidade,
                item
            );

        if (
            relevancia.pontos >= 30
        ) {

            candidatos.push({

                ...item,

                relevancia:
                    relevancia.pontos,

                termos:
                    relevancia.termos,

                coincidenciasTitulo:
                    relevancia.coincidenciasTitulo,

                coincidenciasHipotese:
                    relevancia.coincidenciasHipotese

            });

        }

    }

    candidatos.sort(
        (
            a,
            b
        ) =>
            b.relevancia -
            a.relevancia
    );

    return {

        fonte:
            fonte.nome,

        itens:
            candidatos.slice(
                0,
                10
            )

    };

}

// ==========================================
// NORMALIZAR RESULTADOS
// EVITA "resultados is not iterable"
// ==========================================

function normalizarResultados(
    resultados
) {

    if (
        Array.isArray(
            resultados
        )
    ) {

        return resultados;

    }

    if (
        resultados &&
        Array.isArray(
            resultados.resultados
        )
    ) {

        return resultados.resultados;

    }

    if (
        resultados &&
        Array.isArray(
            resultados.fontes
        )
    ) {

        return resultados.fontes;

    }

    if (
        resultados &&
        Array.isArray(
            resultados.itens
        )
    ) {

        return [
            resultados
        ];

    }

    return [];

}

// ==========================================
// CONSOLIDAÇÃO
// ==========================================

function consolidar(
    oportunidade,
    resultados
) {

    oportunidade =
        oportunidade || {};

    resultados =
        normalizarResultados(
            resultados
        );

    const sinais = {

        demanda: 0,
        problema: 0,
        dinheiro: 0,
        solucoes: 0,
        concorrencia: 0,
        crescimento: 0

    };

    const fontes =
        new Map();

    const evidencias = [];

    for (
        const resultado of resultados
    ) {

        if (
            !resultado ||
            typeof resultado !== "object"
        ) {

            continue;

        }

        const itens =
            Array.isArray(
                resultado.itens
            )
                ? resultado.itens
                : [];

        for (
            const item of itens
        ) {

            if (
                !item ||
                typeof item !== "object"
            ) {

                continue;

            }

            const texto =
                String(
                    item.titulo || ""
                ) +
                " " +
                String(
                    item.descricao || ""
                );

            const analise =
                analisarTexto(
                    texto
                );

            sinais.demanda +=
                analise.demanda;

            sinais.problema +=
                analise.problema;

            sinais.dinheiro +=
                analise.dinheiro;

            sinais.solucoes +=
                analise.solucoes;

            sinais.concorrencia +=
                analise.concorrencia;

            sinais.crescimento +=
                analise.crescimento;

            const site =
                dominio(
                    item.link
                );

            if (
                site
            ) {

                fontes.set(
                    site,
                    {

                        site,

                        fonte:
                            resultado.fonte ||
                            "Fonte desconhecida",

                        titulo:
                            item.titulo || "",

                        link:
                            item.link || "",

                        data:
                            item.data || "",

                        relevancia:
                            Number(
                                item.relevancia
                            ) || 0,

                        termos:
                            Array.isArray(
                                item.termos
                            )
                                ? item.termos
                                : []

                    }
                );

            }

            evidencias.push({

                fonte:
                    resultado.fonte ||
                    "Fonte desconhecida",

                titulo:
                    item.titulo || "",

                link:
                    item.link || "",

                relevancia:
                    Number(
                        item.relevancia
                    ) || 0,

                termos:
                    Array.isArray(
                        item.termos
                    )
                        ? item.termos
                        : [],

                sinais:
                    analise

            });

        }

    }

    // ======================================
    // TOTAL DE SINAIS
    // ======================================

    const totalSinais =
        sinais.demanda +
        sinais.problema +
        sinais.dinheiro +
        sinais.solucoes +
        sinais.concorrencia +
        sinais.crescimento;

    // ======================================
    // PONTUAÇÃO
    // ======================================

    let pontuacao = 0;

    if (
        sinais.demanda > 0
    ) {

        pontuacao += 20;

    }

    if (
        sinais.problema > 0
    ) {

        pontuacao += 20;

    }

    if (
        sinais.dinheiro > 0
    ) {

        pontuacao += 20;

    }

    if (
        sinais.solucoes > 0
    ) {

        pontuacao += 10;

    }

    if (
        sinais.concorrencia > 0
    ) {

        pontuacao += 10;

    }

    if (
        sinais.crescimento > 0
    ) {

        pontuacao += 10;

    }

    if (
        fontes.size >= 2
    ) {

        pontuacao += 5;

    }

    if (
        fontes.size >= 4
    ) {

        pontuacao += 5;

    }

    pontuacao =
        Math.min(
            pontuacao,
            100
        );

    // ======================================
    // CONFIANÇA
    // ======================================

    let confianca = 0;

    if (
        fontes.size >= 1
    ) {

        confianca += 25;

    }

    if (
        fontes.size >= 2
    ) {

        confianca += 25;

    }

    if (
        fontes.size >= 3
    ) {

        confianca += 20;

    }

    if (
        fontes.size >= 4
    ) {

        confianca += 15;

    }

    if (
        sinais.demanda > 0
    ) {

        confianca += 5;

    }

    if (
        sinais.dinheiro > 0
    ) {

        confianca += 5;

    }

    if (
        sinais.problema > 0
    ) {

        confianca += 5;

    }

    confianca =
        Math.min(
            confianca,
            100
        );

    // ======================================
    // NÍVEL
    // ======================================

    let nivel;

    if (
        confianca >= 75
    ) {

        nivel =
            "FORTE";

    }

    else if (
        confianca >= 50
    ) {

        nivel =
            "MEDIA";

    }

    else if (
        confianca >= 25
    ) {

        nivel =
            "FRACA";

    }

    else {

        nivel =
            "SEM_EVIDENCIA";

    }

    // ======================================
    // DECISÃO
    // ======================================

    let decisao;

    if (
        fontes.size >= 3 &&
        sinais.demanda > 0 &&
        sinais.dinheiro > 0 &&
        (
            sinais.problema > 0 ||
            sinais.solucoes > 0
        )
    ) {

        decisao =
            "CRIAR_EXPERIMENTO";

    }

    else if (
        fontes.size >= 2 &&
        (
            sinais.demanda > 0 ||
            sinais.dinheiro > 0
        )
    ) {

        decisao =
            "INVESTIGAR_LACUNA";

    }

    else if (
        fontes.size === 0
    ) {

        decisao =
            "REPETIR";

    }

    else {

        decisao =
            "INVESTIGAR_LACUNA";

    }

    return {

        oportunidadeId:
            oportunidade.id,

        oportunidade:
            oportunidade.titulo || "",

        fontesIndependentes:
            Array.from(
                fontes.values()
            ),

        numeroFontes:
            fontes.size,

        totalSinais,

        sinais,

        pontuacao,

        confianca,

        nivel,

        decisao,

        evidencias:
            evidencias.slice(
                0,
                30
            ),

        criadoEm:
            new Date().toISOString()

    };

}

// ==========================================
// EXIBIÇÃO
// ==========================================

function exibir(
    resultado
) {

    console.log(
        "\n================================"
    );

    console.log(
        ` INVESTIGAÇÃO PROFUNDA v${VERSAO}`
    );

    console.log(
        "================================"
    );

    console.log(
        "\nOportunidade:"
    );

    console.log(
        resultado.oportunidade
    );

    console.log(
        "\nFontes independentes:",
        resultado.numeroFontes
    );

    console.log(
        "Total de sinais:",
        resultado.totalSinais
    );

    console.log(
        "\nSINAIS:"
    );

    console.log(
        "Demanda:",
        resultado.sinais.demanda
    );

    console.log(
        "Problema:",
        resultado.sinais.problema
    );

    console.log(
        "Dinheiro:",
        resultado.sinais.dinheiro
    );

    console.log(
        "Soluções:",
        resultado.sinais.solucoes
    );

    console.log(
        "Concorrência:",
        resultado.sinais.concorrencia
    );

    console.log(
        "Crescimento:",
        resultado.sinais.crescimento
    );

    console.log(
        "\nPONTUAÇÃO:",
        `${resultado.pontuacao}/100`
    );

    console.log(
        "CONFIANÇA:",
        `${resultado.confianca}/100`
    );

    console.log(
        "NÍVEL:",
        resultado.nivel
    );

    console.log(
        "DECISÃO:",
        resultado.decisao
    );

    console.log(
        "\nFONTES REALMENTE RELACIONADAS:"
    );

    if (
        resultado.fontesIndependentes.length === 0
    ) {

        console.log(
            "Nenhuma fonte independente confirmou o tema."
        );

    }

    resultado.fontesIndependentes
        .slice(
            0,
            10
        )
        .forEach(
            (
                fonte,
                index
            ) => {

                console.log(
                    `\n${index + 1}. ${fonte.fonte} — ${fonte.site}`
                );

                console.log(
                    `   ${fonte.titulo}`
                );

                console.log(
                    `   Relevância: ${fonte.relevancia}/100`
                );

                console.log(
                    `   Termos coincidentes: ${fonte.termos.join(", ")}`
                );

                console.log(
                    `   URL: ${fonte.link}`
                );

            }
        );

}

// ==========================================
// FUNÇÃO PRINCIPAL
// ==========================================

async function investigar(
    oportunidade
) {

    console.log(
        "\n================================"
    );

    console.log(
        ` INVESTIGADOR PROFUNDO v${VERSAO}`
    );

    console.log(
        "================================"
    );

    console.log(
        "\nAlvo:"
    );

    console.log(
        oportunidade.titulo
    );

    const resultados = [];

    for (
        const fonte of FONTES
    ) {

        console.log(
            `\n[+] Consultando ${fonte.nome}...`
        );

        try {

            const resultado =
                await investigarFonte(
                    fonte,
                    oportunidade
                );

            resultados.push(
                resultado
            );

            console.log(
                `${resultado.itens.length} resultados realmente relacionados.`
            );

        } catch (
            erro
        ) {

            console.log(
                `[ERRO] ${fonte.nome}: ${erro.message}`
            );

            resultados.push({

                fonte:
                    fonte.nome,

                itens: [],

                erro:
                    erro.message

            });

        }

    }

    /*
    GARANTIA:
    Mesmo que alguma camada externa
    envie um objeto inesperado,
    consolidar() nunca recebe
    um valor não iterável.
    */

    const resultadosSeguros =
        normalizarResultados(
            resultados
        );

    const resultadoFinal =
        consolidar(
            oportunidade,
            resultadosSeguros
        );

    exibir(
        resultadoFinal
    );

    return resultadoFinal;

}

// ==========================================
// EXPORTAÇÕES
// ==========================================

module.exports = {

    VERSAO,

    investigar,

    consolidar,

    analisarTexto,

    calcularRelevancia,

    normalizarResultados

};