/**
 * BARREL (arquivo de indice) da camada Model.
 *
 * Reexporta todos os modelos em um unico ponto, para que o restante do sistema
 * importe sempre do mesmo lugar:
 *
 *   import { Student, Course, Enrollment } from '../../core/models';
 *
 * Assim, se um arquivo de model for renomeado, so este indice precisa mudar.
 */

// Classe base da heranca (POO)
export * from './pessoa.model';

// As 8 entidades do contrato de dados
export * from './user.model';
export * from './student.model';
export * from './course.model';
export * from './class.model';
export * from './enrollment.model';
export * from './financial-record.model';
export * from './payment.model';
export * from './attendance.model';
