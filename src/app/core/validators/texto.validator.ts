/**
 * VALIDACAO DE MINIMO E MAXIMO DE CARACTERES
 * ==========================================
 *
 * Segundo requisito academico do projeto. O objetivo deste arquivo e que os
 * limites de cada campo fiquem escritos em UM UNICO LUGAR (a constante LIMITES)
 * e sejam reaproveitados pelos 9 formularios do sistema.
 *
 * Por que nao escrever os numeros direto em cada formulario?
 * Porque o mesmo campo aparece em telas diferentes (`name` existe em aluno,
 * curso, turma e usuario). Com os numeros espalhados, um dia o aluno aceita
 * nome de 3 letras e o curso exige 5. Centralizando, a regra e a mesma em
 * todo o sistema e muda em um lugar so.
 */
import {
  Validators,
  type AbstractControl,
  type ValidationErrors,
  type ValidatorFn,
} from '@angular/forms';

/**
 * Formato de um limite de texto: quantos caracteres no minimo e no maximo.
 * `readonly` deixa claro que isso e regra de negocio, nao variavel de trabalho.
 */
export interface LimiteTexto {
  readonly min: number;
  readonly max: number;
}

/** Formato de um limite numerico (campos de quantidade, carga horaria, valor). */
export interface LimiteNumero {
  readonly min: number;
  readonly max?: number;
}

/**
 * TABELA OFICIAL DE LIMITES - aprovada pelo Agente-mae.
 *
 * Cada faixa tem um motivo de negocio, e nao um numero sorteado. Essa e a
 * resposta se o professor perguntar "por que 80 e nao 50?":
 *
 *   name        3-80     nome mais curto do Brasil tem 3 letras (Ana, Eva);
 *                        80 cobre nome completo com varios sobrenomes.
 *   email       ate 100  limite pratico de endereco de e-mail.
 *   phone       10-15    10 = fixo com DDD (1133334444);
 *                        15 = celular com DDD, espacos e traco.
 *   address     5-120    5 = "Rua A"; 120 cobre rua, numero, bairro e cidade.
 *   login       4-20     curto o bastante para digitar, longo o bastante para ser unico.
 *   password    6-20     6 e o minimo pedido no requisito de login.
 *   courseName  3-60     nome de curso e sempre mais curto que nome de pessoa.
 *   description 10-200   10 obriga uma frase de verdade; 200 cabe na coluna da tabela.
 *   workload    1-2000   carga horaria em horas: nenhum curso tem 0 h;
 *                        2000 h ja e um curso tecnico inteiro.
 *   classCode   3-20     codigo de turma, tipo "INFO-2026-1".
 *   capacity    1-100    turma precisa de pelo menos 1 vaga; 100 e o limite de sala.
 *   specialty   3-60     area de atuacao do professor.
 *   price       min 0    curso gratuito e permitido (preco 0), negativo nao.
 *   amount      min 0.01 parcela de pagamento nao pode ser 0 nem negativa.
 */
export const LIMITES = {
  // --- pessoas (students) e campos comuns -----------------------------------
  name: { min: 3, max: 80 } as LimiteTexto,
  email: { min: 5, max: 100 } as LimiteTexto,
  phone: { min: 10, max: 15 } as LimiteTexto,
  address: { min: 5, max: 120 } as LimiteTexto,

  // --- users ---------------------------------------------------------------
  login: { min: 4, max: 20 } as LimiteTexto,
  password: { min: 6, max: 20 } as LimiteTexto,

  // --- courses -------------------------------------------------------------
  courseName: { min: 3, max: 60 } as LimiteTexto,
  description: { min: 10, max: 200 } as LimiteTexto,
  workload: { min: 1, max: 2000 } as LimiteNumero,
  price: { min: 0 } as LimiteNumero,

  // --- classes -------------------------------------------------------------
  classCode: { min: 3, max: 20 } as LimiteTexto,
  capacity: { min: 1, max: 100 } as LimiteNumero,

  // --- payments / financeiro -----------------------------------------------
  amount: { min: 0.01 } as LimiteNumero,

  /**
   * Quantidade de parcelas de um lancamento: de 1 (a vista) a 10.
   * O teto de 10 e o maior valor oferecido pelo requisito 6.2; cada curso pode
   * baixar esse teto pelo campo Course.maxInstallments.
   */
  installments: { min: 1, max: 10 } as LimiteNumero,
} as const;

/**
 * VALIDADOR PROPRIO: texto que nao pode ser somente espacos.
 *
 * Por que ele existe? O Validators.required do Angular considera " " (um espaco)
 * como PREENCHIDO, e o Validators.minLength(3) considera "   " como 3 caracteres.
 * Ou seja: sem este validador, daria para salvar um aluno de nome "   ".
 *
 * O erro devolvido reaproveita a chave `required`, para a tela nao precisar de
 * uma mensagem diferente: para o usuario, campo com espacos e campo em branco.
 */
export const naoApenasEspacosValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const valor = control.value as string | null | undefined;

  // Campo realmente vazio ja e tratado pelo Validators.required.
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }

  return String(valor).trim().length === 0 ? { required: true } : null;
};

/**
 * MONTADOR DE VALIDADORES DE TEXTO - o atalho usado pelos 9 formularios.
 *
 * Em vez de repetir quatro validadores em cada campo de cada tela:
 *
 *   name: ['', [Validators.required, Validators.minLength(3),
 *               Validators.maxLength(80), naoApenasEspacosValidator]]
 *
 * o formulario escreve uma linha, e o limite fica visivel pelo nome:
 *
 *   name: ['', textoValidators(LIMITES.name)]
 *
 * @param limite Uma entrada da tabela LIMITES (ex.: LIMITES.name).
 */
export function textoValidators(limite: LimiteTexto): ValidatorFn[] {
  return [
    Validators.required,
    Validators.minLength(limite.min),
    Validators.maxLength(limite.max),
    naoApenasEspacosValidator,
  ];
}

/**
 * Versao para campo de texto OPCIONAL: sem required, mas com o maximo mantido.
 * Usada quando o contrato de dados permite o campo em branco.
 */
export function textoOpcionalValidators(limite: LimiteTexto): ValidatorFn[] {
  return [Validators.maxLength(limite.max)];
}

/**
 * MONTADOR DE VALIDADORES DE E-MAIL.
 *
 * O Validators.email do Angular confere o FORMATO (tem @, tem dominio).
 * O maximo de caracteres continua vindo da tabela LIMITES.
 */
export function emailValidators(): ValidatorFn[] {
  return [Validators.required, Validators.email, Validators.maxLength(LIMITES.email.max)];
}

/**
 * MONTADOR DE VALIDADORES NUMERICOS (carga horaria, capacidade, preco, valor).
 *
 * Aqui os limites sao de VALOR, nao de quantidade de caracteres: por isso usa
 * Validators.min / Validators.max, e nao minLength / maxLength. Confundir os
 * dois e um erro classico - maxLength(100) em um campo de preco limitaria o
 * numero a 100 digitos, nao a 100 reais.
 *
 * @param limite Uma entrada numerica da tabela LIMITES (ex.: LIMITES.capacity).
 */
export function numeroValidators(limite: LimiteNumero): ValidatorFn[] {
  const validadores: ValidatorFn[] = [Validators.required, Validators.min(limite.min)];

  // O maximo e opcional: preco e valor de pagamento nao tem teto.
  if (limite.max !== undefined) {
    validadores.push(Validators.max(limite.max));
  }

  return validadores;
}

/**
 * MONTADOR DE VALIDADORES DE SELECT / CAMPO OBRIGATORIO SIMPLES.
 *
 * Usado nos campos de relacionamento (courseId, studentId, classId)
 * e nos campos de enum (status, shift, role), onde o valor vem de uma lista
 * fechada e a unica regra e "escolha alguma opcao".
 */
export function selecaoValidators(): ValidatorFn[] {
  return [Validators.required];
}
