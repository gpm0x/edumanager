import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';

/**
 * SEARCH FIELD - caixa de busca padrao das telas de lista.
 *
 * COMO FUNCIONA
 * -------------
 * O usuario digita, o componente espera 300ms de silencio (debounceTime) e
 * SO ENTAO emite o termo no (search). Isso evita refiltrar a lista a cada
 * tecla. O distinctUntilChanged ainda descarta emissao repetida (ex: digitar
 * uma letra e apagar volta ao mesmo texto).
 *
 * IMPORTANTE (regra 6.9 do contrato): este componente NAO chama a API.
 * Ele so avisa o termo digitado; quem filtra e a TELA, em memoria, sobre a
 * lista que ja foi carregada, com normalizacao de acento. O ?q= do JSON
 * Server nao e usado porque e sensivel a acento.
 *
 * Exemplo de uso (a tela guarda o termo em um signal - o projeto e zoneless):
 *
 *   termo = signal('');
 *   <app-search-field placeholder="Buscar aluno..." (search)="termo.set($event)">
 *   </app-search-field>
 */
@Component({
  selector: 'app-search-field',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './search-field.component.html',
  styleUrl: './search-field.component.scss',
})
export class SearchFieldComponent implements OnInit, OnDestroy {
  /** Texto de apoio dentro do campo. */
  @Input() placeholder = 'Buscar...';

  /** Valor inicial do campo. */
  @Input() value = '';

  /** Emite o termo digitado, 300ms depois da ultima tecla. */
  @Output() search = new EventEmitter<string>();

  /** Campo do Reactive Forms que representa a caixa de busca. */
  readonly campo = new FormControl('', { nonNullable: true });

  /** Guardamos a inscricao para cancelar quando o componente for destruido. */
  private inscricao?: Subscription;

  ngOnInit(): void {
    this.campo.setValue(this.value);

    this.inscricao = this.campo.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((termo) => this.search.emit(termo.trim()));
  }

  ngOnDestroy(): void {
    // Sem isso a inscricao continuaria viva depois de sair da tela.
    this.inscricao?.unsubscribe();
  }

  /** Botao "x": limpa o campo e avisa a tela na hora (sem esperar o debounce). */
  limpar(): void {
    this.campo.setValue('', { emitEvent: false });
    this.search.emit('');
  }
}
