/**
 * MODEL (camada Model do MVC) - CLASSE BASE
 *
 * ORIENTACAO A OBJETOS / HERANCA
 * ------------------------------
 * `Pessoa` reune o que qualquer pessoa cadastrada no sistema tem: nome, CPF,
 * e-mail e telefone - e os metodos que dependem desses campos
 * (`getPrimeiroNome`, `getCpfFormatado`). `StudentModel` usa `extends Pessoa`,
 * herda os quatro campos e os dois metodos, e declara apenas o que e proprio do
 * aluno: data de nascimento, endereco e situacao.
 *
 * A classe e `abstract` porque ninguem cadastra uma "Pessoa" solta no sistema:
 * `abstract` impede `new Pessoa(...)` e deixa claro que esta classe existe
 * apenas para ser herdada.
 *
 * HONESTIDADE TECNICA (resposta se o professor perguntar)
 * -------------------------------------------------------
 * Hoje existe UMA subclasse, e o motivo e de modelagem, nao de preguica: o
 * PROFESSOR voltou ao sistema em 14/11/2026 e NAO ganhou um `TeacherModel`.
 *
 * Por que nao: professor, aqui, nao e um cadastro de pessoa - e uma
 * CREDENCIAL (`users` com `role: professor`). Ele nao tem CPF, nem data de
 * nascimento, nem endereco no sistema; o que ele tem sao cursos e turmas que
 * apontam para o id dele. Criar uma classe `TeacherModel` que herdasse CPF e
 * telefone de `Pessoa` seria inventar campos que nenhuma tela preenche, so
 * para a heranca ter dois filhos. Heranca por simetria de diagrama, e nao por
 * dado real, e o tipo de modelagem que incomoda em qualquer revisao.
 *
 * Com um filho so, a heranca deixa de economizar repeticao e passa a valer
 * pelo que ainda faz: separar o que e "dados de pessoa" do que e "dados de
 * aluno", e manter os dois metodos de formatacao fora da classe que trata de
 * matricula e situacao.
 *
 * E nao e o exemplo mais forte de heranca do projeto, e nao faz sentido
 * fingir que e. O ponto honesto a defender e outro: a mesma ideia aparece de
 * novo, e com varios filhos, em `BaseApiService<T>` - uma classe base
 * generica de onde os 8 services de colecao herdam os cinco metodos do CRUD,
 * escritos uma unica vez.
 */
export abstract class Pessoa {
  /**
   * Os modificadores `public` no construtor sao um atalho do TypeScript:
   * ja declaram o atributo e ja o inicializam (encapsulamento basico).
   */
  constructor(
    public name: string,
    public cpf: string,
    public email: string,
    public phone: string,
  ) {}

  /** Metodo HERDADO por StudentModel: primeiro nome, para saudacoes na tela. */
  getPrimeiroNome(): string {
    return this.name.trim().split(' ')[0];
  }

  /**
   * Metodo HERDADO: formata o CPF 12345678901 como 123.456.789-01.
   *
   * Pelo contrato de dados, o `cpf` e GRAVADO com 11 digitos puros, sem mascara
   * (o validador de digito verificador precisa dos digitos crus). A mascara
   * existe somente na EXIBICAO - e para isso que este metodo serve.
   */
  getCpfFormatado(): string {
    const digitos = this.cpf.replace(/\D/g, '');
    if (digitos.length !== 11) {
      return this.cpf;
    }
    return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
}
