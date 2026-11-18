/**
 * MODEL - formato exato de um registro da colecao /courses da API.
 *
 * `workload` = carga horaria em horas (numero).
 * `price`    = valor do curso em reais (numero).
 * `active`   = booleano; curso inativo nao aparece para abrir turma nova e nao
 *              e oferecido no autocadastro.
 *
 * O CURSO E O CATALOGO; A TURMA E A OFERTA
 * ----------------------------------------
 * O curso diz O QUE a escola ensina (nome, descricao, carga, preco). Ele nao
 * tem data nem vaga: quem tem isso e a TURMA (`Class`), que aponta para o curso
 * pelo `courseId`. Um curso pode ter varias turmas ao longo do tempo - e e por
 * isso que a matricula existe numa turma, e nao no curso.
 */
export interface Course {
  /** Gerado pelo JSON Server. Opcional porque ao CRIAR um curso o id ainda nao existe. */
  id?: number;
  name: string;
  description: string;
  workload: number;
  price: number;

  /**
   * PROFESSOR RESPONSAVEL: aponta para User.id de um usuario com role
   * 'professor'. E este campo que responde "de quem e este curso?" - e e por
   * ele que o AcessoService monta o escopo do professor.
   *
   * Opcional porque um curso pode ser cadastrado antes de a escola definir
   * quem vai ministra-lo. Curso sem responsavel simplesmente nao aparece para
   * nenhum professor.
   */
  teacherId?: number;

  /**
   * Maximo de parcelas que a escola aceita NESTE curso (regra 6.2: "as opcoes
   * deverao respeitar o valor e as condicoes configuradas para cada curso").
   *
   * A tela de matricula oferece as opcoes padrao (2, 3, 5 e 10) filtradas por
   * este teto: um curso de R$ 450 com teto 3 nao oferece 10x de R$ 45.
   *
   * Opcional por compatibilidade: curso sem o campo cai no teto padrao de
   * PARCELAS_PADRAO (ver financeiro.service.ts).
   */
  maxInstallments?: number;

  active: boolean;
}
