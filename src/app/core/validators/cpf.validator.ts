/**
 * VALIDADOR DE CPF POR DIGITOS VERIFICADORES
 * ==========================================
 *
 * Requisito academico do projeto. Aqui NAO se usa biblioteca nenhuma:
 * o algoritmo oficial da Receita Federal esta escrito e comentado passo a passo,
 * porque e exatamente este arquivo que responde a pergunta
 * "como voces validam o CPF?" na apresentacao.
 *
 * COMO O CPF E FORMADO
 * --------------------
 * O CPF tem 11 digitos: os 9 primeiros sao o numero em si e os 2 ultimos sao
 * DIGITOS VERIFICADORES - dois digitos CALCULADOS a partir dos anteriores.
 * Validar o CPF e, portanto, refazer essa conta e comparar o resultado com os
 * dois digitos que o usuario digitou. Se bater, o CPF e bem formado.
 *
 *   3 1 2 4 5 2 8 7 6   0 5
 *   \_______________/   \_/
 *     9 digitos base     2 digitos verificadores
 *
 * ATENCAO: este calculo diz se o numero e MATEMATICAMENTE VALIDO, nao se ele
 * existe de verdade na Receita Federal (isso exigiria consultar a Receita,
 * o que esta fora do escopo do trabalho).
 *
 * `import type` abaixo importa apenas TIPOS do Angular. Tipo nao existe em tempo
 * de execucao, entao esse import desaparece quando o TypeScript compila: este
 * arquivo vira JavaScript puro, sem nenhuma dependencia do Angular.
 */
import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Quantidade de digitos de um CPF. */
export const TAMANHO_CPF = 11;

/**
 * PASSO 0 - LIMPAR A ENTRADA.
 *
 * O usuario pode digitar "312.452.876-05" com pontos e traco, mas o calculo
 * precisa dos digitos crus. A expressao regular /\D/g significa
 * "todo caractere que NAO e digito", e o replace troca tudo isso por nada.
 *
 * Pelo contrato de dados, o CPF e GRAVADO assim, com 11 digitos puros.
 * A mascara 000.000.000-00 existe somente na EXIBICAO (metodo getCpfFormatado()
 * da classe Pessoa, em core/models/pessoa.model.ts).
 */
export function limparCpf(valor: string | null | undefined): string {
  return (valor ?? '').replace(/\D/g, '');
}

/**
 * O CALCULO DE UM DIGITO VERIFICADOR.
 *
 * Os dois digitos usam a MESMA conta, mudando so dois detalhes. Por isso a
 * funcao e escrita uma vez e chamada duas vezes (evita duplicacao de codigo,
 * que e uma das regras do projeto).
 *
 * A conta, em quatro etapas:
 *
 *   1) Multiplicar cada digito por um PESO. O peso comeca em `pesoInicial` e
 *      DIMINUI de 1 em 1 a cada digito, da esquerda para a direita.
 *   2) Somar todos esses produtos.
 *   3) resto = (soma * 10) % 11      <- formula oficial da Receita Federal
 *   4) Se o resto der 10 ou 11, o digito e 0. Senao, o digito E o resto.
 *
 * @param digitos     Os digitos que entram na conta (9 para o 1o DV, 10 para o 2o DV).
 * @param pesoInicial O peso do primeiro digito (10 para o 1o DV, 11 para o 2o DV).
 * @returns           O digito verificador esperado, de 0 a 9.
 */
function calcularDigitoVerificador(digitos: string, pesoInicial: number): number {
  let soma = 0;

  // ETAPAS 1 e 2: multiplicar cada digito pelo seu peso e ir somando.
  // Na primeira volta i = 0, entao o peso e o proprio `pesoInicial`;
  // na segunda i = 1 e o peso cai 1; e assim por diante, ate o peso 2.
  for (let i = 0; i < digitos.length; i++) {
    const digito = Number(digitos[i]);
    const peso = pesoInicial - i;
    soma += digito * peso;
  }

  // ETAPA 3: a formula oficial. O operador % devolve o RESTO da divisao.
  const resto = (soma * 10) % 11;

  // ETAPA 4: resto 10 ou 11 nao caberia em um digito (que vai de 0 a 9),
  // e a regra da Receita manda tratar esse caso como 0.
  return resto >= 10 ? 0 : resto;
}

/**
 * VALIDACAO COMPLETA DO CPF - funcao pura, sem Angular.
 *
 * "Pura" quer dizer que ela so depende do que recebe e so devolve true/false:
 * nao mexe na tela, nao chama a API e nao guarda estado. Por isso e facil de
 * testar (ver cpf.validator.spec.ts) e facil de demonstrar ao professor.
 *
 * EXEMPLO COMPLETO com o CPF 312.452.876-05, que esta no db.json:
 *
 *   1o DIGITO - base 312452876, pesos 10 9 8 7 6 5 4 3 2
 *     3*10 + 1*9 + 2*8 + 4*7 + 5*6 + 2*5 + 8*4 + 7*3 + 6*2
 *      30  +  9  + 16  + 28  + 30  + 10  + 32  + 21  + 12   = 188
 *     resto = (188 * 10) % 11 = 1880 % 11 = 10  ->  10 e >= 10, logo o digito e 0
 *     O 10o digito digitado e 0. CONFERE.
 *
 *   2o DIGITO - base 3124528760 (agora o 1o DV entra na conta),
 *               pesos 11 10 9 8 7 6 5 4 3 2
 *     3*11 + 1*10 + 2*9 + 4*8 + 5*7 + 2*6 + 8*5 + 7*4 + 6*3 + 0*2
 *      33  +  10  + 18  + 32  + 35  + 12  + 40  + 28  + 18  +  0   = 226
 *     resto = (226 * 10) % 11 = 2260 % 11 = 5  ->  o digito e 5
 *     O 11o digito digitado e 5. CONFERE.
 *
 *   Os dois conferem: 31245287605 e um CPF valido.
 *
 * @param cpf CPF com ou sem mascara.
 * @returns   true quando os dois digitos verificadores conferem.
 */
export function validarDigitosVerificadores(cpf: string | null | undefined): boolean {
  const digitos = limparCpf(cpf);

  // REGRA 1 - tamanho. Sem 11 digitos nao da nem para comecar a conta.
  if (digitos.length !== TAMANHO_CPF) {
    return false;
  }

  // REGRA 2 - sequencias repetidas (00000000000, 11111111111, ..., 99999999999).
  // Esses onze numeros PASSAM na conta dos digitos verificadores por coincidencia
  // matematica, mas nao sao CPFs reais. Por isso precisam ser barrados a mao -
  // e um ponto que o professor costuma cobrar.
  // A regex /^(\d)\1{10}$/ le-se: "um digito qualquer (\d), capturado no grupo 1,
  // seguido desse MESMO digito (\1) repetido 10 vezes, do inicio (^) ao fim ($)".
  if (/^(\d)\1{10}$/.test(digitos)) {
    return false;
  }

  // REGRA 3 - primeiro digito verificador.
  // substring(0, 9) pega os 9 digitos da base; o peso comeca em 10.
  const primeiroDigitoEsperado = calcularDigitoVerificador(digitos.substring(0, 9), 10);
  const primeiroDigitoDigitado = Number(digitos[9]); // 10a posicao (indice 9)
  if (primeiroDigitoEsperado !== primeiroDigitoDigitado) {
    return false;
  }

  // REGRA 4 - segundo digito verificador.
  // Agora a base tem 10 digitos (inclui o 1o DV, ja validado) e o peso comeca em 11.
  const segundoDigitoEsperado = calcularDigitoVerificador(digitos.substring(0, 10), 11);
  const segundoDigitoDigitado = Number(digitos[10]); // 11a posicao (indice 10)

  return segundoDigitoEsperado === segundoDigitoDigitado;
}

/**
 * VALIDADOR DE FORMULARIO (Reactive Forms).
 *
 * Esta e a ponte entre a funcao pura acima e o Angular. Um ValidatorFn recebe o
 * controle do formulario e devolve:
 *   - null             quando esta tudo certo;
 *   - um objeto de erro quando esta errado.
 *
 * A CHAVE desse objeto e o nome do erro que o template consulta para decidir
 * qual <mat-error> mostrar:
 *
 *   cpf: ['', [Validators.required, cpfValidator]]
 *
 *   @if (form.controls.cpf.hasError('cpfInvalido')) {
 *     <mat-error>CPF invalido. Confira os numeros digitados.</mat-error>
 *   }
 *
 * O campo VAZIO devolve null de proposito: "vazio" e assunto do
 * Validators.required, nao deste validador. Cada validador cuida de uma unica
 * regra, para que a mensagem de erro na tela seja sempre a mais especifica.
 */
export const cpfValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const valor = control.value as string | null | undefined;

  // Campo em branco: deixa o required falar.
  if (valor === null || valor === undefined || String(valor).trim() === '') {
    return null;
  }

  const digitos = limparCpf(valor);

  // Erro especifico de quantidade, para a tela poder dizer "o CPF deve ter 11 digitos"
  // em vez de simplesmente "CPF invalido" enquanto o usuario ainda esta digitando.
  if (digitos.length !== TAMANHO_CPF) {
    return { cpfTamanho: { tamanhoEsperado: TAMANHO_CPF, tamanhoRecebido: digitos.length } };
  }

  // Erro de digito verificador (ou de sequencia repetida).
  return validarDigitosVerificadores(digitos) ? null : { cpfInvalido: true };
};
