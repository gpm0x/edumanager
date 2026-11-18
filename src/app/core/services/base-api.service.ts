import { inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_URL } from './api.config';

/**
 * SERVICE BASE - o CRUD que todas as 8 colecoes tem em comum.
 *
 * ORIENTACAO A OBJETOS / HERANCA
 * ------------------------------
 * As 8 colecoes da API respondem exatamente aos mesmos 5 verbos:
 *
 *   GET    /recurso       -> listar todos      (list)
 *   GET    /recurso/:id   -> buscar um         (getById)
 *   POST   /recurso       -> criar             (create)
 *   PUT    /recurso/:id   -> alterar           (update)
 *   DELETE /recurso/:id   -> excluir           (delete)
 *
 * Escrever esses 5 metodos oito vezes seria o mesmo codigo repetido oito vezes.
 * Entao eles ficam escritos UMA unica vez aqui, e cada service concreto usa
 * `extends BaseApiService<...>` e HERDA os cinco.
 *
 * E a mesma ideia da classe `Pessoa` na camada Model: o que e comum sobe para a
 * classe base, o que e especifico fica na classe filha.
 *
 * GENERICO <T>
 * ------------
 * O `<T>` e um "tipo de encomenda": quem herda diz com qual model vai trabalhar.
 * `BaseApiService<Student>` faz list() devolver Observable<Student[]>;
 * `BaseApiService<Course>` faz o mesmo metodo devolver Observable<Course[]>.
 * Um codigo so, com tipagem correta em cada caso.
 *
 * `abstract` porque ninguem usa este service direto: ele existe para ser herdado.
 */
export abstract class BaseApiService<T> {
  /**
   * HttpClient e o objeto do Angular que faz as requisicoes HTTP.
   * `inject()` pede ele ao Angular (injecao de dependencia); fica `protected`
   * para que as classes filhas tambem possam usa-lo nas consultas proprias.
   * Habilitado globalmente por provideHttpClient() em app.config.ts.
   */
  protected readonly http = inject(HttpClient);

  /** Endereco completo da colecao, ex.: 'http://localhost:3000/students'. */
  protected readonly url: string;

  /**
   * @param recurso nome da colecao no db.json ('students', 'courses', ...).
   *                Cada service filho informa o seu no construtor, via super().
   */
  protected constructor(recurso: string) {
    this.url = `${API_URL}/${recurso}`;
  }

  /** Lista todos os registros da colecao. GET /recurso */
  list(): Observable<T[]> {
    return this.http.get<T[]>(this.url);
  }

  /** Busca um registro pelo id. GET /recurso/:id */
  getById(id: number): Observable<T> {
    return this.http.get<T>(`${this.url}/${id}`);
  }

  /**
   * Cria um registro. POST /recurso
   * Enviamos o objeto SEM id: quem gera o id (numerico e sequencial) e o JSON Server.
   */
  create(registro: T): Observable<T> {
    return this.http.post<T>(this.url, registro);
  }

  /**
   * Altera um registro existente. PUT /recurso/:id
   * PUT substitui o registro inteiro, por isso enviamos o objeto completo.
   */
  update(id: number, registro: T): Observable<T> {
    return this.http.put<T>(`${this.url}/${id}`, registro);
  }

  /** Exclui um registro. DELETE /recurso/:id */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /**
   * Atalho interno para as consultas filtradas das classes filhas.
   *
   * Usamos HttpParams em vez de montar a URL com texto ("?cpf=" + cpf) porque
   * o HttpParams cuida de escapar os valores que vem digitados pelo usuario.
   *
   * Ex.: this.buscar({ classId: 3 }) gera GET /recurso?classId=3
   */
  protected buscar(filtros: Record<string, string | number | boolean>): Observable<T[]> {
    let params = new HttpParams();
    for (const campo of Object.keys(filtros)) {
      params = params.set(campo, filtros[campo]);
    }
    return this.http.get<T[]>(this.url, { params });
  }
}
