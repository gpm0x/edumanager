/**
 * BARREL (arquivo de indice) dos validadores customizados.
 *
 * Reexporta tudo em um unico ponto, para que os formularios das 9 telas
 * importem sempre do mesmo lugar:
 *
 *   import { cpfValidator, textoValidators, LIMITES } from '../../core/validators';
 *
 * Mesmo padrao que o Prumo usa em core/models/index.ts.
 */

// Requisito academico 1: CPF por digitos verificadores.
export * from './cpf.validator';

// Requisito academico 2: minimo e maximo de caracteres (tabela LIMITES).
export * from './texto.validator';

// Regras de data: nascimento no passado e periodo da turma coerente.
export * from './data.validator';

// Regras de senha do autocadastro: forca minima e confirmacao.
export * from './senha.validator';

// Traducao do codigo de erro para a frase que o usuario le na tela.
// Os 9 formularios chamam mensagemDeErro() dentro do <mat-error>, entao ela
// precisa sair daqui como os outros validadores.
export * from './mensagens.validator';
