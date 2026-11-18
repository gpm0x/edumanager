/**
 * TESTES DO VALIDADOR DE CPF
 * ==========================
 *
 * Este arquivo prova, de forma automatica, que o algoritmo de digitos
 * verificadores funciona. Ele e a demonstracao mais rapida que da para fazer na
 * apresentacao: `npm test` roda e mostra todos os casos passando.
 *
 * Os CPFs validos usados aqui sao OS MESMOS que estao em api/db.json, nos
 * cadastros de alunos e professores. Ou seja: o teste garante que todos os dados
 * de demonstracao do sistema passam pela validacao real.
 *
 * Executar com:  npm test
 */
import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { cpfValidator, limparCpf, validarDigitosVerificadores } from './cpf.validator';

/** Os 8 CPFs dos alunos cadastrados em api/db.json. */
const CPFS_ALUNOS_DB = [
  '31245287605',
  '45890712314',
  '20156349833',
  '63781204553',
  '14927058379',
  '52836491728',
  '71604923822',
  '39418562782',
];

/** Os 4 CPFs dos professores cadastrados em api/db.json. */
const CPFS_PROFESSORES_DB = ['86520317462', '47291603552', '15073842626', '68304159260'];

describe('validarDigitosVerificadores', () => {
  describe('CPFs validos (os dados reais do db.json)', () => {
    // it.each roda o MESMO teste para cada CPF da lista, sem copiar e colar codigo.
    it.each(CPFS_ALUNOS_DB)('aceita o CPF do aluno %s', (cpf) => {
      expect(validarDigitosVerificadores(cpf)).toBe(true);
    });

    it.each(CPFS_PROFESSORES_DB)('aceita o CPF do professor %s', (cpf) => {
      expect(validarDigitosVerificadores(cpf)).toBe(true);
    });

    it('aceita CPF valido digitado COM mascara', () => {
      // Mesmo CPF do primeiro aluno, agora com pontos e traco.
      expect(validarDigitosVerificadores('312.452.876-05')).toBe(true);
    });
  });

  describe('CPFs invalidos', () => {
    it('rejeita CPF com o ultimo digito verificador trocado', () => {
      // 31245287605 e valido; trocando o 2o DV de 5 para 6, tem de reprovar.
      expect(validarDigitosVerificadores('31245287606')).toBe(false);
    });

    it('rejeita CPF com o primeiro digito verificador trocado', () => {
      // O 1o DV correto e 0; aqui vai 9.
      expect(validarDigitosVerificadores('31245287695')).toBe(false);
    });

    it('rejeita CPF com digitos embaralhados', () => {
      expect(validarDigitosVerificadores('12345678901')).toBe(false);
    });
  });

  describe('sequencias repetidas (a armadilha do algoritmo)', () => {
    // Estes onze numeros PASSAM na conta dos digitos verificadores por
    // coincidencia matematica. O validador precisa barra-los a mao.
    const SEQUENCIAS = [
      '00000000000',
      '11111111111',
      '22222222222',
      '33333333333',
      '44444444444',
      '55555555555',
      '66666666666',
      '77777777777',
      '88888888888',
      '99999999999',
    ];

    it.each(SEQUENCIAS)('rejeita a sequencia repetida %s', (cpf) => {
      expect(validarDigitosVerificadores(cpf)).toBe(false);
    });
  });

  describe('tamanho e entradas vazias', () => {
    it('rejeita CPF com menos de 11 digitos', () => {
      expect(validarDigitosVerificadores('3124528760')).toBe(false);
    });

    it('rejeita CPF com mais de 11 digitos', () => {
      expect(validarDigitosVerificadores('312452876050')).toBe(false);
    });

    it('rejeita string vazia, null e undefined', () => {
      expect(validarDigitosVerificadores('')).toBe(false);
      expect(validarDigitosVerificadores(null)).toBe(false);
      expect(validarDigitosVerificadores(undefined)).toBe(false);
    });
  });
});

describe('limparCpf', () => {
  it('remove pontos, traco e espacos, mantendo somente os digitos', () => {
    expect(limparCpf(' 312.452.876-05 ')).toBe('31245287605');
  });

  it('devolve string vazia para null e undefined', () => {
    expect(limparCpf(null)).toBe('');
    expect(limparCpf(undefined)).toBe('');
  });
});

describe('cpfValidator (uso dentro do Reactive Forms)', () => {
  it('devolve null (sem erro) para CPF valido', () => {
    expect(cpfValidator(new FormControl('31245287605'))).toBeNull();
  });

  it('devolve null para campo vazio, porque vazio e assunto do Validators.required', () => {
    expect(cpfValidator(new FormControl(''))).toBeNull();
    expect(cpfValidator(new FormControl(null))).toBeNull();
  });

  it('devolve o erro cpfTamanho quando faltam digitos', () => {
    const erro = cpfValidator(new FormControl('312452876'));
    expect(erro).toEqual({ cpfTamanho: { tamanhoEsperado: 11, tamanhoRecebido: 9 } });
  });

  it('devolve o erro cpfInvalido quando os digitos verificadores nao conferem', () => {
    expect(cpfValidator(new FormControl('31245287606'))).toEqual({ cpfInvalido: true });
  });

  it('devolve o erro cpfInvalido para sequencia repetida', () => {
    expect(cpfValidator(new FormControl('11111111111'))).toEqual({ cpfInvalido: true });
  });
});
