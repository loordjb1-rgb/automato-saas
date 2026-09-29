// ==========================================
// AUTÔMATO — ESTRATEGISTA v0.4
// ESTRATEGISTA ORIENTADO POR EVIDÊNCIAS
// ==========================================

function analisar(
    oportunidade
) {

    const sinais =
        oportunidade.sinais || {};

    const problema =
        oportunidade.problemaDetectado === true ||
        sinais.problema > 0;

    const demanda =
        oportunidade.demandaDetectada === true ||
        sinais.demanda > 0;

    const dinheiro =
        oportunidade.dinheiroDetectado === true ||
        sinais.dinheiro > 0;

    const solucao =
        oportunidade.solucaoDetectada === true ||
        sinais.solucao > 0;

    const automacao =
        oportunidade.automacaoDetectada === true ||
        sinais.automacao > 0;

    const crescimento =
        sinais.crescimento > 0;

    const concorrencia =
        sinais.concorrencia > 0;

    // ======================================
    // REGRAS
    // ======================================

    let pontuacao = 0;

    if (problema)
        pontuacao += 30;

    if (demanda)
        pontuacao += 25;

    if (dinheiro)
        pontuacao += 25;

    if (solucao)
        pontuacao += 5;

    if (automacao)
        pontuacao += 10;

    if (crescimento)
        pontuacao += 5;

    // ======================================
    // EVIDÊNCIA FORTE
    // ======================================

    if (
        demanda &&
        dinheiro
    ) {

        pontuacao += 10;

    }

    if (
        problema &&
        demanda
    ) {

        pontuacao += 10;

    }

    if (
        problema &&
        dinheiro
    ) {

        pontuacao += 10;

    }

    // ======================================
    // LIMITAR
    // ======================================

    pontuacao =
        Math.min(
            pontuacao,
            100
        );

    // ======================================
    // DESCARTAR FALSO POSITIVO
    // ======================================

    let classificacao =
        "DESCARTAR";

    let motivo =
        "";

    if (
        !problema &&
        !demanda &&
        !dinheiro
    ) {

        classificacao =
            "DESCARTAR";

        motivo =
            "Não existe evidência comercial suficiente.";

    }

    else if (
        !demanda &&
        !dinheiro
    ) {

        classificacao =
            "OBSERVAR";

        motivo =
            "Existe um problema, mas ainda não existe sinal comercial suficiente.";

    }

    else if (
        demanda &&
        dinheiro &&
        (
            problema ||
            automacao ||
            solucao
        )
    ) {

        classificacao =
            "FORTE";

        motivo =
            "Existem sinais combinados de demanda, dinheiro e possibilidade de solução.";

    }

    else if (
        demanda &&
        dinheiro
    ) {

        classificacao =
            "INVESTIGAR";

        motivo =
            "Existem sinais de demanda e dinheiro, mas falta evidência de problema específico.";

    }

    else {

        classificacao =
            "INVESTIGAR";

        motivo =
            "Existe algum sinal comercial, mas ainda faltam evidências para validação.";

    }

    // ======================================
    // HIPÓTESE
    // ======================================

    let hipotese;

    if (
        problema &&
        demanda &&
        dinheiro &&
        automacao
    ) {

        hipotese =
            "Investigar uma solução digital automatizável para um problema que apresenta sinais de demanda e dinheiro.";

    }

    else if (
        demanda &&
        dinheiro
    ) {

        hipotese =
            "Investigar se existe uma oportunidade de solução digital em torno da demanda e atividade econômica detectadas.";

    }

    else if (
        problema
    ) {

        hipotese =
            "Investigar se o problema identificado possui clientes dispostos a pagar por uma solução.";

    }

    else {

        hipotese =
            "Coletar mais evidências antes de executar qualquer solução.";

    }

    // ======================================
    // RESULTADO
    // ======================================

    return {

        ...oportunidade,

        analise: {

            problema,
            demanda,
            dinheiro,
            solucao,
            automacao,
            crescimento,
            concorrencia

        },

        pontuacaoEstrategica:
            pontuacao,

        classificacao,

        motivo,

        hipotese

    };

}

// ==========================================
// TESTE DIRETO
// ==========================================

if (
    require.main === module
) {

    console.log(
        "\n================================"
    );

    console.log(
        " ESTRATEGISTA v0.4"
    );

    console.log(
        "================================"
    );

    const teste = {

        titulo:
            "AI training data demand grows as company valuation increases",

        sinais: {

            problema: 0,
            demanda: 2,
            dinheiro: 1,
            solucao: 2,
            automacao: 1,
            crescimento: 1,
            concorrencia: 1

        },

        problemaDetectado:
            false,

        demandaDetectada:
            true,

        dinheiroDetectado:
            true,

        solucaoDetectada:
            true,

        automacaoDetectada:
            true

    };

    const resultado =
        analisar(
            teste
        );

    console.log(
        "\nPontuação:",
        resultado.pontuacaoEstrategica
    );

    console.log(
        "\nClassificação:",
        resultado.classificacao
    );

    console.log(
        "\nMotivo:",
        resultado.motivo
    );

    console.log(
        "\nHipótese:",
        resultado.hipotese
    );

}

module.exports = {
    analisar
};