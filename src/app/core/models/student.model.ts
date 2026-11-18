import { Pessoa } from './pessoa.model';

/** Valores de status aceitos para alunos (contrato de dados). */
export type StudentStatus = 'ativo' | 'inativo';

/**
 * MODEL - formato exato de um registro da colecao /students da API.
 *
 * A INTERFACE descreve o FORMATO dos dados que trafegam no HTTP (JSON puro).
 * E so um contrato de tipos: nao existe em tempo de execucao e nao tem metodos.
 *
 * Observacao sobre datas: o JSON nao tem tipo Date, entao `birthDate` e uma
 * string no padrao ISO 'aaaa-mm-dd' (ex.: '2003-04-12'), igual ao db.json.
 */
export interface Student {
  /** Gerado pelo JSON Server. Opcional porque ao CRIAR um aluno o id ainda nao existe. */
  id?: number;
  name: string;
  cpf: string;
  birthDate: string;
  email: string;
  phone: string;
  address: string;
  status: StudentStatus;
}

/**
 * MODEL - CLASSE de aluno.
 *
 * HERANCA: `extends Pessoa` reaproveita name, cpf, email e phone
 * (e os metodos getPrimeiroNome / getCpfFormatado) da classe base.
 * `implements Student` garante que a classe tenha exatamente os campos do contrato.
 *
 * Use a interface `Student` para transportar dados (services e formularios).
 * Use esta classe quando a tela precisar de COMPORTAMENTO junto com os dados
 * (os metodos herdados de Pessoa e o getIdade() daqui).
 */
export class StudentModel extends Pessoa implements Student {
  id?: number;
  birthDate: string;
  address: string;
  status: StudentStatus;

  constructor(dados: Student) {
    // super() chama o construtor da classe base Pessoa e preenche os campos comuns.
    super(dados.name, dados.cpf, dados.email, dados.phone);
    this.id = dados.id;
    this.birthDate = dados.birthDate;
    this.address = dados.address;
    this.status = dados.status;
  }

  /** Comportamento proprio do aluno: idade a partir da data de nascimento. */
  getIdade(): number {
    const nascimento = new Date(this.birthDate);
    const hoje = new Date();
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const aniversarioAindaNaoChegou =
      hoje.getMonth() < nascimento.getMonth() ||
      (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() < nascimento.getDate());
    if (aniversarioAindaNaoChegou) {
      idade--;
    }
    return idade;
  }

  /** Indica se o aluno esta ativo (util para habilitar matricula na tela). */
  estaAtivo(): boolean {
    return this.status === 'ativo';
  }
}
