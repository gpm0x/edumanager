/**
 * MENSAGENS DE ERRO DOS FORMULARIOS
 * =================================
 *
 * Um validador devolve um CODIGO de erro ('required', 'minlength', 'cpfInvalido'...).
 * Quem traduz esse codigo para a frase que o usuario le e este arquivo.
 *
 * POR QUE ISSO EXISTE
 * -------------------
 * Sem ele, cada <mat-error> das 9 telas teria a sua propria frase escrita a mao:
 *
 *   @if (form.controls.name.hasError('required')) { <mat-error>Informe o nome</mat-error> }
 *   @if (form.controls.name.hasError('minlength')) { <mat-error>Minimo 3 caracteres</mat-error> }
 *   @if (form.controls.name.hasError('maxlength')) { <mat-error>Maximo 80 caracteres</mat-error> }
 *
 * Isso seriam umas 150 linhas repetidas no sistema, com risco de a mesma regra
 * ganhar texto diferente em cada tela. Com esta funcao, o template fica em uma linha:
 *
 *   <mat-error>{{ mensagemDeErro(form.controls.name, 'O nome') }}</mat-error>
 *
 * REPARE que as mensagens de minimo e maximo nao tem numero fixo: elas leem o
 * requiredLength que o proprio Validators.minLength/maxLength coloca no erro.
 * Entao, se o limite mudar em LIMITES (texto.validator.ts), a frase na tela
 * muda junto, sozinha.
 */
import type { AbstractControl } from '@angular/forms';

/**
 * Devolve a mensagem do PRIMEIRO erro encontrado no campo, ou null quando o
 * campo esta valido.
 *
 * A ordem dos testes importa: do erro mais generico (campo vazio) para o mais
 * especifico (CPF com digito errado). Mostrar "CPF invalido" em um campo que o
 * usuario nem comecou a preencher confundiria mais do que ajudaria.
 *
 * @param control O campo do formulario (ex.: form.controls.name).
 * @param rotulo  Como o campo se chama na frase, ja com artigo ('O nome',
 *                'A descricao'). Serve para a mensagem sair em portugues correto.
 */
export function mensagemDeErro(
  control: AbstractControl | null | undefined,
  rotulo = 'Este campo',
): string | null {
  // Sem campo, sem erro, ou campo que o usuario ainda nao tocou: nada a dizer.
  if (!control || !control.errors) {
    return null;
  }

  const erros = control.errors;

  // --- campo obrigatorio ----------------------------------------------------
  if (erros['required']) {
    return `${rotulo} e obrigatorio.`;
  }

  // --- quantidade de caracteres (requisito academico de min/max) ------------
  // O Angular grava a chave em minusculas e guarda os numeros dentro do erro:
  //   { minlength: { requiredLength: 3, actualLength: 1 } }
  if (erros['minlength']) {
    const minimo = erros['minlength'].requiredLength as number;
    return `${rotulo} deve ter no minimo ${minimo} caracteres.`;
  }

  if (erros['maxlength']) {
    const maximo = erros['maxlength'].requiredLength as number;
    return `${rotulo} deve ter no maximo ${maximo} caracteres.`;
  }

  // --- faixa de VALOR (carga horaria, capacidade, preco) --------------------
  // Aqui o erro guarda o limite em 'min'/'max', e nao em 'requiredLength'.
  if (erros['min']) {
    const minimo = erros['min'].min as number;
    return `${rotulo} deve ser no minimo ${minimo}.`;
  }

  if (erros['max']) {
    const maximo = erros['max'].max as number;
    return `${rotulo} deve ser no maximo ${maximo}.`;
  }

  // --- formato de e-mail ----------------------------------------------------
  if (erros['email']) {
    return `${rotulo} deve ser um e-mail valido (exemplo: nome@dominio.com).`;
  }

  // --- CPF (cpf.validator.ts) -----------------------------------------------
  if (erros['cpfTamanho']) {
    const esperado = erros['cpfTamanho'].tamanhoEsperado as number;
    return `O CPF deve ter ${esperado} digitos.`;
  }

  if (erros['cpfInvalido']) {
    return 'CPF invalido: os digitos verificadores nao conferem.';
  }

  // --- datas (data.validator.ts) --------------------------------------------
  if (erros['dataFutura']) {
    return `${rotulo} nao pode ser uma data futura.`;
  }

  // --- senha (senha.validator.ts) -------------------------------------------
  if (erros['senhaFraca']) {
    return 'A senha precisa ter pelo menos uma letra e um numero.';
  }

  if (erros['senhasDiferentes']) {
    return 'As duas senhas nao sao iguais.';
  }

  // --- JA CADASTRADO (conferido na API pela tela de criar conta) -------------
  // Estes tres erros nao vem de um validador: a tela os marca no campo depois
  // de consultar a API. Entram aqui para a frase ficar no mesmo lugar que
  // todas as outras - o template nao precisa saber a diferenca.
  if (erros['emailEmUso']) {
    return 'Este e-mail ja esta cadastrado. Use outro ou entre com a conta existente.';
  }

  if (erros['cpfEmUso']) {
    return 'Este CPF ja esta cadastrado no sistema.';
  }

  if (erros['loginEmUso']) {
    return 'Este login ja esta em uso. Escolha outro.';
  }

  // Rede de seguranca: se um validador novo aparecer e ninguem cadastrar a
  // frase aqui, a tela ainda avisa que o campo esta errado, em vez de ficar
  // com o <mat-error> vazio e o usuario sem entender por que nao salva.
  return `${rotulo} esta invalido.`;
}
