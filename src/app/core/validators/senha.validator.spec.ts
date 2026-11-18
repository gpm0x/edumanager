/**
 * TESTES DAS REGRAS DE SENHA DO AUTOCADASTRO
 * ==========================================
 *
 * A tela de criar conta tem quatro validacoes, e duas delas moram aqui:
 *
 *   senhaForteValidator   -> a senha precisa ter letra E numero
 *   confirmacaoValidator  -> as duas senhas precisam ser iguais
 *
 * As outras duas (CPF por digitos verificadores e formato de e-mail) ja tem
 * cobertura: cpf.validator.spec.ts e o proprio Validators.email do Angular.
 *
 * POR QUE TESTAR O confirmacaoValidator COM CUIDADO
 * -------------------------------------------------
 * Ele e um validador de GRUPO que escreve erro em OUTRO campo. Esse tipo de
 * validador tem uma armadilha classica: ao limpar o proprio erro, apagar sem
 * querer os outros erros do campo (required, minlength) e deixar o formulario
 * valido por engano. Tem teste para exatamente esse caso, mais abaixo.
 *
 * Executar com:  npm test
 */
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import { confirmacaoValidator, senhaForteValidator } from './senha.validator';

describe('senhaForteValidator', () => {
  describe('aceita', () => {
    it.each(['senha123', 'abc123', 'A1b2c3', 'x9y8z7w6', 'Edu2026'])(
      'aceita "%s" (tem letra e numero)',
      (senha) => {
        expect(senhaForteValidator(new FormControl(senha))).toBeNull();
      },
    );
  });

  describe('recusa', () => {
    // '123456' e a senha mais usada do mundo, e e exatamente o caso que esta
    // regra existe para impedir no autocadastro.
    it.each(['123456', '000000', '98765432'])('recusa "%s" (so numero)', (senha) => {
      expect(senhaForteValidator(new FormControl(senha))).toEqual({ senhaFraca: true });
    });

    it.each(['senhasenha', 'abcdef', 'PASSWORD'])('recusa "%s" (so letra)', (senha) => {
      expect(senhaForteValidator(new FormControl(senha))).toEqual({ senhaFraca: true });
    });
  });

  describe('campo vazio', () => {
    // Quem reclama de campo vazio e o Validators.required. Se este validador
    // tambem reclamasse, a tela mostraria "precisa de letra e numero" antes de
    // a pessoa ter digitado qualquer coisa.
    it.each(['', null, undefined])('nao opina sobre o valor vazio %s', (vazio) => {
      expect(senhaForteValidator(new FormControl(vazio))).toBeNull();
    });
  });
});

describe('confirmacaoValidator', () => {
  const fb = new FormBuilder();

  /** Monta o par de campos como a tela de criar conta monta. */
  function grupoDeSenha(senha: string, confirmacao: string) {
    return fb.group(
      {
        password: [senha, [Validators.required, Validators.minLength(6)]],
        confirmarSenha: [confirmacao, [Validators.required]],
      },
      { validators: [confirmacaoValidator('password', 'confirmarSenha')] },
    );
  }

  it('aceita quando as duas senhas sao iguais', () => {
    const grupo = grupoDeSenha('senha123', 'senha123');

    expect(grupo.valid).toBe(true);
    expect(grupo.controls.confirmarSenha.errors).toBeNull();
  });

  it('marca o erro NO CAMPO DE CONFIRMACAO quando as senhas diferem', () => {
    const grupo = grupoDeSenha('senha123', 'senha124');

    expect(grupo.valid).toBe(false);
    // O erro tem de estar no campo, e nao so no grupo: e embaixo do campo que
    // a mensagem aparece na tela.
    expect(grupo.controls.confirmarSenha.hasError('senhasDiferentes')).toBe(true);
  });

  it('nao reclama de divergencia enquanto a confirmacao esta vazia', () => {
    const grupo = grupoDeSenha('senha123', '');

    // O campo e invalido, mas pelo required - nao por "senhas diferentes".
    expect(grupo.controls.confirmarSenha.hasError('required')).toBe(true);
    expect(grupo.controls.confirmarSenha.hasError('senhasDiferentes')).toBe(false);
  });

  it('limpa o erro de divergencia quando a pessoa corrige a senha', () => {
    const grupo = grupoDeSenha('senha123', 'senha124');
    expect(grupo.controls.confirmarSenha.hasError('senhasDiferentes')).toBe(true);

    grupo.controls.confirmarSenha.setValue('senha123');

    expect(grupo.controls.confirmarSenha.hasError('senhasDiferentes')).toBe(false);
    expect(grupo.valid).toBe(true);
  });

  it('NAO apaga os outros erros do campo ao limpar o seu', () => {
    // A armadilha: o validador de grupo faz setErrors no campo de confirmacao.
    // Se ele sobrescrevesse com null, o minlength do campo desapareceria e o
    // formulario ficaria valido com uma senha de 3 caracteres.
    const grupo = fb.group(
      {
        password: ['abc', [Validators.required, Validators.minLength(6)]],
        confirmarSenha: ['abc', [Validators.required, Validators.minLength(6)]],
      },
      { validators: [confirmacaoValidator('password', 'confirmarSenha')] },
    );

    // As duas sao iguais, entao o erro de divergencia nao existe...
    expect(grupo.controls.confirmarSenha.hasError('senhasDiferentes')).toBe(false);
    // ...mas o minlength continua valendo, e o formulario segue invalido.
    expect(grupo.controls.confirmarSenha.hasError('minlength')).toBe(true);
    expect(grupo.valid).toBe(false);
  });

  it('nao quebra quando um dos campos nao existe no grupo', () => {
    // Rede de seguranca: se alguem renomear um campo e esquecer de atualizar a
    // chamada do validador, ele devolve null em vez de derrubar o formulario.
    const grupo = fb.group(
      { password: ['senha123'] },
      { validators: [confirmacaoValidator('password', 'campoQueNaoExiste')] },
    );

    expect(grupo.valid).toBe(true);
  });
});
