// ==========================================
// AUTÔMATO — PESQUISADOR v0.1
// ==========================================

function criarOportunidade(titulo, descricao, fonte, potencial = 0) {
    return {
        id: `OP-${Date.now()}`,
        titulo,
        descricao,
        fonte,
        potencial,
        status: "NOVA",
        criadaEm: new Date().toISOString()
    };
}

function analisarOportunidade(oportunidade) {

    let classificacao = "BAIXO";

    if (oportunidade.potencial >= 80) {
        classificacao = "ALTO";
    } else if (oportunidade.potencial >= 50) {
        classificacao = "MÉDIO";
    }

    return {
        ...oportunidade,
        classificacao
    };
}


// ==========================================
// TESTE DO PESQUISADOR
// ==========================================

console.log("\n================================");
console.log(" PESQUISADOR DO AUTÔMATO v0.1");
console.log("================================");

const oportunidade = criarOportunidade(
    "Exemplo de oportunidade",
    "O Autômato encontrou uma possibilidade que precisa ser testada.",
    "TESTE",
    85
);

const analisada = analisarOportunidade(oportunidade);

console.log("\nOportunidade encontrada:");
console.log(analisada);

module.exports = {
    criarOportunidade,
    analisarOportunidade
};