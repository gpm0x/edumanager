/**
 * VALIDACAO DE SENHA E DE CONFIRMACAO DE SENHA
 * ============================================
 *
 * Usado pela tela de CRIAR CONTA (features/auth/criar-conta), onde a pessoa
 * escolhe a propria senha. Nas telas internas o administrador define a senha de
 * outro usuario, e ali o limite de 6 a 20 caracteres (LIMITES.password) basta.
 *
 * POR QUE A REGRA E MAIS DURA NO AUTOCADASTRO
 * -------------------------------------------
 * Quando o administrador cadastra alguem, existe um adulto responsavel no meio
 * do caminho. No autocadastro nao existe: a pessoa escolhe sozinha, e sem
 * nenhuma exigencia a senha mais comum do mundo seria "123456" - que e
 * exatamente o que este arquivo impede.
 *
 * HONESTIDADE TECNICA (resposta se o professor perguntar)
 * -------------------------------------------------------
 * Exigir letra e numero NAO torna o sistema seguro: a senha continua sendo
 * gravada em texto puro no db.json, porque o JSON Server nao tem camada de
 * autenticacao (ver a observacao em auth.service.ts). O que esta regra faz e
 * cumprir o requisito de "senha valida" e evitar a senha obvia. Seguranca de
 * verdade seria hash no servidor (bcrypt) e politica de senha no backend.
 */
import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * VALIDADOR PROPRIO: a senha precisa ter pelo menos uma LETRA e um NUMERO.
 *
 * Nao conferimos tamanho aqui - isso e trabalho do textoValidators(LIMITES.password),
 * que roda junto. Cada validador cuida de uma coisa, e a mensagem de erro sai
 * especifica em vez de uma frase generica cobrindo tudo.
 *
 * O erro devolvido e `senhaFraca`, traduzido em mensagens.validator.ts.
 */
export const senhaForteValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const valor = control.value as string | null | undefined;

  // Campo vazio e assunto do Validators.required, nao deste validador. Sem esta
  // saida, um campo em branco mostraria "a senha precisa de letra e numero"
  // antes de a pessoa ter digitado qualquer coisa.
  if (!valor) {
    return null;
  }

  const senha = String(valor);
  const temLetra = /[a-zA-Z]/.test(senha);
  const temNumero = /[0-9]/.test(senha);

  return temLetra && temNumero ? null : { senhaFraca: true };
};

/**
 * VALIDADOR DE GRUPO: dois campos precisam ter o mesmo valor.
 *
 * Vai no FormGroup, e nao num campo, porque comparar dois campos exige ver os
 * dois - um validador de campo so conhece o proprio valor.
 *
 * O erro e marcado no campo de CONFIRMACAO (e nao no grupo) de proposito: e
 * embaixo dele que a mensagem precisa aparecer na tela. Marcar no grupo
 * obrigaria o template a ter um bloco de erro separado, longe do campo errado.
 *
 * @param campo        nome do campo original (ex.: 'password')
 * @param campoConfere nome do campo de confirmacao (ex.: 'confirmarSenha')
 */
export function confirmacaoValidator(campo: string, campoConfere: string): ValidatorFn {
  return (grupo: AbstractControl): ValidationErrors | null => {
    const original = grupo.get(campo);
    const confirmacao = grupo.get(campoConfere);

    if (!original || !confirmacao) {
      return null;
    }

    // Enquanto a confirmacao esta vazia, quem reclama e o required dela.
    if (!confirmacao.value) {
      return null;
    }

    if (original.value === confirmacao.value) {
      // Limpa SOMENTE o erro de divergencia, preservando os outros erros que o
      // campo possa ter (required, minlength). Sobrescrever com null apagaria
      // esses outros erros e o formulario ficaria valido por engano.
      const outrosErros = { ...confirmacao.errors };
      delete outrosErros['senhasDiferentes'];
      confirmacao.setErrors(Object.keys(outrosErros).length > 0 ? outrosErros : null);
      return null;
    }

    confirmacao.setErrors({ ...confirmacao.errors, senhasDiferentes: true });
    return { senhasDiferentes: true };
  };
}
