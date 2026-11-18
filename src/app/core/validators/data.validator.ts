/**
 * VALIDADORES DE DATA
 * ===================
 *
 * Duas regras de data aparecem no sistema:
 *
 *   1) data que NAO pode ser no futuro  -> birthDate do aluno
 *   2) periodo coerente (fim >= inicio) -> startDate e endDate da turma
 *
 * A segunda e um exemplo de VALIDADOR DE GRUPO: ele nao olha um campo isolado,
 * olha dois campos juntos. Por isso e aplicado no FormGroup, nao no FormControl.
 *
 * Sobre o tipo das datas: o contrato de dados guarda data como string ISO
 * 'aaaa-mm-dd', mas o datepicker do Angular Material entrega um objeto Date.
 * Os validadores abaixo aceitam os dois formatos para funcionar nos dois casos.
 */
import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Converte para Date o que vier do formulario (Date do datepicker ou string ISO).
 * Devolve null quando o valor esta vazio ou nao e uma data valida.
 */
function paraData(valor: unknown): Date | null {
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }

  const data = valor instanceof Date ? valor : new Date(String(valor));

  // getTime() de uma data invalida devolve NaN - e assim que se testa em JS.
  return Number.isNaN(data.getTime()) ? null : data;
}

/** Zera horas/minutos/segundos para comparar DIAS, e nao instantes. */
function apenasODia(data: Date): number {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate()).getTime();
}

/**
 * VALIDADOR: a data nao pode ser no futuro.
 *
 * Usado na data de nascimento do aluno - ninguem nasce amanha.
 * Hoje E permitido (por isso a comparacao e `>` e nao `>=`).
 *
 * Uso:  birthDate: [null, [Validators.required, dataNaoFuturaValidator]]
 * Erro: dataFutura
 */
export const dataNaoFuturaValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const data = paraData(control.value);

  // Vazio e assunto do Validators.required.
  if (data === null) {
    return null;
  }

  return apenasODia(data) > apenasODia(new Date()) ? { dataFutura: true } : null;
};

/**
 * VALIDADOR DE GRUPO: a data de fim tem de ser igual ou posterior a de inicio.
 *
 * Esta funcao e uma FABRICA de validador: ela recebe os nomes dos dois campos e
 * DEVOLVE o validador. Isso permite reaproveitar a mesma regra em qualquer par
 * de datas, sem amarrar o codigo aos nomes startDate/endDate.
 *
 * Uso no formulario da turma (note que vai no 2o argumento do group, que e onde
 * o Angular aceita validadores do GRUPO inteiro):
 *
 *   this.form = this.fb.group(
 *     { startDate: [null, ...], endDate: [null, ...] },
 *     { validators: periodoValidator('startDate', 'endDate') },
 *   );
 *
 *   @if (form.hasError('periodoInvalido')) {
 *     <mat-error>A data de termino deve ser igual ou posterior a de inicio.</mat-error>
 *   }
 *
 * Erro: periodoInvalido (fica no GRUPO, nao no campo)
 */
export function periodoValidator(campoInicio: string, campoFim: string): ValidatorFn {
  return (grupo: AbstractControl): ValidationErrors | null => {
    const inicio = paraData(grupo.get(campoInicio)?.value);
    const fim = paraData(grupo.get(campoFim)?.value);

    // Enquanto uma das duas datas nao foi preenchida, nao ha o que comparar.
    if (inicio === null || fim === null) {
      return null;
    }

    return apenasODia(fim) < apenasODia(inicio) ? { periodoInvalido: true } : null;
  };
}
